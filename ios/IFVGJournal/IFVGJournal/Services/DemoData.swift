import Foundation

/// Sample journal for "Explore with Sample Data". Seeded and relative to today so every period filter has
/// something in it. Every P&L is computed from entry, exit, size and the instrument's point value.
enum DemoData {
    struct Rng {
        var s: UInt32
        mutating func next() -> Double {
            s = s &+ 0x6D2B79F5
            var t = s
            t = (t ^ (t >> 15)) &* (t | 1)
            t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
            return Double(t ^ (t >> 14)) / 4294967296.0
        }
        mutating func pick<T>(_ xs: [T]) -> T { xs[Int(next() * Double(xs.count)) % xs.count] }
        mutating func weighted<T>(_ xs: [(T, Double)]) -> T {
            let r = next(); var acc = 0.0
            for (v, w) in xs { acc += w; if r <= acc { return v } }
            return xs.last!.0
        }
        mutating func range(_ a: Double, _ b: Double) -> Double { a + next() * (b - a) }
    }

    struct Instrument { let mult: Double, tick: Double, base: Double, stop: ClosedRange<Double>, fee: Double }
    static let instruments: [String: Instrument] = [
        "NQ": .init(mult: 20, tick: 0.25, base: 24400, stop: 14...36, fee: 2.4),
        "MNQ": .init(mult: 2, tick: 0.25, base: 24400, stop: 14...42, fee: 0.74),
        "ES": .init(mult: 50, tick: 0.25, base: 6860, stop: 3...8, fee: 2.4),
        "MES": .init(mult: 5, tick: 0.25, base: 6860, stop: 3...9, fee: 0.74),
        "MGC": .init(mult: 10, tick: 0.1, base: 4210, stop: 4...11, fee: 0.8),
    ]

    static let windows: [SessionKey: (Double, Double)] = [
        .asia: (20, 23), .london: (2, 4), .newYorkAM: (8.5, 10.75), .newYorkLunch: (12, 13.25), .newYorkPM: (13.75, 15.5),
    ]
    static let sessionWeights: [(SessionKey, Double)] = [(.newYorkAM, 0.46), (.london, 0.2), (.newYorkPM, 0.18), (.newYorkLunch, 0.09), (.asia, 0.07)]
    static let sessionEdge: [SessionKey: Double] = [.newYorkAM: 0.06, .london: 0.01, .newYorkPM: -0.01, .newYorkLunch: -0.1, .asia: -0.07]

    static let mistakeTagNames = ["FOMO entry", "Moved stop loss", "Cut winner early", "Oversized", "Revenge trade", "Ignored the plan"]
    static let winNotes = [
        "Swept the Asia low, closed through the 5m inverse FVG, entered on the retest. Held to the opposing high.",
        "Waited for the displacement leg before entering. Clean target hit, no second-guessing.",
        "HTF bias lined up. Entry on the iFVG body close, stop under the sweep. Scaled at 1R.",
        "Patient. Let price come to the 62% of the leg and took it with the plan.",
    ]
    static let lossNotes = [
        "Entered before the structure shift closed. Stop hit on the next candle; the idea was early, not wrong.",
        "News window I had flagged and traded anyway. Stopped out on the spike.",
        "Sweep was real but no displacement after it. Should have passed.",
        "Chased the second leg. No iFVG, no entry.",
    ]

    static func build(now: Date = Date()) -> JournalData {
        var rng = Rng(s: 20261030)
        let cal = Calendar.current
        let day0 = cal.startOfDay(for: now)
        func daysAgo(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: day0)! }

        var d = JournalData()
        d.accounts = [
            Account(id: "acc-eval", name: "Apex 50K Evaluation", accountType: "live", broker: "Apex Trader Funding", initialBalance: 50000,
                    isPropFirm: true, profitTarget: 3000, maxLossLimit: 2500, dailyLossLimit: 1000, minimumTradingDays: 7,
                    trailingDrawdown: true, startDate: daysAgo(44), createdAt: daysAgo(44)),
            Account(id: "acc-live", name: "Personal Futures", accountType: "live", broker: "Tradovate", initialBalance: 12500,
                    equityGoal: 20000, startDate: daysAgo(150), createdAt: daysAgo(150)),
            Account(id: "acc-sim", name: "Sim · New Setups", accountType: "paper", broker: "Tradovate Sim", initialBalance: 100000,
                    startDate: daysAgo(40), createdAt: daysAgo(40)),
        ]
        d.strategies = [
            Strategy(id: "st-ifvg", name: "iFVG Reversal", description: "Liquidity sweep, shift, then the inverse FVG closes through. Entry on the retest.",
                     entryCriteria: "Candle body closes through the FVG against the sweep", exitCriteria: "Opposing liquidity or 2R, whichever first",
                     timeframe: "1m / 5m", riskPerTrade: 0.5, minRiskReward: 2),
            Strategy(id: "st-cont", name: "FVG Continuation", description: "With the HTF trend: displacement leaves an FVG, enter on the first return.",
                     entryCriteria: "First tap of the FVG after displacement", exitCriteria: "Prior swing high or low",
                     timeframe: "5m / 15m", riskPerTrade: 0.5, minRiskReward: 2),
            Strategy(id: "st-sweep", name: "Sweep and MSS", description: "Raid of a session high or low, market structure shift on the 1m.",
                     entryCriteria: "MSS candle close after the raid", exitCriteria: "Midpoint of the range, then runner",
                     timeframe: "1m", riskPerTrade: 0.5, minRiskReward: 1.5),
        ]
        d.confluenceItems = [
            ConfluenceItem(id: "cf-bias", name: "HTF bias aligned", description: "Daily and 4H point the same way as the trade", weight: 2, category: "Context"),
            ConfluenceItem(id: "cf-liq", name: "Liquidity swept", description: "Session or previous-day high or low taken", weight: 2, category: "Context"),
            ConfluenceItem(id: "cf-mss", name: "Market structure shift", description: "Body close through the last swing on the entry timeframe", weight: 1.5, category: "Trigger"),
            ConfluenceItem(id: "cf-ifvg", name: "Inverse FVG closed through", description: "Candle body closes through the gap against the sweep", weight: 2, category: "Trigger"),
            ConfluenceItem(id: "cf-kill", name: "Inside a killzone", description: "London, NY AM or NY PM window", weight: 1, category: "Timing"),
            ConfluenceItem(id: "cf-disp", name: "Displacement with imbalance", description: "Impulsive leg that leaves an FVG", weight: 1, category: "Trigger"),
            ConfluenceItem(id: "cf-ote", name: "Entry in the 62–79% zone", description: "Optimal trade entry of the leg", weight: 1, category: "Entry"),
            ConfluenceItem(id: "cf-smt", name: "SMT divergence", description: "NQ and ES disagree at the extreme", weight: 0.5, category: "Context"),
            ConfluenceItem(id: "cf-news", name: "News-free window", description: "No red-folder release within 30 minutes", weight: 1, category: "Timing"),
            ConfluenceItem(id: "cf-rr", name: "At least 2R available", description: "Target at or beyond twice the stop", weight: 1, category: "Entry"),
        ]
        let totalWeight = d.confluenceItems.reduce(0) { $0 + $1.weight }

        struct Plan { let id: String; let syms: [(String, Double)]; let risk: Double; let fromDays: Int; let perDay: Double; let baseWin: Double }
        let plans = [
            Plan(id: "acc-eval", syms: [("MNQ", 0.6), ("MES", 0.28), ("NQ", 0.12)], risk: 250, fromDays: 44, perDay: 0.95, baseWin: 0.24),
            Plan(id: "acc-live", syms: [("MNQ", 0.55), ("MES", 0.25), ("MGC", 0.2)], risk: 125, fromDays: 150, perDay: 0.62, baseWin: 0.19),
            Plan(id: "acc-sim", syms: [("NQ", 0.6), ("ES", 0.4)], risk: 500, fromDays: 40, perDay: 0.4, baseWin: 0.21),
        ]
        var prices: [String: Double] = [:]
        var n = 0
        let emoWin = ["calm", "focused", "confident", "patient"]
        let emoLoss = ["impatient", "frustrated", "doubtful", "stressed"]

        for ago in stride(from: 150, through: 0, by: -1) {
            let date = daysAgo(ago)
            let wd = cal.component(.weekday, from: date)
            for (sym, ins) in instruments {
                let key = sym.hasPrefix("M") && (sym.hasSuffix("NQ") || sym.hasSuffix("ES")) ? String(sym.dropFirst()) : sym
                let prev = prices[key] ?? ins.base
                prices[key] = prev + (rng.next() - 0.48) * ins.base * 0.004
            }
            if wd == 1 || wd == 7 { continue }
            for plan in plans where ago <= plan.fromDays {
                let tilt = plan.id == "acc-eval" && (11...13).contains(ago)
                let k = tilt ? 3 + (rng.next() < 0.5 ? 1 : 0) : (rng.next() < plan.perDay ? 1 + (rng.next() < 0.38 ? 1 : 0) + (rng.next() < 0.1 ? 1 : 0) : 0)
                var dayLosses = 0
                for _ in 0..<k {
                    let sym = rng.weighted(plan.syms)
                    let ins = instruments[sym]!
                    let session = rng.weighted(sessionWeights)
                    let w = windows[session]!
                    let hour = rng.range(w.0, w.1)
                    let h = Int(hour) % 24, m = Int((hour - floor(hour)) * 60)
                    var entryDate = cal.date(bySettingHour: h, minute: m, second: Int(rng.next() * 60), of: date)!
                    if hour >= 20 { entryDate = cal.date(byAdding: .day, value: -1, to: entryDate)! }
                    if entryDate > now { continue }
                    let side: Side = rng.next() < 0.52 ? .long : .short
                    let stopPts = (rng.range(ins.stop.lowerBound, ins.stop.upperBound) / ins.tick).rounded() * ins.tick
                    let qty = max(1, (plan.risk / (stopPts * ins.mult)).rounded())
                    let risk = stopPts * ins.mult * qty
                    let key = sym.hasPrefix("M") && (sym.hasSuffix("NQ") || sym.hasSuffix("ES")) ? String(sym.dropFirst()) : sym
                    let entry = ((prices[key] ?? ins.base) / ins.tick).rounded() * ins.tick
                    let strat = rng.pick(d.strategies)

                    // checklist: a fuller one wins more often
                    var present: [String: Bool] = [:]
                    var score = 0.0
                    for c in d.confluenceItems { let on = rng.next() < (tilt ? 0.35 : 0.72); present[c.id] = on; if on { score += c.weight } }
                    let confPct = (score / totalWeight * 100).rounded()
                    let pWin = min(0.72, max(0.18, 0.40 + plan.baseWin * 0.3 + (sessionEdge[session] ?? 0) + (confPct - 60) / 100 * 0.35 - (tilt ? 0.18 : 0) - Double(dayLosses) * 0.03))
                    let roll = rng.next()
                    let outcome: String = roll < pWin ? "win" : roll < pWin + 0.06 ? "flat" : "loss"
                    let rMult: Double = outcome == "win" ? (rng.next() < 0.3 ? rng.range(0.4, 0.9) : rng.range(1.3, 3.4)) : outcome == "flat" ? 0 : -(rng.next() < 0.78 ? 1 : rng.range(0.4, 0.9))
                    let dir: Double = side == .long ? 1 : -1
                    let exit = ((entry + dir * rMult * stopPts) / ins.tick).rounded() * ins.tick
                    let fees = ins.fee * qty * 2
                    let gross = (exit - entry) * dir * ins.mult * qty
                    let pnl = (gross - fees).rounded(to: 2)
                    let hold = rng.range(2, 38) * 60
                    n += 1
                    let id = "tr-\(n)"
                    let note = outcome == "win" ? rng.pick(winNotes) : outcome == "loss" ? rng.pick(lossNotes) : "Moved to break-even after the first push and got tagged. Fine."
                    let trade = Trade(
                        id: id, userId: "demo", accountId: plan.id, strategyId: strat.id, symbol: sym, side: side, status: .closed, session: session,
                        entryPrice: entry, exitPrice: exit, quantity: qty, stopLoss: entry - dir * stopPts, takeProfit: entry + dir * stopPts * 2,
                        entryDate: entryDate, exitDate: entryDate.addingTimeInterval(hold), pnl: pnl, commission: fees.rounded(to: 2), swap: 0,
                        riskAmount: risk.rounded(to: 2), riskReward: 2, notes: note,
                        emotions: tilt ? "frustrated" : rng.pick(outcome == "win" ? emoWin : emoLoss), confluenceScore: confPct, source: "manual",
                        createdAt: entryDate)
                    d.trades.append(trade)
                    for (cid, on) in present { d.tradeConfluence.append(TradeConfluence(tradeId: id, itemId: cid, isPresent: on)) }
                    if outcome == "loss" {
                        dayLosses += 1
                        if tilt || rng.next() < 0.42 {
                            let tag = tilt ? rng.pick(["Revenge trade", "Oversized", "Ignored the plan"]) : rng.pick(mistakeTagNames)
                            d.mistakes.append(TradeMistake(id: "mk-\(n)", tradeId: id, tag: tag, severity: tag == "Oversized" || tag == "Revenge trade" ? .high : .medium))
                        }
                    }
                }
            }
        }
        d.trades.sort { $0.entryDate > $1.entryDate }

        d.transactions = [
            FinancialTransaction(accountId: "acc-eval", type: .evaluationFee, amount: 167, note: "Apex 50K evaluation", date: daysAgo(45)),
            FinancialTransaction(accountId: "acc-live", type: .deposit, amount: 12500, note: "Opening deposit", date: daysAgo(150)),
            FinancialTransaction(accountId: "acc-live", type: .deposit, amount: 1500, note: "Top-up", date: daysAgo(70)),
            FinancialTransaction(accountId: "acc-live", type: .withdrawal, amount: 600, note: "Monthly withdrawal", date: daysAgo(20)),
        ]
        d.notes = [
            Note(id: "n-1", title: "Sunday Prep: Levels for the Week", content: "Weekly high sits just above the Friday close; the first sweep of it is the trade if London gives a displacement down.\n\nBias: bearish below the weekly open, neutral above.\nPass on any setup before 08:30 on CPI days.\nOne trade a session until the evaluation passes.",
                 category: "Market Analysis", tags: ["weekly", "levels"], updatedAt: daysAgo(5), createdAt: daysAgo(5)),
            Note(id: "n-2", title: "Why I Stopped Trading NY Lunch", content: "Twelve trades in the lunch window, one clean winner. The range is real but the sweeps do not follow through, and I take them out of boredom.\n\nRule: after 11:30 the platform closes unless the NY AM plan was missed entirely.",
                 category: "Lessons Learned", tags: ["sessions", "discipline"], isFavorite: true, updatedAt: daysAgo(9), createdAt: daysAgo(12)),
            Note(id: "n-3", title: "iFVG With Partials at 1R", content: "Test on sim: take half at 1R, stop to break-even, runner to the opposing liquidity. Compare expectancy against all-in for 30 trades before touching the live accounts.",
                 category: "Trading Ideas", tags: ["iFVG", "partials"], updatedAt: daysAgo(20), createdAt: daysAgo(20)),
            Note(id: "n-4", title: "Pre-Trade Breathing", content: "Two minutes before the open: water, stretch, read the plan out loud. Revenge trades all came after a skipped routine.",
                 category: "Personal", tags: ["routine"], updatedAt: daysAgo(33), createdAt: daysAgo(33)),
        ]
        let cat = ["FOMO entry": "Psychology", "Moved stop loss": "Risk", "Cut winner early": "Psychology", "Oversized": "Risk", "Revenge trade": "Psychology", "Ignored the plan": "Process"]
        d.mistakeTags = mistakeTagNames.map { MistakeTag(id: "tag-\($0)", name: $0, category: cat[$0]) }
        return d
    }
}

extension Double {
    func rounded(to places: Int) -> Double { let p = pow(10.0, Double(places)); return (self * p).rounded() / p }
}
