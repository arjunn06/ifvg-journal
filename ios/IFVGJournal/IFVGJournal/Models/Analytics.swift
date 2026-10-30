import Foundation

// Pure functions over trades: a Swift port of src/journal/analytics.ts. Nothing here touches the
// network or the UI, so every figure on a screen is computed from the rows the screen shows.

enum Period: String, CaseIterable, Identifiable {
    case today, week = "7d", month = "30d", quarter = "90d", ytd, all
    var id: String { rawValue }
    var label: String {
        switch self {
        case .today: "Today"
        case .week: "7D"
        case .month: "30D"
        case .quarter: "90D"
        case .ytd: "YTD"
        case .all: "All"
        }
    }
    var longLabel: String {
        switch self {
        case .today: "today"
        case .week: "the last 7 days"
        case .month: "the last 30 days"
        case .quarter: "the last 90 days"
        case .ytd: "this year"
        case .all: "all time"
        }
    }
}

enum Analytics {
    static let cal = Calendar.current
    static func startOfDay(_ d: Date) -> Date { cal.startOfDay(for: d) }

    static func periodStart(_ p: Period, now: Date = Date()) -> Date? {
        let s = startOfDay(now)
        func back(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: s)! }
        switch p {
        case .today: return s
        case .week: return back(6)
        case .month: return back(29)
        case .quarter: return back(89)
        case .ytd: return cal.date(from: DateComponents(year: cal.component(.year, from: now), month: 1, day: 1))
        case .all: return nil
        }
    }

    /// The previous window of equal length, for "vs prior" figures. Nil for All time.
    static func priorWindow(_ p: Period, now: Date = Date()) -> (Date, Date)? {
        guard let s = periodStart(p, now: now) else { return nil }
        let end = cal.date(byAdding: .day, value: 1, to: startOfDay(now))!
        let len = end.timeIntervalSince(s)
        return (s.addingTimeInterval(-len), s)
    }

    static func inPeriod(_ trades: [Trade], _ p: Period, now: Date = Date()) -> [Trade] {
        guard let s = periodStart(p, now: now) else { return trades }
        return trades.filter { $0.closeDate >= s }
    }
    static func inWindow(_ trades: [Trade], _ w: (Date, Date)) -> [Trade] {
        trades.filter { $0.closeDate >= w.0 && $0.closeDate < w.1 }
    }

    // MARK: summary

    struct Summary {
        var count = 0, open = 0, wins = 0, losses = 0, flat = 0
        var net = 0.0, grossWin = 0.0, grossLoss = 0.0
        var winRate: Double?, profitFactor: Double?, avgWin: Double?, avgLoss: Double?, payoff: Double?
        var expectancy: Double?, avgR: Double?
        var totalR = 0.0, rCount = 0
        var best: Double?, worst: Double?
        var maxDrawdown = 0.0
        var streakKind: Character?, streakCount = 0
        var longestWin = 0, longestLoss = 0
        var fees = 0.0
    }

    static func summarize(_ all: [Trade]) -> Summary {
        let closed = all.filter(\.isClosed).sorted { $0.closeDate < $1.closeDate }
        var s = Summary()
        s.open = all.filter { $0.status == .open }.count
        var cum = 0.0, peak = 0.0
        var run = 0, runKind: Character?
        for t in closed {
            let p = t.net
            cum += p; peak = max(peak, cum); s.maxDrawdown = max(s.maxDrawdown, peak - cum)
            s.fees += (t.commission ?? 0) + (t.swap ?? 0)
            s.best = s.best.map { max($0, p) } ?? p
            s.worst = s.worst.map { min($0, p) } ?? p
            if let r = t.r { s.totalR += r; s.rCount += 1 }
            let kind: Character? = p > 0 ? "W" : p < 0 ? "L" : nil
            if p > 0 { s.wins += 1; s.grossWin += p } else if p < 0 { s.losses += 1; s.grossLoss += -p } else { s.flat += 1 }
            if let kind, kind == runKind { run += 1 } else { runKind = kind; run = kind == nil ? 0 : 1 }
            if kind == "W" { s.longestWin = max(s.longestWin, run) }
            if kind == "L" { s.longestLoss = max(s.longestLoss, run) }
        }
        s.count = closed.count
        let decided = s.wins + s.losses
        s.net = s.grossWin - s.grossLoss
        s.winRate = decided > 0 ? Double(s.wins) / Double(decided) * 100 : nil
        s.profitFactor = s.grossLoss > 0 ? s.grossWin / s.grossLoss : nil
        s.avgWin = s.wins > 0 ? s.grossWin / Double(s.wins) : nil
        s.avgLoss = s.losses > 0 ? s.grossLoss / Double(s.losses) : nil
        if let w = s.avgWin, let l = s.avgLoss, l > 0 { s.payoff = w / l }
        s.expectancy = closed.isEmpty ? nil : s.net / Double(closed.count)
        s.avgR = s.rCount > 0 ? s.totalR / Double(s.rCount) : nil
        s.streakKind = runKind; s.streakCount = run
        return s
    }

    struct EquityPoint: Identifiable { let id: String; let date: Date; let value: Double; let pnl: Double; let drawdown: Double }

    /// Running balance after each closed trade, starting from `start`. `drawdown` is the drop from the running peak.
    static func equityCurve(_ all: [Trade], start: Double = 0) -> [EquityPoint] {
        var v = start, peak = start
        return all.filter(\.isClosed).sorted { $0.closeDate < $1.closeDate }.map { t in
            v += t.net; peak = max(peak, v)
            return EquityPoint(id: t.id, date: t.closeDate, value: v, pnl: t.net, drawdown: peak - v)
        }
    }

    // MARK: breakdowns

    struct Row: Identifiable {
        var id: String { key }
        let key: String, label: String
        let count: Int, wins: Int, losses: Int
        let net: Double
        let winRate: Double?, expectancy: Double?, avgR: Double?, profitFactor: Double?
    }

    static func breakdown(_ trades: [Trade], key: (Trade) -> String?, label: (String) -> String = { $0 }) -> [Row] {
        var groups: [String: [Trade]] = [:]
        for t in trades.filter(\.isClosed) { if let k = key(t) { groups[k, default: []].append(t) } }
        return groups.map { k, ts in
            let s = summarize(ts)
            return Row(key: k, label: label(k), count: s.count, wins: s.wins, losses: s.losses, net: s.net,
                       winRate: s.winRate, expectancy: s.expectancy, avgR: s.avgR, profitFactor: s.profitFactor)
        }
    }

    static func bySession(_ t: [Trade]) -> [Row] { breakdown(t, key: { $0.session?.rawValue }, label: { SessionKey(rawValue: $0)?.label ?? $0 }) }
    static func bySymbol(_ t: [Trade]) -> [Row] { breakdown(t, key: { $0.symbol }).sorted { $0.count > $1.count } }
    static func bySide(_ t: [Trade]) -> [Row] { breakdown(t, key: { $0.side.rawValue }, label: { $0 == "long" ? "Long" : "Short" }) }
    static let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    static func byWeekday(_ t: [Trade]) -> [Row] {
        breakdown(t, key: { String(cal.component(.weekday, from: $0.entryDate) - 1) }, label: { weekdays[Int($0) ?? 0] })
            .sorted { (Int($0.key) ?? 0) < (Int($1.key) ?? 0) }
    }
    static func byStrategy(_ t: [Trade], _ strategies: [Strategy]) -> [Row] {
        breakdown(t, key: { $0.strategyId ?? "none" }, label: { k in k == "none" ? "No Setup" : (strategies.first { $0.id == k }?.name ?? "No Setup") })
    }
    static func byEmotion(_ t: [Trade]) -> [Row] {
        breakdown(t, key: { ($0.emotions?.isEmpty ?? true) ? nil : $0.emotions }, label: { $0.prefix(1).uppercased() + $0.dropFirst() })
    }

    // MARK: calendar

    struct Day: Identifiable {
        var id: String { key }
        let key: String
        var pnl = 0.0, count = 0, wins = 0, losses = 0
        var trades: [Trade] = []
    }

    static func dayKey(_ d: Date) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    static func dailyMap(_ all: [Trade]) -> [String: Day] {
        var m: [String: Day] = [:]
        for t in all.filter(\.isClosed) {
            let k = dayKey(t.closeDate)
            var d = m[k] ?? Day(key: k)
            d.pnl += t.net; d.count += 1; d.trades.append(t)
            if t.net > 0 { d.wins += 1 } else if t.net < 0 { d.losses += 1 }
            m[k] = d
        }
        return m
    }

    struct Cell: Identifiable { var id: String { key }; let date: Date; let key: String; let inMonth: Bool; let day: Day? }
    struct Week: Identifiable { let id: Int; let cells: [Cell]; let pnl: Double; let count: Int }

    /// Weeks Monday to Sunday covering the month; the weekly total sits with its row.
    static func monthGrid(year: Int, month: Int, daily: [String: Day]) -> [Week] {
        let first = cal.date(from: DateComponents(year: year, month: month, day: 1))!
        let lead = (cal.component(.weekday, from: first) + 5) % 7           // Monday = 0
        let start = cal.date(byAdding: .day, value: -lead, to: first)!
        let daysInMonth = cal.range(of: .day, in: .month, for: first)!.count
        let total = Int((Double(lead + daysInMonth) / 7).rounded(.up)) * 7
        return stride(from: 0, to: total, by: 7).map { i in
            var pnl = 0.0, count = 0
            let cells: [Cell] = (0..<7).map { j in
                let date = cal.date(byAdding: .day, value: i + j, to: start)!
                let key = dayKey(date)
                let inMonth = cal.component(.month, from: date) == month
                let day = daily[key]
                if inMonth, let day { pnl += day.pnl; count += day.count }
                return Cell(date: date, key: key, inMonth: inMonth, day: day)
            }
            return Week(id: i / 7, cells: cells, pnl: pnl, count: count)
        }
    }

    // MARK: distributions

    struct Bin: Identifiable { var id: String { label }; let label: String; let lo: Double?; let hi: Double?; var count: Int }

    /// R-multiple histogram: 1R bins from −3R to +4R with open tails.
    static func rHistogram(_ all: [Trade]) -> [Bin] {
        let edges: [Double] = [-3, -2, -1, 0, 1, 2, 3, 4]
        func f(_ n: Double) -> String { n < 0 ? "\(Fmt.minus)\(Int(-n))" : n > 0 ? "+\(Int(n))" : "0" }
        var bins = [Bin(label: "<\(Fmt.minus)3", lo: nil, hi: edges[0], count: 0)]
        for i in 0..<(edges.count - 1) { bins.append(Bin(label: "\(f(edges[i]))…\(f(edges[i + 1]))", lo: edges[i], hi: edges[i + 1], count: 0)) }
        bins.append(Bin(label: "≥+4", lo: edges.last, hi: nil, count: 0))
        for t in all.filter(\.isClosed) {
            guard let r = t.r else { continue }
            if let i = bins.firstIndex(where: { ($0.lo == nil || r >= $0.lo!) && ($0.hi == nil || r < $0.hi!) }) { bins[i].count += 1 }
        }
        return bins
    }

    static let confluenceTiers: [(key: String, label: String, lo: Double, hi: Double)] = [
        ("low", "Below 50%", 0, 50), ("mid", "50–74%", 50, 75), ("high", "75–89%", 75, 90), ("top", "90% and Up", 90, 101),
    ]

    /// Does a fuller checklist earn more? Trades grouped by the confluence score they were taken at.
    static func byConfluence(_ all: [Trade]) -> [Row] {
        let rows = breakdown(all.filter { $0.confluenceScore != nil },
                             key: { t in confluenceTiers.first { t.confluenceScore! >= $0.lo && t.confluenceScore! < $0.hi }?.key },
                             label: { k in confluenceTiers.first { $0.key == k }?.label ?? k })
        return confluenceTiers.compactMap { tier in rows.first { $0.key == tier.key } }
    }

    struct MistakeRow: Identifiable { var id: String { tag }; let tag: String; var count: Int; var cost: Double }

    /// What each mistake tag cost: the sum of P&L on losing trades carrying it.
    static func mistakeCosts(_ all: [Trade], _ mistakes: [TradeMistake]) -> [MistakeRow] {
        let byId = Dictionary(all.filter(\.isClosed).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var m: [String: MistakeRow] = [:]
        for x in mistakes {
            guard let t = byId[x.tradeId] else { continue }
            var row = m[x.tag] ?? MistakeRow(tag: x.tag, count: 0, cost: 0)
            row.count += 1
            if t.net < 0 { row.cost += t.net }
            m[x.tag] = row
        }
        return m.values.sorted { $0.cost < $1.cost }
    }

    struct Adherence { let clean: Int, total: Int, pct: Double, cleanNet: Double }
    static func planAdherence(_ all: [Trade], _ mistakes: [TradeMistake]) -> Adherence? {
        let closed = all.filter(\.isClosed)
        guard !closed.isEmpty else { return nil }
        let flagged = Set(mistakes.map(\.tradeId))
        let clean = closed.filter { !flagged.contains($0.id) }
        return Adherence(clean: clean.count, total: closed.count, pct: Double(clean.count) / Double(closed.count) * 100, cleanNet: clean.reduce(0) { $0 + $1.net })
    }

    // MARK: accounts

    static func transactionNet(_ txs: [FinancialTransaction], accountId: String) -> Double {
        txs.filter { $0.accountId == accountId }.reduce(0) { $0 + $1.type.balanceSign * $1.amount }
    }
    static func accountEquity(_ a: Account, _ trades: [Trade], _ txs: [FinancialTransaction]) -> Double {
        a.initialBalance + trades.filter { $0.accountId == a.id && $0.isClosed }.reduce(0) { $0 + $1.net } + transactionNet(txs, accountId: a.id)
    }

    struct PropStatus {
        var equity = 0.0, profit = 0.0
        var target: Double?, targetPct: Double?, floor: Double?, bufferToFloor: Double?
        var dailyPnl = 0.0
        var dailyLimit: Double?
        var tradingDays = 0
        var minDays: Int?
    }

    static func propStatus(_ a: Account, _ trades: [Trade], _ txs: [FinancialTransaction], now: Date = Date()) -> PropStatus {
        let mine = trades.filter { $0.accountId == a.id && $0.isClosed }
        let equity = accountEquity(a, trades, txs)
        let profit = mine.reduce(0) { $0 + $1.net }
        let today = dayKey(now)
        let dailyPnl = mine.filter { dayKey($0.closeDate) == today }.reduce(0) { $0 + $1.net }
        var floor: Double?
        if let limit = a.maxLossLimit, limit > 0 {
            if a.trailingDrawdown {
                let peak = max(a.initialBalance, equityCurve(mine, start: a.initialBalance).map(\.value).max() ?? a.initialBalance)
                floor = peak - limit
            } else { floor = a.initialBalance - limit }
        }
        let days = Set(mine.map { dayKey($0.closeDate) }).count
        return PropStatus(equity: equity, profit: profit, target: a.profitTarget,
                          targetPct: a.profitTarget.map { $0 > 0 ? max(0, profit / $0 * 100) : 0 },
                          floor: floor, bufferToFloor: floor.map { equity - $0 }, dailyPnl: dailyPnl,
                          dailyLimit: a.dailyLossLimit, tradingDays: days, minDays: a.minimumTradingDays)
    }

    // MARK: the one finding

    struct Finding { enum Tone { case pos, neg, flat }; let text: String; let tone: Tone }

    static func topFinding(_ trades: [Trade], strategies: [Strategy], mistakes: [TradeMistake], currency: String = "USD") -> Finding? {
        let closed = trades.filter(\.isClosed)
        guard closed.count >= 8 else { return nil }
        let sessions = bySession(closed).filter { $0.count >= 4 }
        let costs = mistakeCosts(closed, mistakes)
        let conf = byConfluence(closed).filter { $0.count >= 4 }
        let strats = byStrategy(closed, strategies).filter { $0.count >= 4 && $0.key != "none" }

        if let worst = costs.first, worst.cost < 0, abs(worst.cost) > abs(summarize(closed).net) * 0.25 {
            let amt = Fmt.money(worst.cost, currency, decimals: 0).replacingOccurrences(of: Fmt.minus, with: "")
            return Finding(text: "\(worst.tag) cost \(amt) across \(worst.count) trade\(worst.count == 1 ? "" : "s") in this view.", tone: .neg)
        }
        if conf.count >= 2, let hi = conf.last, let lo = conf.first, let he = hi.expectancy, let le = lo.expectancy, he > le {
            return Finding(text: "Trades taken at \(hi.label.lowercased()) confluence average \(Fmt.money(he, currency, sign: true, decimals: 0)) a trade; at \(lo.label.lowercased()), \(Fmt.money(le, currency, sign: true, decimals: 0)).", tone: .pos)
        }
        if sessions.count >= 2, let best = sessions.max(by: { $0.net < $1.net }) {
            return Finding(text: "\(best.label) is your edge: \(best.count) trades, \(Int((best.winRate ?? 0).rounded()))% won.", tone: .pos)
        }
        if let best = strats.max(by: { $0.net < $1.net }) {
            return Finding(text: "\(best.label) leads this view with \(best.count) trades.", tone: .pos)
        }
        return nil
    }
}
