import SwiftUI
import Charts

/// Equity (or any running balance) as a smooth area under a line, scrubbable when `interactive`.
struct EquityChart: View {
    let points: [Analytics.EquityPoint]
    var currency = "USD"
    var height: CGFloat = 110
    var interactive = false
    var tint: Color = .accentColor

    @State private var selected: Date?

    private var lo: Double { (points.map(\.value).min() ?? 0) }
    private var hi: Double { (points.map(\.value).max() ?? 1) }
    private var pad: Double { max((hi - lo) * 0.12, 1) }
    private var picked: Analytics.EquityPoint? {
        guard let selected else { return nil }
        return points.min { abs($0.date.timeIntervalSince(selected)) < abs($1.date.timeIntervalSince(selected)) }
    }

    var body: some View {
        if points.count < 2 {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(.tertiarySystemFill)).frame(height: height)
                .overlay { Text(points.isEmpty ? "No closed trades yet" : "One trade so far").font(.footnote).foregroundStyle(.secondary) }
        } else {
            Chart {
                ForEach(points) { p in
                    AreaMark(x: .value("Date", p.date), yStart: .value("Base", lo - pad), yEnd: .value("Equity", p.value))
                        .interpolationMethod(.monotone)
                        .foregroundStyle(LinearGradient(colors: [tint.opacity(0.35), tint.opacity(0.02)], startPoint: .top, endPoint: .bottom))
                    LineMark(x: .value("Date", p.date), y: .value("Equity", p.value))
                        .interpolationMethod(.monotone)
                        .foregroundStyle(tint)
                        .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                }
                if let p = picked {
                    RuleMark(x: .value("Date", p.date))
                        .foregroundStyle(.secondary.opacity(0.4))
                        .annotation(position: .top, spacing: 4, overflowResolution: .init(x: .fit(to: .chart), y: .disabled)) {
                            VStack(spacing: 1) {
                                Text(Fmt.money(p.value, currency, decimals: 0)).font(.footnote.weight(.semibold)).monospacedDigit()
                                Text(p.date.formatted(.dateTime.day().month(.abbreviated))).font(.caption2).foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                    PointMark(x: .value("Date", p.date), y: .value("Equity", p.value)).foregroundStyle(tint).symbolSize(60)
                }
            }
            .chartYScale(domain: (lo - pad)...(hi + pad))
            .chartXAxis(interactive ? .automatic : .hidden)
            .chartYAxis(interactive ? .automatic : .hidden)
            .chartYAxis {
                if interactive {
                    AxisMarks(position: .trailing) { v in
                        AxisGridLine()
                        AxisValueLabel { if let d = v.as(Double.self) { Text(Fmt.compact(d).replacingOccurrences(of: "+", with: "")) } }
                    }
                }
            }
            .chartXSelection(value: interactive ? $selected : .constant(nil))
            .frame(height: height)
        }
    }
}

struct DrawdownChart: View {
    let points: [Analytics.EquityPoint]
    var height: CGFloat = 220
    var body: some View {
        if points.count < 2 {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(.tertiarySystemFill)).frame(height: height)
                .overlay { Text("Not enough trades yet").font(.footnote).foregroundStyle(.secondary) }
        } else {
            Chart(points) { p in
                AreaMark(x: .value("Date", p.date), y: .value("Drawdown", -p.drawdown))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(LinearGradient(colors: [Color.negative.opacity(0.02), Color.negative.opacity(0.35)], startPoint: .top, endPoint: .bottom))
                LineMark(x: .value("Date", p.date), y: .value("Drawdown", -p.drawdown))
                    .interpolationMethod(.monotone).foregroundStyle(Color.negative)
            }
            .chartYAxis {
                AxisMarks(position: .trailing) { v in
                    AxisGridLine()
                    AxisValueLabel { if let d = v.as(Double.self) { Text(Fmt.compact(d).replacingOccurrences(of: "+", with: "")) } }
                }
            }
            .frame(height: height)
        }
    }
}

struct DailyBarsChart: View {
    let days: [Analytics.Day]
    var height: CGFloat = 220
    var body: some View {
        if days.isEmpty {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(.tertiarySystemFill)).frame(height: height)
                .overlay { Text("No trading days in this period").font(.footnote).foregroundStyle(.secondary) }
        } else {
            let sorted = days.sorted { $0.key < $1.key }
            Chart(sorted) { d in
                BarMark(x: .value("Day", Analytics.cal.date(from: dayComponents(d.key)) ?? Date(), unit: .day), y: .value("Result", d.pnl))
                    .foregroundStyle(d.pnl >= 0 ? Color.positive : Color.negative)
                    .cornerRadius(3)
            }
            .chartYAxis {
                AxisMarks(position: .trailing) { v in
                    AxisGridLine()
                    AxisValueLabel { if let d = v.as(Double.self) { Text(Fmt.compact(d).replacingOccurrences(of: "+", with: "")) } }
                }
            }
            .frame(height: height)
        }
    }

    private func dayComponents(_ key: String) -> DateComponents {
        let p = key.split(separator: "-").compactMap { Int($0) }
        return DateComponents(year: p.first, month: p.dropFirst().first, day: p.last)
    }
}
