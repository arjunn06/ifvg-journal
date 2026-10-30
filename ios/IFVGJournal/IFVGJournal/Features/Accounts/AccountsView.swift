import SwiftUI

/// Every account, active or paused. Pushed inside an existing NavigationStack (Browse tab).
struct AccountsView: View {
    @Environment(JournalStore.self) private var store
    @State private var showAdd = false
    @State private var pendingDelete: Account?
    @State private var error: String?

    var body: some View {
        List {
            ForEach(store.accounts) { account in
                NavigationLink {
                    AccountDetailView(account: account)
                } label: {
                    AccountListRow(account: account)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        pendingDelete = account
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                    Button {
                        Task { await Action.run($error) { try await store.setAccountActive(account.id, !account.isActive) } }
                    } label: {
                        if account.isActive {
                            Label("Pause", systemImage: "pause.circle")
                        } else {
                            Label("Resume", systemImage: "play.circle")
                        }
                    }
                    .tint(account.isActive ? .orange : .green)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Accounts")
        .navigationBarTitleDisplayMode(.large)
        .overlay {
            if store.accounts.isEmpty {
                EmptyHint(symbol: "building.columns", title: "No Accounts Yet",
                          message: "Add a trading account to start journaling trades and tracking equity.")
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAdd = true } label: { Label("Add Account", systemImage: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { AccountFormView(account: nil) }
        .confirmationDialog(
            "Delete this account?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { account in
            Button("Delete Account", role: .destructive) {
                Task { await Action.run($error) { try await store.deleteAccount(account.id) } }
            }
            Button("Cancel", role: .cancel) {}
        } message: { account in
            Text("\(account.name) and all of its trades will be removed. This can't be undone.")
        }
        .accountErrorAlert($error)
    }
}

private struct AccountListRow: View {
    @Environment(JournalStore.self) private var store
    let account: Account

    var body: some View {
        let equity = Analytics.accountEquity(account, store.trades, store.data.transactions)
        let net = Analytics.summarize(store.trades.filter { $0.accountId == account.id }).net
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(account.name).font(.headline)
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
                if !account.isActive {
                    Text("Paused").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                Text(Fmt.money(equity, account.currency)).font(.headline).monospacedDigit()
                PnLText(value: net, currency: account.currency).font(.subheadline)
            }
        }
        .opacity(account.isActive ? 1 : 0.55)
        .accessibilityElement(children: .combine)
    }

    private var subtitle: String {
        if let broker = account.broker, !broker.isEmpty { return "\(account.kindLabel) · \(broker)" }
        return account.kindLabel
    }
}

// MARK: shared error alert

private struct AccountErrorAlert: ViewModifier {
    @Binding var message: String?
    func body(content: Content) -> some View {
        content.alert(
            "Something Went Wrong",
            isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(message ?? "")
        }
    }
}

extension View {
    func accountErrorAlert(_ message: Binding<String?>) -> some View {
        modifier(AccountErrorAlert(message: message))
    }
}
