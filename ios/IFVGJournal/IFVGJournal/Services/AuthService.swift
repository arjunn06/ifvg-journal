import Foundation
import Security
import Observation

// Supabase Auth (GoTrue) over URLSession, no SDK: password sign in/up, recovery, refresh, sign out.
// The session lives in the Keychain so it survives relaunches.

struct AuthSession: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var userId: String
    var email: String?
}

enum Keychain {
    private static let service = "com.ifvg.journal.auth"
    static func save(_ data: Data, account: String) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(q as CFDictionary)
        var add = q
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
    static func load(account: String) -> Data? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                                kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        return SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }
    static func delete(account: String) {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(q as CFDictionary)
    }
}

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

@MainActor @Observable
final class AuthService {
    private(set) var session: AuthSession?
    private(set) var isRestoring = true
    /// Set after sign-up when the project requires e-mail confirmation.
    var awaitingConfirmation: String?

    private let key = "session"
    private var refreshTask: Task<String, Error>?

    var isSignedIn: Bool { session != nil }
    var userId: String? { session?.userId }
    var email: String? { session?.email }

    func restore() {
        defer { isRestoring = false }
        guard let data = Keychain.load(account: key), let s = try? JSONDecoder().decode(AuthSession.self, from: data) else { return }
        session = s
    }

    // MARK: flows

    func signIn(email: String, password: String) async throws {
        let body = ["email": email, "password": password]
        let obj = try await post("/auth/v1/token?grant_type=password", body: body)
        guard let s = Self.parseSession(obj) else { throw APIError(message: "Could not sign in. Check your email and password.") }
        persist(s)
    }

    /// Returns true when the account is signed in straight away, false when a confirmation e-mail was sent.
    @discardableResult
    func signUp(email: String, password: String, name: String) async throws -> Bool {
        var body: [String: Any] = ["email": email, "password": password]
        if !name.isEmpty { body["data"] = ["full_name": name] }
        let obj = try await post("/auth/v1/signup", body: body)
        if let s = Self.parseSession(obj) { persist(s); return true }
        awaitingConfirmation = email
        return false
    }

    func sendReset(email: String) async throws {
        _ = try await post("/auth/v1/recover", body: ["email": email])
    }

    func signOut() async {
        if let token = session?.accessToken {
            var req = URLRequest(url: AppConfig.supabaseURL.appending(path: "/auth/v1/logout"))
            req.httpMethod = "POST"
            req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try? await URLSession.shared.data(for: req)
        }
        Keychain.delete(account: key)
        session = nil
    }

    /// A token that is valid for at least the next minute, refreshing first if needed.
    func validToken() async throws -> String {
        guard let s = session else { throw APIError(message: "You are signed out. Sign in again.") }
        if s.expiresAt.timeIntervalSinceNow > 60 { return s.accessToken }
        return try await refresh()
    }

    @discardableResult
    func refresh() async throws -> String {
        if let t = refreshTask { return try await t.value }
        guard let rt = session?.refreshToken else { throw APIError(message: "You are signed out. Sign in again.") }
        let task = Task<String, Error> { [weak self] in
            do {
                let obj = try await self?.post("/auth/v1/token?grant_type=refresh_token", body: ["refresh_token": rt])
                guard let obj, let s = Self.parseSession(obj) else { throw APIError(message: "Your session expired. Sign in again.") }
                self?.persist(s)
                return s.accessToken
            } catch {
                // A refresh the server rejects means the session is gone; a network error just fails this request.
                if let e = error as? APIError, e.message.localizedCaseInsensitiveContains("refresh") || e.message.localizedCaseInsensitiveContains("expired") {
                    Keychain.delete(account: "session"); self?.session = nil
                }
                throw error
            }
        }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }

    // MARK: plumbing

    private func persist(_ s: AuthSession) {
        session = s
        awaitingConfirmation = nil
        if let d = try? JSONEncoder().encode(s) { Keychain.save(d, account: key) }
    }

    private func post(_ path: String, body: [String: Any]) async throws -> [String: Any] {
        var req = URLRequest(url: URL(string: AppConfig.supabaseURL.absoluteString + path)!)
        req.httpMethod = "POST"
        req.setValue(AppConfig.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(code) else {
            let msg = (obj["error_description"] ?? obj["msg"] ?? obj["message"] ?? obj["error"]) as? String
            throw APIError(message: Self.friendly(msg) ?? "Request failed (\(code)).")
        }
        return obj
    }

    private static func friendly(_ m: String?) -> String? {
        guard let m else { return nil }
        if m.localizedCaseInsensitiveContains("invalid login") { return "That email and password don't match." }
        if m.localizedCaseInsensitiveContains("email not confirmed") { return "Confirm your email first. Check your inbox for the link." }
        if m.localizedCaseInsensitiveContains("already registered") { return "That email already has an account. Sign in instead." }
        return m
    }

    private static func parseSession(_ o: [String: Any]) -> AuthSession? {
        guard let at = o["access_token"] as? String, let rt = o["refresh_token"] as? String,
              let user = o["user"] as? [String: Any], let id = user["id"] as? String else { return nil }
        let exp: Date
        if let e = o["expires_at"] as? Double { exp = Date(timeIntervalSince1970: e) }
        else { exp = Date().addingTimeInterval((o["expires_in"] as? Double) ?? 3600) }
        return AuthSession(accessToken: at, refreshToken: rt, expiresAt: exp, userId: id, email: user["email"] as? String)
    }
}
