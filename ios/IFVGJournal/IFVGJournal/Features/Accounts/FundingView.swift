import SwiftUI

/// Deposits, withdrawals, payouts and prop-firm fees for the accounts in scope.
/// Pushed inside an existing NavigationStack.
struct FundingView: View {
    @Environment(JournalStore.self) private var store
    @State private var showAdd = false
    @State private var error: String?

    private struct MonthGroup: Identifiable {
        let id: Date
        let items: [FinancialTransaction]
    }

    private var transactions: [FinancialTransaction] {
        let ids = Set(store.scopeAccounts.map(\.id))
        return store.data.transactions
            .filter { t in
                if let id = t.accountId { return ids.contains(id) }
                return store.scope == "all"
            }
            .sorted { $0.date > $1.date }
    }

    private var groups: [MonthGroup] {
        let cal = Calendar.current
        let byMonth = Dictionary(grouping: transactions) { t in
            cal.date(from: cal.dateComponents([.year, .month], from: t.date)) ?? t.date
        }
        return byMonth.map { MonthGroup(id: $0.key, items: $0.value) }.sorted { $0.id > $1.id }
    }

    var body: some View {
        let txs = transactions
        List {
            if !txs.isEmpty {
                Section {
                    FundingSummaryCard(transactions: txs, currency: store.currency)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                ForEach(groups) { group in
                    Section(Fmt.monthYear(group.id)) {
                        ForEach(group.items) { t in
                            FundingRow(transaction: t)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        Task { await Action.run($error) { try await store.deleteTransaction(t.id) } }
                                    } label: { Label("Delete", systemImage: "trash") }
                                }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Funding")
        .navigationBarTitleDisplayMode(.large)
        .overlay {
            if txs.isEmpty {
                EmptyHint(symbol: "banknote", title: "No Transactions",
                          message: "Record deposits, withdrawals, payouts and challenge fees to keep account balances accurate.")
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAdd = true } label: { Label("Add Transaction", systemImage: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { TransactionFormView() }
        .accountErrorAlert($error)
    }
}

// MARK: summary

private struct FundingSummaryCard: View {
    let transactions: [FinancialTransaction]
    let currency: String

    private func total(_ types: [TransactionType]) -> Double {
        transactions.filter { types.contains($0.type) }.reduce(0) { $0 + $1.amount }
    }

    var body: some View {
        HealthCard(title: "Summary", symbol: "banknote.fill", tint: .teal, chevron: false) {
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 14) {
                GridRow {
                    cell("Deposited", total([.deposit]), color: .positive)
                    cell("Withdrawn", total([.withdrawal]), color: .primary)
                }
                GridRow {
                    cell("Payouts", total([.payout]), color: .positive)
                    cell("Fees", total([.challengeFee, .evaluationFee, .fundedAccountFee]), color: .negative)
                }
            }
        }
    }

    private func cell(_ title: String, _ value: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(Fmt.money(value, currency, decimals: 0))
                .font(.title3.weight(.semibold))
                .foregroundStyle(value == 0 ? Color.secondary : color)
                .monospacedDigit()
                .minimumScaleFactor(0.7).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: row

private struct FundingRow: View {
    @Environment(JournalStore.self) private var store
    let transaction: FinancialTransaction

    private var positive: Bool { transaction.type == .deposit || transaction.type == .payout }
    private var account: Account? { store.account(transaction.accountId) }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.type.symbol)
                .font(.title2)
                .foregroundStyle(positive ? Color.positive : Color.negative)
                .frame(width: 32)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.type.label).font(.body.weight(.medium))
                Text(detail).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            }
            Spacer(minLength: 8)
            Text(Fmt.money(positive ? transaction.amount : -transaction.amount, account?.currency ?? store.currency, sign: true))
                .font(.body.weight(.semibold))
                .foregroundStyle(positive ? Color.positive : Color.negative)
                .monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }

    private var detail: String {
        var parts: [String] = []
        if let a = account { parts.append(a.name) }
        parts.append(transaction.date.formatted(.dateTime.month(.abbreviated).day()))
        if let n = transaction.note, !n.isEmpty { parts.append(n) }
        return parts.joined(separator: " · ")
    }
}

// MARK: form

/// Record a deposit, withdrawal, payout or fee. Presented as a sheet; owns its NavigationStack.
struct TransactionFormView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var accountId: String
    @State private var type: TransactionType = .deposit
    @State private var amount = ""
    @State private var date = Date()
    @State private var note = ""
    @State private var saving = false
    @State private var error: String?

    init(defaultAccountId: String? = nil) {
        _accountId = State(initialValue: defaultAccountId ?? "")
    }

    private var amountValue: Double? {
        let t = amount.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        guard let d = Double(t), d.isFinite, d > 0 else { return nil }
        return d
    }
    private var selected: Account? { store.account(accountId) }
    private var canSave: Bool { selected != nil && amountValue != nil && !saving }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Account", selection: $accountId) {
                        ForEach(store.accounts) { Text($0.name).tag($0.id) }
                    }
                    Picker("Type", selection: $type) {
                        ForEach(TransactionType.allCases) { Text($0.label).tag($0) }
                    }
                } footer: {
                    Text(type.balanceSign == 0 ? "Fees are tracked as a cost and don't change the account balance."
                         : type.balanceSign > 0 ? "Adds to the account balance." : "Subtracts from the account balance.")
                }

                Section {
                    LabeledContent("Amount") {
                        HStack(spacing: 4) {
                            Text(Fmt.currencySign(selected?.currency ?? store.currency)).foregroundStyle(.secondary)
                            TextField("0.00", text: $amount)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .monospacedDigit()
                        }
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Note", text: $note, axis: .vertical)
                        .lineLimit(1...3)
                }

                if let error {
                    Section { EmptyView() } footer: {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote).foregroundStyle(Color.negative)
                    }
                }
            }
            .navigationTitle("New Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .buttonStyle(.borderedProminent)
                        .disabled(!canSave)
                }
            }
            .interactiveDismissDisabled(saving)
            .onAppear {
                if store.account(accountId) == nil {
                    accountId = store.scopeAccounts.first?.id ?? store.accounts.first?.id ?? ""
                }
            }
        }
    }

    private func save() {
        guard let value = amountValue, selected != nil else { return }
        let n = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let tx = FinancialTransaction(accountId: accountId, type: type, amount: value, note: n.isEmpty ? nil : n, date: date)
        saving = true
        Task {
            await Action.run($error) { try await store.addTransaction(tx) }
            saving = false
            if error == nil { dismiss() }
        }
    }
}
