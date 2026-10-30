import SwiftUI

/// Add or edit an account. Presented as a sheet; owns its NavigationStack.
struct AccountFormView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private let original: Account?

    @State private var name: String
    @State private var accountType: String
    @State private var broker: String
    @State private var currency: String
    @State private var balance: String
    @State private var startDate: Date
    @State private var isActive: Bool
    @State private var isPropFirm: Bool
    @State private var profitTarget: String
    @State private var maxLoss: String
    @State private var dailyLoss: String
    @State private var minDays: String
    @State private var trailing: Bool
    @State private var equityGoal: String
    @State private var saving = false
    @State private var error: String?

    private static let currencies = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"]
    private static let types: [(key: String, label: String)] = [("live", "Live"), ("demo", "Demo"), ("paper", "Paper")]

    init(account: Account?) {
        original = account
        func text(_ v: Double?) -> String {
            guard let v else { return "" }
            return v == v.rounded() ? String(Int(v)) : String(v)
        }
        _name = State(initialValue: account?.name ?? "")
        _accountType = State(initialValue: account?.accountType ?? "live")
        _broker = State(initialValue: account?.broker ?? "")
        _currency = State(initialValue: account?.currency ?? "USD")
        _balance = State(initialValue: account.map { text($0.initialBalance) } ?? "")
        _startDate = State(initialValue: account?.startDate ?? account?.createdAt ?? Date())
        _isActive = State(initialValue: account?.isActive ?? true)
        _isPropFirm = State(initialValue: account?.isPropFirm ?? false)
        _profitTarget = State(initialValue: text(account?.profitTarget))
        _maxLoss = State(initialValue: text(account?.maxLossLimit))
        _dailyLoss = State(initialValue: text(account?.dailyLossLimit))
        _minDays = State(initialValue: account?.minimumTradingDays.map(String.init) ?? "")
        _trailing = State(initialValue: account?.trailingDrawdown ?? false)
        _equityGoal = State(initialValue: text(account?.equityGoal))
    }

    private var isNew: Bool { original == nil }
    private var currencyOptions: [String] {
        Self.currencies.contains(currency) ? Self.currencies : Self.currencies + [currency]
    }

    // MARK: parsing

    private static func number(_ s: String) -> Double? {
        let t = s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        guard !t.isEmpty, let d = Double(t), d.isFinite else { return nil }
        return d
    }
    /// Blank is fine (nil); text that isn't a non-negative number is not.
    private static func optional(_ s: String) -> (value: Double?, valid: Bool) {
        if s.trimmingCharacters(in: .whitespaces).isEmpty { return (nil, true) }
        guard let d = number(s), d >= 0 else { return (nil, false) }
        return (d, true)
    }

    private var balanceValue: Double? { Self.number(balance).flatMap { $0 > 0 ? $0 : nil } }
    private var optionalsValid: Bool {
        if isPropFirm {
            let days = minDays.trimmingCharacters(in: .whitespaces)
            return Self.optional(profitTarget).valid && Self.optional(maxLoss).valid && Self.optional(dailyLoss).valid
                && (days.isEmpty || Int(days) != nil)
        }
        return Self.optional(equityGoal).valid
    }
    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && balanceValue != nil && optionalsValid && !saving
    }

    // MARK: body

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.words)
                    Picker("Type", selection: $accountType) {
                        ForEach(Self.types, id: \.key) { Text($0.label).tag($0.key) }
                    }
                    TextField("Broker", text: $broker)
                        .textInputAutocapitalization(.words)
                    Picker("Currency", selection: $currency) {
                        ForEach(currencyOptions, id: \.self) { Text($0).tag($0) }
                    }
                }

                Section {
                    numberRow("Starting Balance", text: $balance, prompt: "10,000")
                    DatePicker("Start Date", selection: $startDate, displayedComponents: .date)
                    Toggle("Active", isOn: $isActive)
                } footer: {
                    Text("Paused accounts stay in your history but are left out of the All Accounts view.")
                }

                Section {
                    Toggle("Prop Firm Evaluation", isOn: $isPropFirm.animation())
                } footer: {
                    Text("Track a funded-account challenge against its profit target and loss limits.")
                }

                if isPropFirm {
                    Section("Evaluation Rules") {
                        numberRow("Profit Target", text: $profitTarget, prompt: "Optional")
                        numberRow("Max Loss Limit", text: $maxLoss, prompt: "Optional")
                        numberRow("Daily Loss Limit", text: $dailyLoss, prompt: "Optional")
                        LabeledContent("Minimum Trading Days") {
                            TextField("Optional", text: $minDays)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                        }
                        Toggle("Trailing Drawdown", isOn: $trailing)
                    }
                } else {
                    Section {
                        numberRow("Equity Goal", text: $equityGoal, prompt: "Optional")
                    } footer: {
                        Text("A balance to work toward. Progress shows on the account.")
                    }
                }

                if let error {
                    Section { EmptyView() } footer: {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote).foregroundStyle(Color.negative)
                    }
                }
            }
            .navigationTitle(isNew ? "New Account" : "Edit Account")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .buttonStyle(.borderedProminent)
                        .disabled(!canSave)
                }
            }
            .interactiveDismissDisabled(saving)
        }
    }

    private func numberRow(_ title: String, text: Binding<String>, prompt: String) -> some View {
        LabeledContent(title) {
            TextField(prompt, text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
        }
    }

    // MARK: save

    private func save() {
        guard let initial = balanceValue else { return }
        var a = original ?? Account(name: "", initialBalance: initial)
        a.name = name.trimmingCharacters(in: .whitespaces)
        a.accountType = accountType
        let b = broker.trimmingCharacters(in: .whitespaces)
        a.broker = b.isEmpty ? nil : b
        a.currency = currency
        a.initialBalance = initial
        a.startDate = startDate
        a.isActive = isActive
        a.isPropFirm = isPropFirm
        if isPropFirm {
            a.profitTarget = Self.optional(profitTarget).value
            a.maxLossLimit = Self.optional(maxLoss).value
            a.dailyLossLimit = Self.optional(dailyLoss).value
            a.minimumTradingDays = Int(minDays.trimmingCharacters(in: .whitespaces))
            a.trailingDrawdown = trailing
            a.equityGoal = nil
        } else {
            a.equityGoal = Self.optional(equityGoal).value
            a.profitTarget = nil; a.maxLossLimit = nil; a.dailyLossLimit = nil
            a.minimumTradingDays = nil; a.trailingDrawdown = false
        }
        saving = true
        let newAccount = isNew
        Task {
            await Action.run($error) { try await store.saveAccount(a, isNew: newAccount) }
            saving = false
            if error == nil { dismiss() }
        }
    }
}
