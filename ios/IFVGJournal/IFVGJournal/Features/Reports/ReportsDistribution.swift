import SwiftUI
import Charts

struct ReportDistributionTab: View {
    @Environment(JournalStore.self) private var store

    private var trades: [Trade] { store.viewTrades }
    private var currency: String { store.currency }

    var body: some View {
        let s = Analytics.summarize(trades)
        VStack(spacing: 16) {
            histogramCard
            VStack(alignment: .leading, spacing: 10) {
                Text("Key Figures").font(.title3.weight(.bold)).padding(.horizontal, 4)
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    tiles(s)
                }
            }
        }
    }

    // MARK: histogram

    private func axisLabel(_ b: Analytics.Bin) -> String {
        guard let lo = b.lo else { return "<\(Fmt.minus)3" }
        if b.hi == nil { return "≥\(Int(lo))" }
        return Fmt.signed(lo, decimals: 0)
    }

    private func barColor(_ b: Analytics.Bin) -> Color {
        if let hi = b.hi, hi <= 0 { return .negative }
        return .positive
    }

    private var histogramCard: some View {
        let bins = Analytics.rHistogram(trades)
        let total = bins.reduce(0) { $0 + $1.count }
        return HealthCard(title: "R-Multiple Distribution", symbol: "chart.bar.fill",
                          trailing: total > 0 ? ReportText.trades(total) : nil, chevron: false) {
            if total == 0 {
                Text("No closed trades in this view have a recorded risk, so R multiples cannot be worked out.")
                    .font(.subheadline).foregroundStyle(.secondary)
            } else {
                Chart {
                    ForEach(bins) { b in
                        BarMark(x: .value("R", axisLabel(b)), y: .value("Trades", b.count))
                            .foregroundStyle(barColor(b))
                            .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
                            .annotation(position: .top, spacing: 2) {
                                if b.count > 0 { Text("\(b.count)").font(.caption2).foregroundStyle(.secondary).monospacedDigit() }
                            }
                    }
                }
                .chartYAxis(.hidden)
                .chartXAxis { AxisMarks { _ in AxisValueLabel().font(.caption2) } }
                .frame(height: 170)
                .accessibilityHidden(true)
                Text("Each bar spans 1R, starting at the labelled value.").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    // MARK: tiles

    @ViewBuilder private func tiles(_ s: Analytics.Summary) -> some View {
        tile("Win Rate", Fmt.pct(s.winRate, decimals: 1))
        tile("Profit Factor", Fmt.dec(s.profitFactor))
        tile("Expectancy", Fmt.money(s.expectancy, currency, sign: true), Color.pnl(s.expectancy))
        tile("Avg Win", Fmt.money(s.avgWin, currency, sign: true), s.avgWin == nil ? .secondary : .positive)
        tile("Avg Loss", s.avgLoss.map { Fmt.money(-$0, currency) } ?? "—", s.avgLoss == nil ? .secondary : .negative)
        tile("Payoff Ratio", Fmt.dec(s.payoff))
        tile("Best Trade", Fmt.money(s.best, currency, sign: true), Color.pnl(s.best))
        tile("Worst Trade", Fmt.money(s.worst, currency, sign: true), Color.pnl(s.worst))
        tile("Longest Win Streak", Fmt.int(s.longestWin), .primary, unit: s.longestWin == 1 ? "trade" : "trades")
        tile("Longest Loss Streak", Fmt.int(s.longestLoss), .primary, unit: s.longestLoss == 1 ? "trade" : "trades")
        tile("Max Drawdown", s.maxDrawdown > 0 ? Fmt.money(-s.maxDrawdown, currency) : Fmt.money(0, currency), s.maxDrawdown > 0 ? .negative : .primary)
        tile("Fees", Fmt.money(s.fees, currency))
    }

    private func tile(_ title: String, _ value: String, _ color: Color = .primary, unit: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption.weight(.medium)).foregroundStyle(.secondary).lineLimit(2)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value).font(.system(.title3, design: .rounded, weight: .bold)).foregroundStyle(color)
                    .monospacedDigit().minimumScaleFactor(0.6).lineLimit(1)
                if let unit { Text(unit).font(.caption).foregroundStyle(.secondary) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
