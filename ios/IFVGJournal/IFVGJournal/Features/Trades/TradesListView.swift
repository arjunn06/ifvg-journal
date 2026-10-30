import SwiftUI

/// Every trade in the chosen account(s), newest first, grouped by day, with search and filters.
struct TradesListView: View {
    @Environment(JournalStore.self) private var store
    @State private var query = ""
    @State private var result: ResultFilter = .all
    @State private var side: Side?
    @State private var session: SessionKey?
    @State private var setup: String?
    @State private var deleting: Trade?
    @State private var message: String?

    enum ResultFilter: String, CaseIterable, Identifiable {
        case all = "All Results", wins = "Winners", losses = "Losers", open = "Open"
        var id: String { rawValue }
    }

    private var filtered: [Trade] {
        store.scopeTrades.filter { t in
            switch result {
            case .all: break
            case .wins: guard t.isClosed, t.net > 0 else { return false }
            case .losses: guard t.isClosed, t.net < 0 else { return false }
            case .open: guard t.status == .open else { return false }
            }
            if let side, t.side != side { return false }
            if let session, t.session != session { return false }
            if let setup, t.strategyId != setup { return false }
            if !query.isEmpty {
                let q = query.lowercased()
                let hay = [t.symbol, t.notes ?? "", t.emotions ?? "", store.strategy(t.strategyId)?.name ?? ""].joined(separator: " ").lowercased()
                if !hay.contains(q) { return false }
            }
            return true
        }
        .sorted { $0.entryDate > $1.entryDate }
    }

    private var grouped: [(day: Date, trades: [Trade])] {
        let g = Dictionary(grouping: filtered) { Analytics.startOfDay($0.entryDate) }
        return g.keys.sorted(by: >).map { ($0, g[$0]!) }
    }

    private var filtersActive: Bool { result != .all || side != nil || session != nil || setup != nil }

    var body: some View {
        List {
            if let message { Section { Text(message).foregroundStyle(.red).font(.footnote) } }
            ForEach(grouped, id: \.day) { group in
                Section {
                    ForEach(group.trades) { t in
                        NavigationLink { TradeDetailView(tradeID: t.id) } label: { TradeRow(trade: t) }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) { deleting = t } label: { Label("Delete", systemImage: "trash") }
                            }
                    }
                } header: {
                    HStack {
                        Text(Fmt.relativeDay(group.day))
                        Spacer()
                        PnLText(value: group.trades.filter(\.isClosed).reduce(0) { $0 + $1.net }, currency: store.currency, decimals: 0)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if filtered.isEmpty {
                if store.scopeTrades.isEmpty { EmptyHint(symbol: "list.bullet.rectangle", title: "No Trades Yet", message: "Tap the plus button to log your first trade.") }
                else { ContentUnavailableView.search(text: query) }
            }
        }
        .navigationTitle("Trades")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Symbol, Setup, or Notes")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Result", selection: $result) { ForEach(ResultFilter.allCases) { Text($0.rawValue).tag($0) } }
                    Picker("Side", selection: $side) { Text("Both Sides").tag(Side?.none); ForEach(Side.allCases) { Text($0.label).tag(Side?.some($0)) } }
                    Picker("Session", selection: $session) { Text("All Sessions").tag(SessionKey?.none); ForEach(SessionKey.allCases) { Text($0.label).tag(SessionKey?.some($0)) } }
                    Picker("Setup", selection: $setup) { Text("All Setups").tag(String?.none); ForEach(store.strategies) { Text($0.name).tag(String?.some($0.id)) } }
                    if filtersActive { Button("Clear Filters", role: .destructive) { result = .all; side = nil; session = nil; setup = nil } }
                } label: {
                    Image(systemName: filtersActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                }
            }
        }
        .confirmationDialog("Delete this trade?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible, presenting: deleting) { t in
            Button("Delete \(t.symbol) Trade", role: .destructive) { Task { await Action.run($message) { try await store.deleteTrade(t.id) } } }
        } message: { _ in Text("This also removes its checklist and mistakes. It can't be undone.") }
    }
}
