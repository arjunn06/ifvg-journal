import Foundation

// Row shapes for the tables the journal reads. They mirror supabase/migrations and the web app's
// src/journal/types.ts. Decoding is deliberately lenient: PostgREST can hand back numerics as numbers
// or strings, and nullable columns may be missing.

struct AnyKey: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
    init(_ s: String) { stringValue = s }
}

struct JSONRow {
    let c: KeyedDecodingContainer<AnyKey>
    init(_ decoder: Decoder) throws { c = try decoder.container(keyedBy: AnyKey.self) }

    func string(_ k: String) -> String? { (try? c.decodeIfPresent(String.self, forKey: AnyKey(k))) ?? nil }
    func bool(_ k: String) -> Bool? { (try? c.decodeIfPresent(Bool.self, forKey: AnyKey(k))) ?? nil }
    func double(_ k: String) -> Double? {
        if let d = try? c.decodeIfPresent(Double.self, forKey: AnyKey(k)) { return d }
        if let s = try? c.decodeIfPresent(String.self, forKey: AnyKey(k)) { return Double(s) }
        return nil
    }
    func strings(_ k: String) -> [String]? { (try? c.decodeIfPresent([String].self, forKey: AnyKey(k))) ?? nil }
    func date(_ k: String) -> Date? { string(k).flatMap(DateParsing.parse) }
}

enum DateParsing {
    private static let frac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()
    private static let dateOnly: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f
    }()
    static func parse(_ s: String) -> Date? {
        if let d = frac.date(from: s) ?? plain.date(from: s) { return d }
        // Postgres sometimes emits 6 fractional digits; trim to 3 and retry.
        if let dot = s.firstIndex(of: "."), let tz = s[dot...].firstIndex(where: { $0 == "+" || $0 == "-" || $0 == "Z" }) {
            let digits = s[s.index(after: dot)..<tz]
            if digits.count > 3 {
                let trimmed = s[..<dot] + "." + digits.prefix(3) + s[tz...]
                return frac.date(from: String(trimmed))
            }
        }
        return dateOnly.date(from: s)
    }
    static func string(_ d: Date) -> String { frac.string(from: d) }
}

enum Side: String, Codable, CaseIterable, Identifiable {
    case long, short
    var id: String { rawValue }
    var label: String { self == .long ? "Long" : "Short" }
    var letter: String { self == .long ? "L" : "S" }
}

enum TradeStatus: String, Codable { case open, closed, cancelled }

enum SessionKey: String, CaseIterable, Identifiable, Codable {
    case asia, london
    case newYorkAM = "new-york-am"
    case newYorkLunch = "new-york-lunch"
    case newYorkPM = "new-york-pm"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .asia: "Asia"
        case .london: "London"
        case .newYorkAM: "New York AM"
        case .newYorkLunch: "NY Lunch"
        case .newYorkPM: "New York PM"
        }
    }
    var window: String {
        switch self {
        case .asia: "20:00–00:00"
        case .london: "02:00–05:00"
        case .newYorkAM: "08:30–11:00"
        case .newYorkLunch: "12:00–13:30"
        case .newYorkPM: "13:30–16:00"
        }
    }
}

struct Account: Identifiable, Hashable, Decodable {
    var id: String
    var name: String
    var accountType: String          // demo | live | paper
    var broker: String?
    var initialBalance: Double
    var currency: String
    var isActive: Bool
    var isPropFirm: Bool
    var profitTarget: Double?
    var maxLossLimit: Double?
    var dailyLossLimit: Double?
    var minimumTradingDays: Int?
    var trailingDrawdown: Bool
    var equityGoal: Double?
    var startDate: Date?
    var createdAt: Date

    init(id: String = UUID().uuidString, name: String, accountType: String = "live", broker: String? = nil, initialBalance: Double,
         currency: String = "USD", isActive: Bool = true, isPropFirm: Bool = false, profitTarget: Double? = nil,
         maxLossLimit: Double? = nil, dailyLossLimit: Double? = nil, minimumTradingDays: Int? = nil,
         trailingDrawdown: Bool = false, equityGoal: Double? = nil, startDate: Date? = nil, createdAt: Date = Date()) {
        self.id = id; self.name = name; self.accountType = accountType; self.broker = broker; self.initialBalance = initialBalance
        self.currency = currency; self.isActive = isActive; self.isPropFirm = isPropFirm; self.profitTarget = profitTarget
        self.maxLossLimit = maxLossLimit; self.dailyLossLimit = dailyLossLimit; self.minimumTradingDays = minimumTradingDays
        self.trailingDrawdown = trailingDrawdown; self.equityGoal = equityGoal; self.startDate = startDate; self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        id = r.string("id") ?? UUID().uuidString
        name = r.string("name") ?? "Account"
        accountType = r.string("account_type") ?? "live"
        broker = r.string("broker")
        initialBalance = r.double("initial_balance") ?? 0
        currency = r.string("currency") ?? "USD"
        isActive = r.bool("is_active") ?? true
        isPropFirm = r.bool("is_prop_firm") ?? false
        profitTarget = r.double("profit_target")
        maxLossLimit = r.double("max_loss_limit")
        dailyLossLimit = r.double("daily_loss_limit")
        minimumTradingDays = r.double("minimum_trading_days").map(Int.init)
        trailingDrawdown = r.bool("trailing_drawdown_enabled") ?? false
        equityGoal = r.double("equity_goal")
        startDate = r.date("start_date")
        createdAt = r.date("created_at") ?? Date()
    }

    var kindLabel: String { isPropFirm ? "Prop evaluation" : accountType == "paper" ? "Paper" : accountType == "demo" ? "Demo" : "Live" }
}

struct Trade: Identifiable, Hashable, Decodable {
    var id: String
    var userId: String
    var accountId: String
    var strategyId: String?
    var symbol: String
    var side: Side
    var status: TradeStatus
    var session: SessionKey?
    var entryPrice: Double
    var exitPrice: Double?
    var quantity: Double
    var stopLoss: Double?
    var takeProfit: Double?
    var entryDate: Date
    var exitDate: Date?
    var pnl: Double?
    var commission: Double?
    var swap: Double?
    var riskAmount: Double?
    var riskReward: Double?
    var notes: String?
    var emotions: String?
    var confluenceScore: Double?
    var source: String?
    var createdAt: Date

    init(id: String = UUID().uuidString, userId: String = "", accountId: String, strategyId: String? = nil, symbol: String, side: Side,
         status: TradeStatus = .closed, session: SessionKey? = nil, entryPrice: Double = 0, exitPrice: Double? = nil, quantity: Double = 0,
         stopLoss: Double? = nil, takeProfit: Double? = nil, entryDate: Date = Date(), exitDate: Date? = nil, pnl: Double? = nil,
         commission: Double? = nil, swap: Double? = nil, riskAmount: Double? = nil, riskReward: Double? = nil, notes: String? = nil,
         emotions: String? = nil, confluenceScore: Double? = nil, source: String? = "manual", createdAt: Date = Date()) {
        self.id = id; self.userId = userId; self.accountId = accountId; self.strategyId = strategyId; self.symbol = symbol; self.side = side
        self.status = status; self.session = session; self.entryPrice = entryPrice; self.exitPrice = exitPrice; self.quantity = quantity
        self.stopLoss = stopLoss; self.takeProfit = takeProfit; self.entryDate = entryDate; self.exitDate = exitDate; self.pnl = pnl
        self.commission = commission; self.swap = swap; self.riskAmount = riskAmount; self.riskReward = riskReward; self.notes = notes
        self.emotions = emotions; self.confluenceScore = confluenceScore; self.source = source; self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        id = r.string("id") ?? UUID().uuidString
        userId = r.string("user_id") ?? ""
        accountId = r.string("trading_account_id") ?? ""
        strategyId = r.string("strategy_id")
        symbol = r.string("symbol") ?? "—"
        side = Side(rawValue: r.string("trade_type") ?? "long") ?? .long
        status = TradeStatus(rawValue: r.string("status") ?? "closed") ?? .closed
        session = r.string("session").flatMap(SessionKey.init(rawValue:))
        entryPrice = r.double("entry_price") ?? 0
        exitPrice = r.double("exit_price")
        quantity = r.double("quantity") ?? 0
        stopLoss = r.double("stop_loss")
        takeProfit = r.double("take_profit")
        entryDate = r.date("entry_date") ?? Date()
        exitDate = r.date("exit_date")
        pnl = r.double("pnl")
        commission = r.double("commission")
        swap = r.double("swap")
        riskAmount = r.double("risk_amount")
        riskReward = r.double("risk_reward_ratio")
        notes = r.string("notes")
        emotions = r.string("emotions")
        confluenceScore = r.double("confluence_score")
        source = r.string("source")
        createdAt = r.date("created_at") ?? Date()
    }

    /// JSON body for insert / update. `null`s are explicit so an edit can clear a field.
    func payload(userId: String) -> [String: Any] {
        func v(_ x: Any?) -> Any { x ?? NSNull() }
        return [
            "user_id": userId, "trading_account_id": accountId, "strategy_id": v(strategyId), "symbol": symbol,
            "trade_type": side.rawValue, "status": status.rawValue, "session": v(session?.rawValue),
            "entry_price": entryPrice, "exit_price": v(exitPrice), "quantity": quantity,
            "stop_loss": v(stopLoss), "take_profit": v(takeProfit),
            "entry_date": DateParsing.string(entryDate), "exit_date": v(exitDate.map(DateParsing.string)),
            "pnl": v(pnl), "commission": v(commission), "swap": v(swap), "risk_amount": v(riskAmount),
            "risk_reward_ratio": v(riskReward), "notes": v(notes), "emotions": v(emotions),
            "confluence_score": v(confluenceScore), "source": v(source),
        ]
    }

    // Derived
    var isClosed: Bool { status == .closed && pnl != nil }
    var closeDate: Date { exitDate ?? entryDate }
    var net: Double { pnl ?? 0 }
    /// R multiple: reported result over the risk taken.
    var r: Double? { if let p = pnl, let risk = riskAmount, risk > 0 { return p / risk } else { return nil } }
    var isQuick: Bool { source == "quick" }
}

struct Strategy: Identifiable, Hashable, Decodable {
    var id: String
    var name: String
    var description: String?
    var rules: String?
    var entryCriteria: String?
    var exitCriteria: String?
    var timeframe: String?
    var riskPerTrade: Double?
    var minRiskReward: Double?
    var isActive: Bool

    init(id: String = UUID().uuidString, name: String, description: String? = nil, rules: String? = nil, entryCriteria: String? = nil,
         exitCriteria: String? = nil, timeframe: String? = nil, riskPerTrade: Double? = nil, minRiskReward: Double? = nil, isActive: Bool = true) {
        self.id = id; self.name = name; self.description = description; self.rules = rules; self.entryCriteria = entryCriteria
        self.exitCriteria = exitCriteria; self.timeframe = timeframe; self.riskPerTrade = riskPerTrade; self.minRiskReward = minRiskReward
        self.isActive = isActive
    }
    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        id = r.string("id") ?? UUID().uuidString
        name = r.string("name") ?? "Setup"
        description = r.string("description"); rules = r.string("rules")
        entryCriteria = r.string("entry_criteria"); exitCriteria = r.string("exit_criteria")
        timeframe = r.string("timeframe")
        riskPerTrade = r.double("risk_per_trade"); minRiskReward = r.double("min_risk_reward")
        isActive = r.bool("is_active") ?? true
    }
    func payload(userId: String) -> [String: Any] {
        func v(_ x: Any?) -> Any { x ?? NSNull() }
        return ["user_id": userId, "name": name, "description": v(description), "rules": v(rules), "entry_criteria": v(entryCriteria),
                "exit_criteria": v(exitCriteria), "timeframe": v(timeframe), "risk_per_trade": v(riskPerTrade),
                "min_risk_reward": v(minRiskReward), "is_active": isActive]
    }
}

struct ConfluenceItem: Identifiable, Hashable, Decodable {
    var id: String
    var name: String
    var description: String?
    var weight: Double
    var category: String?
    var isActive: Bool

    init(id: String = UUID().uuidString, name: String, description: String? = nil, weight: Double = 1, category: String? = nil, isActive: Bool = true) {
        self.id = id; self.name = name; self.description = description; self.weight = weight; self.category = category; self.isActive = isActive
    }
    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        id = r.string("id") ?? UUID().uuidString
        name = r.string("name") ?? "Item"
        description = r.string("description")
        weight = r.double("weight") ?? 1
        category = r.string("category")
        isActive = r.bool("is_active") ?? true
    }
    func payload(userId: String) -> [String: Any] {
        func v(_ x: Any?) -> Any { x ?? NSNull() }
        return ["user_id": userId, "name": name, "description": v(description), "weight": weight, "category": v(category), "is_active": isActive]
    }
}

struct TradeConfluence: Hashable, Decodable {
    var tradeId: String
    var itemId: String
    var isPresent: Bool
    init(tradeId: String, itemId: String, isPresent: Bool) { self.tradeId = tradeId; self.itemId = itemId; self.isPresent = isPresent }
    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        tradeId = r.string("trade_id") ?? ""; itemId = r.string("confluence_item_id") ?? ""; isPresent = r.bool("is_present") ?? false
    }
}

enum Severity: String, CaseIterable, Identifiable { case low, medium, high; var id: String { rawValue } }

struct TradeMistake: Identifiable, Hashable, Decodable {
    var id: String
    var tradeId: String
    var tag: String
    var note: String?
    var severity: Severity
    init(id: String = UUID().uuidString, tradeId: String, tag: String, note: String? = nil, severity: Severity = .medium) {
        self.id = id; self.tradeId = tradeId; self.tag = tag; self.note = note; self.severity = severity
    }
    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        id = r.string("id") ?? UUID().uuidString
        tradeId = r.string("trade_id") ?? ""
        tag = r.string("mistake_tag") ?? ""
        note = r.string("description")
        severity = Severity(rawValue: r.string("severity") ?? "medium") ?? .medium
    }
}

enum TransactionType: String, CaseIterable, Identifiable {
    case deposit, withdrawal, payout
    case challengeFee = "challenge_fee"
    case evaluationFee = "evaluation_fee"
    case fundedAccountFee = "funded_account_fee"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .deposit: "Deposit"
        case .withdrawal: "Withdrawal"
        case .payout: "Payout"
        case .challengeFee: "Challenge Fee"
        case .evaluationFee: "Evaluation Fee"
        case .fundedAccountFee: "Funded Account Fee"
        }
    }
    /// Adds to the balance (+1), takes from it (−1), or is a cost that sits outside the balance (0).
    var balanceSign: Double { self == .deposit || self == .payout ? 1 : self == .withdrawal ? -1 : 0 }
    var symbol: String {
        switch self {
        case .deposit: "arrow.down.circle.fill"
        case .withdrawal: "arrow.up.circle.fill"
        case .payout: "banknote.fill"
        default: "creditcard.fill"
        }
    }
}

struct FinancialTransaction: Identifiable, Hashable, Decodable {
    var id: String
    var accountId: String?
    var type: TransactionType
    var amount: Double
    var note: String?
    var date: Date
    init(id: String = UUID().uuidString, accountId: String?, type: TransactionType, amount: Double, note: String? = nil, date: Date = Date()) {
        self.id = id; self.accountId = accountId; self.type = type; self.amount = amount; self.note = note; self.date = date
    }
    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        id = r.string("id") ?? UUID().uuidString
        accountId = r.string("trading_account_id")
        type = TransactionType(rawValue: r.string("transaction_type") ?? "deposit") ?? .deposit
        amount = r.double("amount") ?? 0
        note = r.string("description")
        date = r.date("transaction_date") ?? Date()
    }
}

struct Note: Identifiable, Hashable, Decodable {
    var id: String
    var title: String
    var content: String
    var category: String
    var tags: [String]
    var isFavorite: Bool
    var updatedAt: Date
    var createdAt: Date
    init(id: String = UUID().uuidString, title: String, content: String, category: String = "General", tags: [String] = [],
         isFavorite: Bool = false, updatedAt: Date = Date(), createdAt: Date = Date()) {
        self.id = id; self.title = title; self.content = content; self.category = category; self.tags = tags
        self.isFavorite = isFavorite; self.updatedAt = updatedAt; self.createdAt = createdAt
    }
    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        id = r.string("id") ?? UUID().uuidString
        title = r.string("title") ?? "Untitled"
        content = r.string("content") ?? ""
        category = r.string("category") ?? "General"
        tags = r.strings("tags") ?? []
        isFavorite = r.bool("is_favorite") ?? false
        updatedAt = r.date("updated_at") ?? Date()
        createdAt = r.date("created_at") ?? Date()
    }
    func payload(userId: String) -> [String: Any] {
        ["user_id": userId, "title": title, "content": content, "category": category, "tags": tags, "is_favorite": isFavorite]
    }
    static let categories = ["General", "Trading Ideas", "Lessons Learned", "Market Analysis", "Personal"]
}

struct MistakeTag: Identifiable, Hashable, Decodable {
    var id: String
    var name: String
    var category: String?
    init(id: String = UUID().uuidString, name: String, category: String? = nil) { self.id = id; self.name = name; self.category = category }
    init(from decoder: Decoder) throws {
        let r = try JSONRow(decoder)
        id = r.string("id") ?? UUID().uuidString
        name = r.string("tag_name") ?? ""
        category = r.string("category")
    }
}

struct JournalData {
    var accounts: [Account] = []
    var trades: [Trade] = []
    var strategies: [Strategy] = []
    var confluenceItems: [ConfluenceItem] = []
    var tradeConfluence: [TradeConfluence] = []
    var mistakes: [TradeMistake] = []
    var transactions: [FinancialTransaction] = []
    var notes: [Note] = []
    var mistakeTags: [MistakeTag] = []
}
