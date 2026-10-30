import SwiftUI

struct ReportEdgeTab: View {
    @Environment(JournalStore.self) private var store

    private var trades: [Trade] { store.viewTrades }
    private var currency: String { store.currency }

    private func visible(_ rows: [Analytics.Row]) -> [Analytics.Row] { rows.filter { $0.count > 0 } }
    private func byNet(_ rows: [Analytics.Row]) -> [Analytics.Row] { visible(rows).sorted { $0.net > $1.net } }

    private var weekdayRows: [Analytics.Row] {
        // Monday first, Sunday last.
        visible(Analytics.byWeekday(trades)).sorted { (($0.key == "0" ? 7 : Int($0.key) ?? 0)) < (($1.key == "0" ? 7 : Int($1.key) ?? 0)) }
    }
    private var sideRows: [Analytics.Row] { visible(Analytics.bySide(trades)).sorted { $0.key < $1.key } }

    private var headline: String? {
        let session = Analytics.bySession(trades).filter { $0.count >= 4 && $0.net > 0 }.max { $0.net < $1.net }
        let setup = Analytics.byStrategy(trades, store.strategies).filter { $0.count >= 4 && $0.key != "none" && $0.net > 0 }.max { $0.net < $1.net }
        func part(_ r: Analytics.Row) -> String { "\(Fmt.money(r.net, currency, sign: true, decimals: 0)) over \(ReportText.trades(r.count))" }
        switch (session, setup) {
        case let (s?, t?): return "Your strongest session is \(s.label) (\(part(s))) and your strongest setup is \(t.label) (\(part(t)))."
        case let (s?, nil): return "Your strongest session is \(s.label), at \(part(s))."
        case let (nil, t?): return "Your strongest setup is \(t.label), at \(part(t))."
        default: return nil
        }
    }

    var body: some View {
        VStack(spacing: 16) {
            if let headline {
                HealthCard(title: "Where Your Edge Is", symbol: "sparkles", tint: .accentColor, chevron: false) {
                    Text(headline).font(.body.weight(.medium)).fixedSize(horizontal: false, vertical: true)
                }
            }
            card("By Session", "clock.fill", rows: byNet(Analytics.bySession(trades)))
            card("By Setup", "scope", rows: byNet(Analytics.byStrategy(trades, store.strategies)))
            card("By Symbol", "chart.line.uptrend.xyaxis", rows: Array(byNet(Analytics.bySymbol(trades).prefix(8).map { $0 })))
            card("By Weekday", "calendar", rows: weekdayRows, vertical: true)
            card("By Side", "arrow.up.arrow.down", rows: sideRows, vertical: true)
        }
    }

    private func card(_ title: String, _ symbol: String, rows: [Analytics.Row], vertical: Bool = false) -> some View {
        ReportGroupCard(title: title, symbol: symbol, rows: rows, currency: currency, vertical: vertical,
                        detail: { ReportText.edgeDetail($0, currency: currency) })
    }
}
