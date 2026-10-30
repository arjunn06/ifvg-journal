import SwiftUI

struct ReportBehaviourTab: View {
    @Environment(JournalStore.self) private var store

    private var trades: [Trade] { store.viewTrades }
    private var currency: String { store.currency }

    var body: some View {
        VStack(spacing: 16) {
            emotionCard
            mistakesCard
            planCard
            checklistCard
        }
    }

    // MARK: emotion

    private var emotionCard: some View {
        let rows = Analytics.byEmotion(trades).sorted { $0.net > $1.net }
        return ReportGroupCard(
            title: "By Emotion", symbol: "face.smiling", rows: rows, currency: currency,
            emptyText: "Tag how you felt on a trade to see what each mood costs or earns.",
            detail: { r in "\(ReportText.trades(r.count)) · \(Fmt.pct(r.winRate)) won · avg \(Fmt.r(r.avgR, decimals: 1))" })
    }

    // MARK: mistakes

    private var mistakesCard: some View {
        let costs = Analytics.mistakeCosts(trades, store.data.mistakes)
        let maxCost = costs.map { abs($0.cost) }.max() ?? 0
        let total = costs.reduce(0) { $0 + $1.cost }
        return HealthCard(title: "What Mistakes Cost", symbol: "exclamationmark.triangle.fill", tint: .orange, chevron: false) {
            if costs.isEmpty {
                Text("No mistakes tagged in this view.").font(.subheadline).foregroundStyle(.secondary)
            } else {
                HeadlineValue(value: Fmt.money(total, currency, decimals: 0), color: Color.pnl(total))
                VStack(spacing: 14) {
                    ForEach(costs) { m in
                        RankBar(label: m.tag, sub: ReportText.trades(m.count), share: maxCost > 0 ? abs(m.cost) / maxCost : 0,
                                value: m.cost, currency: currency, tint: m.cost < 0 ? .negative : Color(.systemGray3))
                    }
                }
                .padding(.top, 2)
            }
        }
    }

    // MARK: plan followed

    @ViewBuilder private var planCard: some View {
        if let a = Analytics.planAdherence(trades, store.data.mistakes) {
            let total = Analytics.summarize(trades).net
            let flaggedNet = total - a.cleanNet
            let flagged = a.total - a.clean
            let tint: Color = a.pct >= 80 ? .positive : a.pct >= 60 ? .orange : .negative
            HealthCard(title: "Plan Followed", symbol: "checkmark.seal.fill", tint: tint, chevron: false) {
                HStack(spacing: 16) {
                    RingGauge(fraction: a.pct / 100, tint: tint, lineWidth: 10)
                        .frame(width: 84, height: 84)
                        .overlay {
                            Text(Fmt.pct(a.pct)).font(.system(.title3, design: .rounded, weight: .bold)).monospacedDigit()
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(Fmt.int(a.clean)) of \(ReportText.trades(a.total))").font(.headline).monospacedDigit()
                        Text("had no mistakes tagged").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                HStack(alignment: .top, spacing: 12) {
                    planFigure("Clean Trades", ReportText.trades(a.clean), a.cleanNet)
                    planFigure("Flagged Trades", ReportText.trades(flagged), flaggedNet)
                }
                .padding(.top, 4)
            }
        }
    }

    private func planFigure(_ title: String, _ sub: String, _ net: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            PnLText(value: net, currency: currency, decimals: 0).font(.title3.weight(.semibold))
            Text(sub).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: checklist

    private var checklistCard: some View {
        ReportGroupCard(
            title: "Checklist Against Result", symbol: "checklist", rows: Analytics.byConfluence(trades), currency: currency,
            vertical: true, unit: "per trade",
            emptyText: "Score trades against your checklist to see whether a fuller one pays more.",
            value: { $0.expectancy ?? 0 },
            detail: { r in "\(ReportText.trades(r.count)) · \(Fmt.pct(r.winRate)) won" })
    }
}
