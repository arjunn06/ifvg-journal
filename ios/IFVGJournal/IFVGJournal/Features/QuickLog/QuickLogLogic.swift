import SwiftUI

// Quick log: the pure helpers (port of src/journal/quicklog/logic.ts). A quick log records what a trader
// can answer in a few taps (pair, side, result, state of mind, what cost the loss) and leaves prices and
// size empty (stored as 0, shown as a dash).

enum TradeResult: String { case win, loss, flat }

/// The pleasant / unpleasant scale (the same idea as Apple's State of Mind), seven stops, 0...1.
enum MoodScale {
    struct Level { let label: String; let emotion: String }
    /// `emotion` is the word stored on the trade: the same vocabulary as the full form.
    static let levels: [Level] = [
        .init(label: "Very Unpleasant", emotion: "stressed"), .init(label: "Unpleasant", emotion: "fearful"),
        .init(label: "Slightly Unpleasant", emotion: "doubtful"), .init(label: "Neutral", emotion: "calm"),
        .init(label: "Slightly Pleasant", emotion: "focused"), .init(label: "Pleasant", emotion: "confident"),
        .init(label: "Very Pleasant", emotion: "excited"),
    ]
    static func index(_ v: Double) -> Int { min(levels.count - 1, max(0, Int(v * Double(levels.count)))) }
    static func level(_ v: Double) -> Level { levels[index(v)] }

    /// Indigo for unpleasant, through blue and teal, to green, yellow and orange for pleasant.
    private static let hueStops: [Double] = [0.74, 0.66, 0.57, 0.50, 0.38, 0.15, 0.07]
    static func hue(_ v: Double) -> Double {
        let pos = min(1, max(0, v)) * Double(hueStops.count - 1)
        let i = min(hueStops.count - 2, Int(pos))
        return hueStops[i] + (hueStops[i + 1] - hueStops[i]) * (pos - Double(i))
    }
    static func color(_ v: Double, saturation: Double = 0.7, brightness: Double = 0.95) -> Color {
        Color(hue: hue(v), saturation: saturation, brightness: brightness)
    }

    private static let position: [String: Double] = [
        "stressed": 0.04, "fearful": 0.16, "frustrated": 0.1, "nervous": 0.18, "impatient": 0.24, "greedy": 0.26, "doubtful": 0.3,
        "distracted": 0.36, "calm": 0.5, "patient": 0.6, "focused": 0.68, "confident": 0.82, "excited": 0.96,
    ]
    static func color(for emotion: String) -> Color { color(position[emotion.lowercased()] ?? 0.5, saturation: 0.75, brightness: 0.85) }
}

struct LossReason: Identifiable {
    let id: String, symbol: String, label: String, hint: String
    /// The mistake tag written to the journal; nil means "not a mistake".
    let tag: String?
    let severity: Severity
}

enum QuickLogLogic {
    static let lossReasons: [LossReason] = [
        .init(id: "fomo", symbol: "figure.run", label: "FOMO", hint: "Chased it", tag: "FOMO entry", severity: .medium),
        .init(id: "size", symbol: "scalemass.fill", label: "Oversized", hint: "Too big for the account", tag: "Oversized", severity: .high),
        .init(id: "greed", symbol: "dollarsign.circle.fill", label: "Greed", hint: "Wanted more", tag: "Greed", severity: .medium),
        .init(id: "tilt", symbol: "flame.fill", label: "Tilt", hint: "Revenge after a loss", tag: "Revenge trade", severity: .high),
        .init(id: "stop", symbol: "arrow.up.and.down.circle.fill", label: "Moved My Stop", hint: "Gave it more room", tag: "Moved stop loss", severity: .medium),
        .init(id: "plan", symbol: "xmark.seal.fill", label: "Ignored the Plan", hint: "No setup, took it anyway", tag: "Ignored the plan", severity: .high),
        .init(id: "early", symbol: "timer", label: "Too Early", hint: "Entered before confirmation", tag: "Impatient entry", severity: .low),
        .init(id: "clean", symbol: "gearshape.2.fill", label: "Mechanical Loss", hint: "Followed the plan. It just lost", tag: nil, severity: .low),
    ]
    static let winNotes: [(id: String, symbol: String, label: String)] = [
        ("patient", "hourglass", "Waited for It"), ("plan", "checklist", "Followed the Plan"),
        ("runner", "arrow.forward.circle.fill", "Let It Run"), ("lucky", "sparkles", "Got a Bit Lucky"),
    ]
    static let rChips: [TradeResult: [Double]] = [.win: [1, 2, 3, 5], .loss: [-0.5, -1, -1.5, -2], .flat: []]

    /// Which trading session is open now, from New York time (the sessions are defined in ET).
    static func sessionNow(_ d: Date = Date()) -> SessionKey? {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York")!
        let c = cal.dateComponents([.hour, .minute], from: d)
        let h = Double(c.hour ?? 0) + Double(c.minute ?? 0) / 60
        if h >= 20 || h < 0.5 { return .asia }
        if h >= 2 && h < 5 { return .london }
        if h >= 8.5 && h < 11 { return .newYorkAM }
        if h >= 12 && h < 13.5 { return .newYorkLunch }
        if h >= 13.5 && h < 16 { return .newYorkPM }
        return nil
    }

    /// The size the trader usually risks on an account: the median risk of its last 20 closed trades.
    static func usualRisk(_ trades: [Trade], accountId: String) -> Double? {
        let r = trades.filter { $0.accountId == accountId && $0.isClosed && ($0.riskAmount ?? 0) > 0 }
            .sorted { $0.entryDate > $1.entryDate }.prefix(20).compactMap(\.riskAmount).sorted()
        guard !r.isEmpty else { return nil }
        let m = r.count / 2
        let med = r.count % 2 == 1 ? r[m] : (r[m - 1] + r[m]) / 2
        return med >= 50 ? med.rounded() : (med * 100).rounded() / 100
    }

    static func recentSymbols(_ trades: [Trade], limit: Int = 6) -> [String] {
        var counts: [String: Int] = [:]
        for t in trades.sorted(by: { $0.entryDate > $1.entryDate }).prefix(120) { counts[t.symbol, default: 0] += 1 }
        return counts.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }.prefix(limit).map(\.key)
    }

    /// One sentence of feedback shown after saving, written from the journal's own history.
    static func afterNote(result: TradeResult, trades: [Trade], mistakes: [TradeMistake], accountId: String, tags: [String], clean: Bool) -> String {
        let mine = trades.filter { $0.accountId == accountId && $0.isClosed }.sorted { $0.entryDate > $1.entryDate }
        switch result {
        case .win:
            var run = 1
            for t in mine { if t.net > 0 { run += 1 } else { break } }
            return run >= 3 ? "Win number \(run) in a row. Keep the process the same." : "Logged. A win you wrote down is a win you can repeat."
        case .flat:
            return "Scratched and logged. Protecting capital is a skill too."
        case .loss:
            if clean {
                let losses = mine.filter { $0.net < 0 }.prefix(12)
                let flagged = Set(mistakes.map(\.tradeId))
                let cleanLosses = losses.filter { !flagged.contains($0.id) }.count + 1
                return "A clean loss. \(cleanLosses) of your last \(losses.count + 1) losses followed the plan. That's the cost of doing business."
            }
            if let tag = tags.first {
                let since = Date().addingTimeInterval(-30 * 86400)
                let ids = Set(mine.filter { $0.entryDate >= since }.map(\.id))
                let n = mistakes.filter { $0.tag == tag && ids.contains($0.tradeId) }.count + 1
                return n == 1 ? "First “\(tag)” in 30 days. Name it now, and it loses its grip."
                             : "That's “\(tag)” number \(n) in 30 days. It's a pattern worth a rule."
            }
            return "Logged. Next one: check the plan before you click."
        }
    }
}
