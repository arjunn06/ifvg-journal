import Foundation
import Observation

/// The journal's single source of truth, equivalent to the web app's `JournalProvider`.
/// Live mode reads and writes Supabase as the signed-in user; sample mode keeps everything in memory.
@MainActor @Observable
final class JournalStore {
    private(set) var data = JournalData()
    private(set) var loading = false
    private(set) var loaded = false
    var error: String?
    private(set) var isDemo = false

    /// "all" means every active account.
    var scope: String = UserDefaults.standard.string(forKey: "ifvg-scope") ?? "all" {
        didSet { UserDefaults.standard.set(scope, forKey: "ifvg-scope") }
    }
    var period: Period = Period(rawValue: UserDefaults.standard.string(forKey: "ifvg-period") ?? "") ?? .month {
        didSet { UserDefaults.standard.set(period.rawValue, forKey: "ifvg-period") }
    }

    private var rest: RestClient?
    private(set) var userId: String?

    // MARK: derived (the same scope / period model as the web app)

    var accounts: [Account] { data.accounts }
    var trades: [Trade] { data.trades }
    var strategies: [Strategy] { data.strategies }
    var activeAccounts: [Account] { data.accounts.filter(\.isActive) }

    var scopeAccounts: [Account] {
        scope == "all" ? data.accounts.filter(\.isActive) : data.accounts.filter { $0.id == scope }
    }
    var scopeTrades: [Trade] {
        let ids = Set(scopeAccounts.map(\.id))
        return data.trades.filter { ids.contains($0.accountId) }
    }
    var viewTrades: [Trade] { Analytics.inPeriod(scopeTrades, period) }
    var startBalance: Double { scopeAccounts.reduce(0) { $0 + $1.initialBalance } }
    var currency: String { scopeAccounts.first?.currency ?? data.accounts.first?.currency ?? "USD" }
    var scopeTitle: String { scope == "all" ? "All Accounts" : (scopeAccounts.first?.name ?? "All Accounts") }

    func account(_ id: String?) -> Account? { data.accounts.first { $0.id == id } }
    func strategy(_ id: String?) -> Strategy? { data.strategies.first { $0.id == id } }
    func mistakes(for trade: Trade) -> [TradeMistake] { data.mistakes.filter { $0.tradeId == trade.id } }
    func confluence(for trade: Trade) -> [String: Bool] {
        Dictionary(data.tradeConfluence.filter { $0.tradeId == trade.id }.map { ($0.itemId, $0.isPresent) }, uniquingKeysWith: { a, _ in a })
    }
    func trade(_ id: String) -> Trade? { data.trades.first { $0.id == id } }

    // MARK: lifecycle

    func startLive(auth: AuthService) async {
        guard let uid = auth.userId else { return }
        if userId == uid, !isDemo, loaded { return }
        isDemo = false
        userId = uid
        rest = RestClient(auth: auth)
        data = JournalData(); loaded = false
        await refresh(showSpinner: true)
    }

    func startDemo() {
        isDemo = true
        userId = "demo"; rest = nil
        data = DemoData.build()
        scope = "all"
        loaded = true; loading = false; error = nil
    }

    func reset() {
        data = JournalData(); isDemo = false; userId = nil; rest = nil; loaded = false; error = nil
    }

    func refresh(showSpinner: Bool = false) async {
        guard !isDemo, let rest, let uid = userId else { return }
        if showSpinner { loading = true }
        defer { loading = false }
        let mine = [URLQueryItem(name: "user_id", value: "eq.\(uid)")]
        do {
            async let accounts: [Account] = rest.select("trading_accounts", mine)
            async let trades: [Trade] = rest.select("trades", mine + [URLQueryItem(name: "order", value: "entry_date.desc")])
            async let strategies: [Strategy] = rest.select("strategies", mine)
            async let items: [ConfluenceItem] = rest.select("confluence_items", mine)
            async let mistakes: [TradeMistake] = rest.select("trade_mistakes", mine)
            async let txs: [FinancialTransaction] = rest.select("financial_transactions", mine)
            async let notes: [Note] = rest.select("notes", mine + [URLQueryItem(name: "order", value: "updated_at.desc")])
            async let tags: [MistakeTag] = rest.select("mistake_tags", mine + [URLQueryItem(name: "order", value: "tag_name")])
            var d = JournalData()
            d.accounts = try await accounts
            d.trades = try await trades
            d.strategies = try await strategies
            d.confluenceItems = try await items
            d.mistakes = try await mistakes
            d.transactions = try await txs
            // Notes and tag vocabulary are optional tables: a project without them still loads the rest.
            d.notes = (try? await notes) ?? data.notes
            d.mistakeTags = (try? await tags) ?? data.mistakeTags
            d.tradeConfluence = await loadConfluence(for: d.trades.map(\.id), rest: rest)
            data = d
            error = nil
            loaded = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadConfluence(for ids: [String], rest: RestClient) async -> [TradeConfluence] {
        let chunks = stride(from: 0, to: ids.count, by: 80).map { Array(ids[$0..<min($0 + 80, ids.count)]) }
        var out: [TradeConfluence] = []
        for chunk in chunks {
            let q = [URLQueryItem(name: "trade_id", value: "in.(\(chunk.joined(separator: ",")))")]
            if let rows: [TradeConfluence] = try? await rest.select("trade_confluence", q) { out += rows }
        }
        return out
    }

    // MARK: trades

    /// Inserts or updates a trade. `mistakes` and `confluence`, when given, replace what was stored.
    @discardableResult
    func saveTrade(_ trade: Trade, mistakes: [TradeMistake]? = nil, confluence: [String: Bool]? = nil, isNew: Bool) async throws -> String {
        if isDemo {
            var t = trade
            if isNew { t.id = "tr-\(Int(Date().timeIntervalSince1970 * 1000))"; t.userId = "demo"; t.createdAt = Date() }
            data.trades.removeAll { $0.id == t.id }
            data.trades.append(t)
            data.trades.sort { $0.entryDate > $1.entryDate }
            if let mistakes {
                data.mistakes.removeAll { $0.tradeId == t.id }
                data.mistakes += mistakes.map { var m = $0; m.tradeId = t.id; m.id = UUID().uuidString; return m }
            }
            if let confluence {
                data.tradeConfluence.removeAll { $0.tradeId == t.id }
                data.tradeConfluence += confluence.map { TradeConfluence(tradeId: t.id, itemId: $0.key, isPresent: $0.value) }
            }
            return t.id
        }
        guard let rest, let uid = userId else { throw APIError(message: "You are signed out.") }
        var id = trade.id
        if isNew {
            guard let newId = try await rest.insert("trades", trade.payload(userId: uid)) else { throw APIError(message: "The trade was not saved.") }
            id = newId
        } else {
            try await rest.update("trades", id: id, trade.payload(userId: uid))
        }
        if let confluence {
            try await rest.delete("trade_confluence", column: "trade_id", equals: id)
            try await rest.insertMany("trade_confluence", confluence.map { ["trade_id": id, "confluence_item_id": $0.key, "is_present": $0.value] })
        }
        if let mistakes {
            try await rest.delete("trade_mistakes", column: "trade_id", equals: id)
            try await rest.insertMany("trade_mistakes", mistakes.map {
                ["trade_id": id, "user_id": uid, "mistake_tag": $0.tag, "severity": $0.severity.rawValue, "description": $0.note ?? NSNull()] as [String: Any]
            })
        }
        await refresh()
        return id
    }

    func deleteTrade(_ id: String) async throws {
        if isDemo {
            data.trades.removeAll { $0.id == id }
            data.mistakes.removeAll { $0.tradeId == id }
            data.tradeConfluence.removeAll { $0.tradeId == id }
            return
        }
        try await rest?.delete("trades", equals: id)
        await refresh()
    }

    // MARK: accounts and money

    func saveAccount(_ a: Account, isNew: Bool) async throws {
        if isDemo {
            if isNew { var n = a; n.id = "acc-\(Int(Date().timeIntervalSince1970))"; data.accounts.append(n) }
            else if let i = data.accounts.firstIndex(where: { $0.id == a.id }) { data.accounts[i] = a }
            return
        }
        guard let rest, let uid = userId else { throw APIError(message: "You are signed out.") }
        func v(_ x: Any?) -> Any { x ?? NSNull() }
        var body: [String: Any] = [
            "user_id": uid, "name": a.name, "account_type": a.accountType, "broker": v(a.broker), "initial_balance": a.initialBalance,
            "currency": a.currency, "is_active": a.isActive, "is_prop_firm": a.isPropFirm,
            "equity_goal": v(a.isPropFirm ? nil : a.equityGoal), "profit_target": v(a.isPropFirm ? a.profitTarget : nil),
            "max_loss_limit": v(a.isPropFirm ? a.maxLossLimit : nil), "daily_loss_limit": v(a.isPropFirm ? a.dailyLossLimit : nil),
            "minimum_trading_days": v(a.isPropFirm ? a.minimumTradingDays : nil), "trailing_drawdown_enabled": a.isPropFirm ? a.trailingDrawdown : false,
            "start_date": DateParsing.string(a.startDate ?? Date()),
        ]
        if isNew {
            body["current_balance"] = a.initialBalance; body["current_equity"] = a.initialBalance
            try await rest.insert("trading_accounts", body)
        } else {
            try await rest.update("trading_accounts", id: a.id, body)
        }
        await refresh()
    }

    func setAccountActive(_ id: String, _ active: Bool) async throws {
        if isDemo, let i = data.accounts.firstIndex(where: { $0.id == id }) { data.accounts[i].isActive = active; return }
        try await rest?.update("trading_accounts", id: id, ["is_active": active])
        await refresh()
    }

    func deleteAccount(_ id: String) async throws {
        if isDemo { data.accounts.removeAll { $0.id == id }; data.trades.removeAll { $0.accountId == id }; return }
        try await rest?.delete("trading_accounts", equals: id)
        if scope == id { scope = "all" }
        await refresh()
    }

    func addTransaction(_ t: FinancialTransaction) async throws {
        if isDemo { var n = t; n.id = UUID().uuidString; data.transactions.append(n); return }
        guard let rest, let uid = userId else { throw APIError(message: "You are signed out.") }
        try await rest.insert("financial_transactions", [
            "user_id": uid, "trading_account_id": t.accountId ?? NSNull(), "transaction_type": t.type.rawValue, "amount": t.amount,
            "description": t.note ?? NSNull(), "transaction_date": DateParsing.string(t.date),
        ] as [String: Any])
        await refresh()
    }

    func deleteTransaction(_ id: String) async throws {
        if isDemo { data.transactions.removeAll { $0.id == id }; return }
        try await rest?.delete("financial_transactions", equals: id)
        await refresh()
    }

    // MARK: playbook

    func saveStrategy(_ s: Strategy, isNew: Bool) async throws {
        if isDemo {
            if isNew { var n = s; n.id = UUID().uuidString; data.strategies.append(n) }
            else if let i = data.strategies.firstIndex(where: { $0.id == s.id }) { data.strategies[i] = s }
            return
        }
        guard let rest, let uid = userId else { throw APIError(message: "You are signed out.") }
        if isNew { try await rest.insert("strategies", s.payload(userId: uid)) } else { try await rest.update("strategies", id: s.id, s.payload(userId: uid)) }
        await refresh()
    }
    func deleteStrategy(_ id: String) async throws {
        if isDemo { data.strategies.removeAll { $0.id == id }; return }
        try await rest?.delete("strategies", equals: id); await refresh()
    }

    func saveConfluenceItem(_ c: ConfluenceItem, isNew: Bool) async throws {
        if isDemo {
            if isNew { var n = c; n.id = UUID().uuidString; data.confluenceItems.append(n) }
            else if let i = data.confluenceItems.firstIndex(where: { $0.id == c.id }) { data.confluenceItems[i] = c }
            return
        }
        guard let rest, let uid = userId else { throw APIError(message: "You are signed out.") }
        if isNew { try await rest.insert("confluence_items", c.payload(userId: uid)) } else { try await rest.update("confluence_items", id: c.id, c.payload(userId: uid)) }
        await refresh()
    }
    func deleteConfluenceItem(_ id: String) async throws {
        if isDemo { data.confluenceItems.removeAll { $0.id == id }; return }
        try await rest?.delete("confluence_items", equals: id); await refresh()
    }

    func saveNote(_ n: Note, isNew: Bool) async throws {
        if isDemo {
            var note = n; note.updatedAt = Date()
            if isNew { note.id = UUID().uuidString; data.notes.insert(note, at: 0) }
            else if let i = data.notes.firstIndex(where: { $0.id == n.id }) { data.notes[i] = note }
            return
        }
        guard let rest, let uid = userId else { throw APIError(message: "You are signed out.") }
        if isNew { try await rest.insert("notes", n.payload(userId: uid)) } else { try await rest.update("notes", id: n.id, n.payload(userId: uid)) }
        await refresh()
    }
    func deleteNote(_ id: String) async throws {
        if isDemo { data.notes.removeAll { $0.id == id }; return }
        try await rest?.delete("notes", equals: id); await refresh()
    }

    func addMistakeTag(name: String, category: String?) async throws {
        if isDemo { data.mistakeTags.append(MistakeTag(name: name, category: category)); return }
        guard let rest, let uid = userId else { throw APIError(message: "You are signed out.") }
        try await rest.insert("mistake_tags", ["user_id": uid, "tag_name": name, "category": category ?? NSNull()] as [String: Any])
        await refresh()
    }
    func deleteMistakeTag(_ id: String) async throws {
        if isDemo { data.mistakeTags.removeAll { $0.id == id }; return }
        try await rest?.delete("mistake_tags", equals: id); await refresh()
    }
}
