import Foundation

/// A small PostgREST client: the handful of verbs the journal needs, authorised with the signed-in user's token.
@MainActor
final class RestClient {
    private let auth: AuthService
    init(auth: AuthService) { self.auth = auth }

    private func request(_ method: String, _ table: String, query: [URLQueryItem] = [], body: Any? = nil,
                         prefer: String? = nil, range: ClosedRange<Int>? = nil, retried: Bool = false) async throws -> Data {
        var comps = URLComponents(url: AppConfig.supabaseURL.appending(path: "/rest/v1/\(table)"), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(try await auth.validToken())", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let prefer { req.setValue(prefer, forHTTPHeaderField: "Prefer") }
        if let range { req.setValue("\(range.lowerBound)-\(range.upperBound)", forHTTPHeaderField: "Range"); req.setValue("items", forHTTPHeaderField: "Range-Unit") }
        if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401, !retried {
            try await auth.refresh()
            return try await request(method, table, query: query, body: body, prefer: prefer, range: range, retried: true)
        }
        guard (200..<300).contains(code) else {
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            throw APIError(message: (obj?["message"] as? String) ?? "The server returned \(code).")
        }
        return data
    }

    /// Every row matching the query, paged past PostgREST's 1,000-row default cap.
    func select<T: Decodable>(_ table: String, _ query: [URLQueryItem] = [], as: T.Type = T.self) async throws -> [T] {
        var all: [T] = []
        var from = 0
        let page = 1000
        while true {
            let data = try await request("GET", table, query: [URLQueryItem(name: "select", value: "*")] + query, range: from...(from + page - 1))
            let rows = try JSONDecoder().decode([T].self, from: data)
            all += rows
            if rows.count < page { break }
            from += page
        }
        return all
    }

    /// Inserts one row and returns its id.
    @discardableResult
    func insert(_ table: String, _ body: [String: Any]) async throws -> String? {
        let data = try await request("POST", table, body: body, prefer: "return=representation")
        let rows = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
        return rows?.first?["id"] as? String
    }

    func insertMany(_ table: String, _ rows: [[String: Any]]) async throws {
        guard !rows.isEmpty else { return }
        _ = try await request("POST", table, body: rows, prefer: "return=minimal")
    }

    func update(_ table: String, id: String, _ body: [String: Any]) async throws {
        _ = try await request("PATCH", table, query: [URLQueryItem(name: "id", value: "eq.\(id)")], body: body, prefer: "return=minimal")
    }

    func delete(_ table: String, column: String = "id", equals value: String) async throws {
        _ = try await request("DELETE", table, query: [URLQueryItem(name: column, value: "eq.\(value)")], prefer: "return=minimal")
    }
}
