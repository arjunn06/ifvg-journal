import SwiftUI

/// One trade as a list row: side badge, symbol, setup and time, result and R.
struct TradeRow: View {
    @Environment(JournalStore.self) private var store
    let trade: Trade
    var showDate = false

    private var subtitle: String {
        var parts: [String] = []
        parts.append(showDate ? "\(Fmt.day(trade.entryDate)) \(Fmt.time(trade.entryDate))" : Fmt.time(trade.entryDate))
        if let s = store.strategy(trade.strategyId) { parts.append(s.name) } else if let s = trade.session { parts.append(s.label) }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        HStack(spacing: 12) {
            SideBadge(side: trade.side)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(trade.symbol).font(.body.weight(.semibold))
                    if trade.isQuick { Image(systemName: "bolt.fill").font(.caption2).foregroundStyle(.orange).accessibilityLabel("Quick log") }
                }
                Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            if trade.status == .open {
                Text("Open").font(.caption.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Color.orange.opacity(0.18), in: Capsule()).foregroundStyle(.orange)
            } else {
                VStack(alignment: .trailing, spacing: 2) {
                    PnLText(value: trade.pnl, currency: store.account(trade.accountId)?.currency ?? "USD").font(.body.weight(.semibold))
                    if let r = trade.r { SignedText(value: r, suffix: "R").font(.caption) }
                }
            }
        }
        .contentShape(Rectangle())
    }
}
