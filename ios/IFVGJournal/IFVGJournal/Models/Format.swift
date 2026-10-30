import Foundation

// One place for every figure format, mirroring src/journal/format.ts: a real minus sign (U+2212),
// signs on changes, missing values as an em dash.

enum Fmt {
    static let minus = "\u{2212}"

    private static func nf(_ min: Int, _ max: Int? = nil) -> NumberFormatter {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "en_US")
        f.minimumFractionDigits = min
        f.maximumFractionDigits = max ?? min
        return f
    }
    private static let n0 = nf(0), n1 = nf(1), n2 = nf(2)

    static func currencySign(_ c: String) -> String {
        ["USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥", "AUD": "A$", "CAD": "C$"][c] ?? "\(c) "
    }

    static func money(_ v: Double?, _ currency: String = "USD", sign: Bool = false, decimals: Int = 2) -> String {
        guard let v, v.isFinite else { return "—" }
        let body = (decimals == 0 ? n0 : n2).string(from: NSNumber(value: abs(v))) ?? "0"
        let s = currencySign(currency)
        if v < 0 && abs(v) >= (decimals == 0 ? 0.5 : 0.005) { return "\(minus)\(s)\(body)" }
        if sign && v > 0 { return "+\(s)\(body)" }
        return "\(s)\(body)"
    }

    /// $1.2K style for tight spaces (calendar cells).
    static func compact(_ v: Double, _ currency: String = "USD") -> String {
        let a = abs(v)
        let s = v < 0 ? minus : (v > 0 ? "+" : "")
        if a >= 1_000_000 { return "\(s)\(n1.string(from: NSNumber(value: a / 1_000_000)) ?? "")M" }
        if a >= 10_000 { return "\(s)\(n0.string(from: NSNumber(value: a / 1000)) ?? "")K" }
        if a >= 1000 { return "\(s)\(n1.string(from: NSNumber(value: a / 1000)) ?? "")K" }
        return "\(s)\(n0.string(from: NSNumber(value: a)) ?? "0")"
    }

    static func signed(_ v: Double?, decimals: Int = 2, suffix: String = "") -> String {
        guard let v, v.isFinite else { return "—" }
        let body = nf(decimals).string(from: NSNumber(value: abs(v))) ?? "0"
        if v < 0 && Double(body) != 0 { return "\(minus)\(body)\(suffix)" }
        if v > 0 { return "+\(body)\(suffix)" }
        return "\(body)\(suffix)"
    }

    static func pct(_ v: Double?, decimals: Int = 0) -> String {
        guard let v, v.isFinite else { return "—" }
        return "\(nf(decimals).string(from: NSNumber(value: v)) ?? "0")%"
    }

    static func r(_ v: Double?, decimals: Int = 2) -> String { signed(v, decimals: decimals, suffix: "R") }
    static func dec(_ v: Double?, _ d: Int = 2) -> String {
        guard let v, v.isFinite else { return "—" }
        return nf(d).string(from: NSNumber(value: v)) ?? "—"
    }
    static func int(_ v: Int) -> String { n0.string(from: NSNumber(value: v)) ?? "\(v)" }

    /// Price with as many decimals as it needs (up to 5).
    static func price(_ v: Double?) -> String {
        guard let v, v != 0 else { return "—" }
        return nf(0, 5).string(from: NSNumber(value: v)) ?? "—"
    }

    // MARK: dates
    static func day(_ d: Date) -> String { d.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)) }
    static func time(_ d: Date) -> String { d.formatted(.dateTime.hour().minute()) }
    static func monthYear(_ d: Date) -> String { d.formatted(.dateTime.month(.wide).year()) }
    static func relativeDay(_ d: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(d) { return "Today" }
        if cal.isDateInYesterday(d) { return "Yesterday" }
        return d.formatted(.dateTime.weekday(.wide).day().month(.abbreviated))
    }
}
