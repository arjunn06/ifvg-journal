import SwiftUI

/// The full journal entry: prices, size, checklist, mistakes, state of mind and notes in a native Form.
/// `trade == nil` creates a new trade.
struct TradeFormView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let trade: Trade?

    // Dollars per point for the futures the form can price on its own (same table as the web form).
    static let pointValue: [String: Double] = ["NQ": 20, "MNQ": 2, "ES": 50, "MES": 5, "GC": 100, "MGC": 10, "CL": 1000, "YM": 5, "MYM": 0.5, "RTY": 50, "M2K": 5]
    static let emotions = ["confident", "nervous", "excited", "fearful", "greedy", "patient", "impatient", "calm", "stressed", "doubtful", "focused", "distracted", "frustrated"]

    @State private var accountId = ""
    @State private var symbol = ""
    @State private var side: Side = .long
    @State private var status: TradeStatus = .closed
    @State private var strategyId: String?
    @State private var session: SessionKey?
    @State private var entryDate = Date()
    @State private var exitDate = Date()
    @State private var entry = "", exit = "", size = "", stop = "", target = ""
    @State private var commission = "", risk = "", result = ""
    @State private var resultEdited = false
    @State private var emotion = ""
    @State private var checks: [String: Bool] = [:]
    @State private var picked: Set<String> = []
    @State private var notes = ""
    @State private var saving = false
    @State private var message: String?

    private var isNew: Bool { trade == nil }
    private func num(_ s: String) -> Double? { Double(s.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)) }
    private var multiplier: Double? { Self.pointValue[symbol.uppercased()] }

    /// P&L implied by the prices, when the instrument's point value is known.
    private var computed: Double? {
        guard let e = num(entry), let x = num(exit), let q = num(size), let m = multiplier else { return nil }
        let gross = (x - e) * (side == .long ? 1 : -1) * m * q
        return (gross - (num(commission) ?? 0)).rounded(to: 2)
    }
    private var valid: Bool {
        !accountId.isEmpty && !symbol.trimmingCharacters(in: .whitespaces).isEmpty && (status == .open || num(result) != nil)
    }
    private var tagOptions: [String] {
        let vocab = store.data.mistakeTags.map(\.name)
        return Array(Set(vocab + DemoData.mistakeTagNames + picked)).sorted()
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Trade") {
                    Picker("Account", selection: $accountId) { ForEach(store.activeAccounts + inactiveCurrent) { Text($0.name).tag($0.id) } }
                    TextField("Symbol", text: $symbol).textInputAutocapitalization(.characters).autocorrectionDisabled()
                    Picker("Side", selection: $side) { ForEach(Side.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
                    Picker("Status", selection: $status) { Text("Closed").tag(TradeStatus.closed); Text("Open").tag(TradeStatus.open) }.pickerStyle(.segmented)
                    Picker("Setup", selection: $strategyId) { Text("None").tag(String?.none); ForEach(store.strategies.filter(\.isActive)) { Text($0.name).tag(String?.some($0.id)) } }
                    Picker("Session", selection: $session) { Text("None").tag(SessionKey?.none); ForEach(SessionKey.allCases) { Text($0.label).tag(SessionKey?.some($0)) } }
                }
                Section("Timing") {
                    DatePicker("Opened", selection: $entryDate)
                    if status == .closed { DatePicker("Closed", selection: $exitDate, in: entryDate...) }
                }
                Section("Prices and Size") {
                    numberRow("Entry Price", $entry); numberRow("Exit Price", $exit, hidden: status == .open)
                    numberRow("Size (Contracts or Lots)", $size)
                    numberRow("Stop Loss", $stop); numberRow("Take Profit", $target)
                    numberRow("Commission", $commission)
                    numberRow("Risk (1R) in \(currency)", $risk)
                }
                if status == .closed {
                    Section {
                        numberRow("Result in \(currency)", $result, onEdit: { resultEdited = true })
                    } footer: {
                        if let c = computed, let m = multiplier {
                            Text("Prices imply \(Fmt.money(c, currency, sign: true)) at \(Fmt.money(m, currency, decimals: m < 1 ? 2 : 0)) per point.")
                        } else { Text("Enter the net result including fees. For known futures it fills in from the prices.") }
                    }
                }
                if !store.data.confluenceItems.filter(\.isActive).isEmpty {
                    Section("Checklist") {
                        ForEach(store.data.confluenceItems.filter(\.isActive)) { item in
                            Toggle(item.name, isOn: Binding(get: { checks[item.id] ?? false }, set: { checks[item.id] = $0 }))
                        }
                    }
                }
                Section("State of Mind") {
                    Picker("Felt", selection: $emotion) { Text("Not Set").tag(""); ForEach(Self.emotions, id: \.self) { Text($0.capitalized).tag($0) } }
                }
                Section("Mistakes") {
                    ForEach(tagOptions, id: \.self) { tag in
                        Button {
                            if picked.contains(tag) { picked.remove(tag) } else { picked.insert(tag) }
                        } label: {
                            HStack { Text(tag).foregroundStyle(.primary); Spacer(); if picked.contains(tag) { Image(systemName: "checkmark").foregroundStyle(Color.accentColor) } }
                        }
                    }
                }
                Section("Notes") { TextField("What happened, what you saw, what you'd change", text: $notes, axis: .vertical).lineLimit(4...12) }
                if let message { Section { Text(message).foregroundStyle(.red).font(.footnote) } }
            }
            .navigationTitle(isNew ? "New Trade" : "Edit Trade")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save", action: save).disabled(!valid || saving)
                }
            }
            .onAppear(perform: load)
            .onChange(of: computed) { _, new in
                if !resultEdited, let new { result = String(new) }
            }
        }
    }

    private var currency: String { store.account(accountId)?.currency ?? store.currency }
    private var inactiveCurrent: [Account] { store.account(trade?.accountId).flatMap { $0.isActive ? nil : [$0] } ?? [] }

    @ViewBuilder
    private func numberRow(_ title: String, _ value: Binding<String>, hidden: Bool = false, onEdit: (() -> Void)? = nil) -> some View {
        if !hidden {
            LabeledContent(title) {
                TextField("0", text: value).keyboardType(.decimalPad).multilineTextAlignment(.trailing).monospacedDigit()
                    .onChange(of: value.wrappedValue) { onEdit?() }
            }
        }
    }

    private func load() {
        guard accountId.isEmpty else { return }
        if let t = trade {
            accountId = t.accountId; symbol = t.symbol; side = t.side; status = t.status == .open ? .open : .closed
            strategyId = t.strategyId; session = t.session; entryDate = t.entryDate; exitDate = t.exitDate ?? t.entryDate
            func s(_ v: Double?) -> String { v.map { $0 == 0 ? "" : String($0) } ?? "" }
            entry = s(t.entryPrice); exit = s(t.exitPrice); size = s(t.quantity); stop = s(t.stopLoss); target = s(t.takeProfit)
            commission = s(t.commission); risk = s(t.riskAmount); result = t.pnl.map { String($0) } ?? ""; resultEdited = t.pnl != nil
            emotion = t.emotions ?? ""; notes = t.notes ?? ""
            checks = store.confluence(for: t)
            picked = Set(store.mistakes(for: t).map(\.tag))
        } else {
            accountId = (store.scope != "all" ? store.scope : nil) ?? store.activeAccounts.first?.id ?? ""
            session = QuickLogLogic.sessionNow()
        }
    }

    private func save() {
        saving = true; message = nil
        let sym = symbol.trimmingCharacters(in: .whitespaces).uppercased()
        let items = store.data.confluenceItems.filter(\.isActive)
        let totalWeight = items.reduce(0) { $0 + $1.weight }
        let presentWeight = items.filter { checks[$0.id] == true }.reduce(0) { $0 + $1.weight }
        let score: Double? = items.isEmpty || checks.isEmpty ? trade?.confluenceScore : (presentWeight / max(totalWeight, 0.0001) * 100).rounded()

        var t = trade ?? Trade(accountId: accountId, symbol: sym, side: side)
        t.accountId = accountId; t.symbol = sym; t.side = side; t.status = status; t.strategyId = strategyId; t.session = session
        t.entryDate = entryDate; t.exitDate = status == .closed ? exitDate : nil
        t.entryPrice = num(entry) ?? 0; t.exitPrice = status == .closed ? num(exit) : nil; t.quantity = num(size) ?? 0
        t.stopLoss = num(stop); t.takeProfit = num(target); t.commission = num(commission)
        t.pnl = status == .closed ? num(result) : nil
        // 1R: typed risk wins; otherwise the distance to the stop, when the point value is known.
        if let r = num(risk) { t.riskAmount = r }
        else if let e = num(entry), let sl = num(stop), let q = num(size), let m = multiplier { t.riskAmount = (abs(e - sl) * m * q).rounded(to: 2) }
        if let e = num(entry), let sl = num(stop), let tp = num(target), e != sl { t.riskReward = (abs(tp - e) / abs(e - sl)).rounded(to: 2) }
        t.emotions = emotion.isEmpty ? nil : emotion
        t.notes = notes.isEmpty ? nil : notes
        t.confluenceScore = score
        if isNew { t.source = "manual" }

        let mistakes = picked.sorted().map { tag in
            TradeMistake(tradeId: t.id, tag: tag, severity: ["Oversized", "Revenge trade", "Ignored the plan"].contains(tag) ? .high : .medium)
        }
        Task {
            defer { saving = false }
            do {
                try await store.saveTrade(t, mistakes: mistakes, confluence: checks.isEmpty ? nil : checks, isNew: isNew)
                dismiss()
            } catch { message = error.localizedDescription }
        }
    }
}
