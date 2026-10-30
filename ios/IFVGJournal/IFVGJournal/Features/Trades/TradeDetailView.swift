import SwiftUI

struct TradeDetailView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let tradeID: String
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var message: String?

    var body: some View {
        Group {
            if let t = store.trade(tradeID) {
                content(t)
            } else {
                EmptyHint(symbol: "questionmark.folder", title: "Trade Not Found", message: "It may have been deleted.")
            }
        }
        .background(Color.groupedBackground)
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func content(_ t: Trade) -> some View {
        let acc = store.account(t.accountId)
        let currency = acc?.currency ?? "USD"
        let mistakes = store.mistakes(for: t)
        let conf = store.confluence(for: t)
        ScrollView {
            VStack(spacing: 12) {
                hero(t, currency)
                if let message { ErrorBanner(message: message) }

                card("Details", "info.circle.fill", .blue) {
                    row("Account", acc?.name ?? "—")
                    row("Setup", store.strategy(t.strategyId)?.name ?? "None")
                    row("Session", t.session?.label ?? "—")
                    row("Opened", "\(Fmt.day(t.entryDate)), \(Fmt.time(t.entryDate))")
                    if t.status == .closed, let x = t.exitDate { row("Closed", "\(Fmt.day(x)), \(Fmt.time(x))") }
                    if !t.isQuick {
                        row("Entry", Fmt.price(t.entryPrice))
                        row("Exit", Fmt.price(t.exitPrice))
                        row("Size", t.quantity == 0 ? "—" : Fmt.dec(t.quantity, 0))
                        row("Stop Loss", Fmt.price(t.stopLoss))
                        row("Take Profit", Fmt.price(t.takeProfit))
                    }
                    if let c = t.commission, c != 0 { row("Commission", Fmt.money(-abs(c), currency)) }
                    if let r = t.riskAmount { row("Risk (1R)", Fmt.money(r, currency)) }
                }

                if let e = t.emotions, !e.isEmpty {
                    card("State of Mind", "heart.fill", .pink) {
                        HStack {
                            Image(systemName: "leaf.fill").foregroundStyle(MoodScale.color(for: e))
                            Text(e.capitalized).font(.title3.weight(.semibold))
                            Spacer()
                        }
                    }
                }

                if let score = t.confluenceScore, !conf.isEmpty {
                    card("Checklist", "checklist", .teal, trailing: Fmt.pct(score)) {
                        ForEach(store.data.confluenceItems.filter { conf[$0.id] != nil }) { item in
                            HStack(spacing: 10) {
                                Image(systemName: conf[item.id] == true ? "checkmark.circle.fill" : "circle").foregroundStyle(conf[item.id] == true ? Color.positive : .secondary)
                                Text(item.name).font(.subheadline)
                                Spacer()
                            }
                        }
                    }
                }

                if !mistakes.isEmpty {
                    card("Mistakes", "exclamationmark.triangle.fill", .red) {
                        ForEach(mistakes) { m in
                            HStack {
                                Text(m.tag).font(.subheadline.weight(.medium))
                                Spacer()
                                Text(m.severity.rawValue.capitalized).font(.caption.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Color.red.opacity(0.12), in: Capsule()).foregroundStyle(.red)
                            }
                        }
                    }
                }

                if let n = t.notes, !n.isEmpty {
                    card("Notes", "note.text", .orange) { Text(n).font(.body).fixedSize(horizontal: false, vertical: true) }
                }

                if t.isQuick {
                    Button { editing = true } label: { Label("Add Prices and Details", systemImage: "square.and.pencil").frame(maxWidth: .infinity) }
                        .buttonStyle(.glass).controlSize(.large)
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 24)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { editing = true } label: { Label("Edit", systemImage: "pencil") }
                    Button(role: .destructive) { confirmDelete = true } label: { Label("Delete", systemImage: "trash") }
                } label: { Image(systemName: "ellipsis") }
            }
        }
        .sheet(isPresented: $editing) { TradeFormView(trade: t) }
        .confirmationDialog("Delete this trade?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete Trade", role: .destructive) {
                Task {
                    await Action.run($message) { try await store.deleteTrade(t.id) }
                    if message == nil { dismiss() }
                }
            }
        } message: { Text("This also removes its checklist and mistakes. It can't be undone.") }
    }

    private func hero(_ t: Trade, _ currency: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                SideBadge(side: t.side)
                Text("\(t.symbol) \(t.side.label)").font(.title3.weight(.semibold))
                Spacer()
                if t.status == .open { Text("Open").font(.caption.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 3).background(Color.orange.opacity(0.18), in: Capsule()).foregroundStyle(.orange) }
            }
            if t.status == .open {
                HeadlineValue(value: "In Trade", color: .orange)
            } else {
                HeadlineValue(value: Fmt.money(t.pnl, currency, sign: true), color: Color.pnl(t.pnl))
                if let r = t.r { Text("\(Fmt.r(r)) on \(Fmt.money(t.riskAmount, currency, decimals: 0)) risked").font(.subheadline).foregroundStyle(.secondary) }
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.card, in: RoundedRectangle(cornerRadius: cardRadius, style: .continuous))
    }

    private func card<C: View>(_ title: String, _ symbol: String, _ tint: Color, trailing: String? = nil, @ViewBuilder _ content: () -> C) -> some View {
        HealthCard(title: title, symbol: symbol, tint: tint, trailing: trailing, chevron: false) { VStack(alignment: .leading, spacing: 10) { content() } }
    }
    private func row(_ k: String, _ v: String) -> some View {
        HStack { Text(k).foregroundStyle(.secondary); Spacer(); Text(v).monospacedDigit() }.font(.subheadline)
    }
}
