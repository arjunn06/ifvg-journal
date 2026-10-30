import SwiftUI
import Charts

enum ReportText {
    static func trades(_ n: Int) -> String { "\(Fmt.int(n)) \(n == 1 ? "trade" : "trades")" }

    static func edgeDetail(_ r: Analytics.Row, currency: String) -> String {
        "\(trades(r.count)) · \(Fmt.pct(r.winRate)) won · \(Fmt.money(r.expectancy, currency, sign: true, decimals: 0)) avg"
    }

    static func decimals(for v: Double) -> Int { abs(v) < 100 && v != 0 ? 2 : 0 }
}

/// A Health-style card for one grouping: a bar chart of the figure per group, then compact rows beneath.
struct ReportGroupCard: View {
    let title: String
    let symbol: String
    var tint: Color
    let rows: [Analytics.Row]
    let currency: String
    var vertical: Bool
    var unit: String?
    var emptyText: String?
    let value: (Analytics.Row) -> Double
    let detail: (Analytics.Row) -> String

    init(title: String, symbol: String, tint: Color = .accentColor, rows: [Analytics.Row], currency: String,
         vertical: Bool = false, unit: String? = nil, emptyText: String? = nil,
         value: @escaping (Analytics.Row) -> Double = { $0.net },
         detail: @escaping (Analytics.Row) -> String) {
        self.title = title; self.symbol = symbol; self.tint = tint; self.rows = rows; self.currency = currency
        self.vertical = vertical; self.unit = unit; self.emptyText = emptyText; self.value = value; self.detail = detail
    }

    var body: some View {
        if rows.isEmpty {
            if let emptyText {
                HealthCard(title: title, symbol: symbol, tint: tint, chevron: false) {
                    Text(emptyText).font(.subheadline).foregroundStyle(.secondary)
                }
            }
        } else {
            HealthCard(title: title, symbol: symbol, tint: tint, chevron: false) {
                chart
                VStack(spacing: 10) {
                    ForEach(rows) { r in
                        rowView(r)
                        if r.id != rows.last?.id { Divider() }
                    }
                }
                .padding(.top, 4)
            }
        }
    }

    private func barColor(_ r: Analytics.Row) -> Color { value(r) >= 0 ? .positive : .negative }

    @ViewBuilder private var chart: some View {
        if vertical {
            Chart {
                ForEach(rows) { r in
                    BarMark(x: .value("Group", r.label), y: .value("Value", value(r)))
                        .foregroundStyle(barColor(r))
                        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                }
                RuleMark(y: .value("Zero", 0)).foregroundStyle(Color(.separator)).lineStyle(StrokeStyle(lineWidth: 0.5))
            }
            .chartYAxis(.hidden)
            .chartXAxis { AxisMarks { _ in AxisValueLabel() } }
            .frame(height: 150)
            .accessibilityHidden(true)
        } else {
            Chart {
                ForEach(rows) { r in
                    BarMark(x: .value("Value", value(r)), y: .value("Group", r.label))
                        .foregroundStyle(barColor(r))
                        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                }
                RuleMark(x: .value("Zero", 0)).foregroundStyle(Color(.separator)).lineStyle(StrokeStyle(lineWidth: 0.5))
            }
            .chartXAxis(.hidden)
            .chartYAxis { AxisMarks { _ in AxisValueLabel() } }
            .frame(height: CGFloat(rows.count) * 30 + 6)
            .accessibilityHidden(true)
        }
    }

    private func rowView(_ r: Analytics.Row) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text(r.label).font(.subheadline.weight(.medium))
                Text(detail(r)).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 1) {
                PnLText(value: value(r), currency: currency, decimals: ReportText.decimals(for: value(r)))
                    .font(.subheadline.weight(.semibold))
                if let unit { Text(unit).font(.caption2).foregroundStyle(.secondary) }
            }
        }
        .accessibilityElement(children: .combine)
    }
}
