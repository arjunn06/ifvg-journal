import SwiftUI

struct ReportPeriodsTab: View {
    @Environment(JournalStore.self) private var store
    let span: ReportSpan

    private struct PeriodRow: Identifiable {
        let id: Date
        let label: String
        let count: Int
        let winRate: Double?
        let net: Double
    }

    private var rows: [PeriodRow] {
        var cal = Calendar.current
        cal.firstWeekday = 2                                   // weeks start Monday
        let unit: Calendar.Component = span == .weekly ? .weekOfYear : .month
        let closed = store.scopeTrades.filter(\.isClosed)
        let now = Date()
        return (0..<12).compactMap { i -> PeriodRow? in
            guard let anchor = cal.date(byAdding: unit, value: -i, to: now),
                  let iv = cal.dateInterval(of: unit, for: anchor) else { return nil }
            let ts = closed.filter { $0.closeDate >= iv.start && $0.closeDate < iv.end }
            let s = Analytics.summarize(ts)
            return PeriodRow(id: iv.start, label: label(iv), count: s.count, winRate: s.winRate, net: s.net)
        }
    }

    private func label(_ iv: DateInterval) -> String {
        if span == .monthly { return iv.start.formatted(.dateTime.month(.wide).year()) }
        let last = Calendar.current.date(byAdding: .day, value: -1, to: iv.end) ?? iv.end
        let f = Date.FormatStyle.dateTime.month(.abbreviated).day()
        return "\(iv.start.formatted(f)) – \(last.formatted(f))"
    }

    var body: some View {
        let rows = rows
        let maxAbs = rows.map { abs($0.net) }.max() ?? 0
        HealthCard(title: span == .weekly ? "Last 12 Weeks" : "Last 12 Months", symbol: "calendar", chevron: false) {
            VStack(spacing: 14) {
                ForEach(rows) { r in
                    RankBar(label: r.label,
                            sub: r.count == 0 ? "No trades" : "\(ReportText.trades(r.count)) · \(Fmt.pct(r.winRate)) won",
                            share: maxAbs > 0 ? abs(r.net) / maxAbs : 0,
                            value: r.count == 0 ? nil : r.net, currency: store.currency,
                            tint: r.count == 0 ? Color(.systemGray4) : nil)
                        .opacity(r.count == 0 ? 0.6 : 1)
                }
            }
        }
    }
}
