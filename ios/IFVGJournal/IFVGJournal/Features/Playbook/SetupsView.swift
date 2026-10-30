import SwiftUI
import Charts

// MARK: - List

struct SetupsView: View {
    @Environment(JournalStore.self) private var store
    @State private var showNew = false
    @State private var pendingDelete: Strategy?
    @State private var error: String?

    var body: some View {
        List {
            ForEach(store.strategies) { strategy in
                NavigationLink {
                    SetupDetailView(strategy: strategy)
                } label: {
                    SetupRow(strategy: strategy, trades: tradesFor(strategy))
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button("Delete", systemImage: "trash", role: .destructive) { pendingDelete = strategy }
                }
            }
            PlaybookErrorSection(message: error)
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Setups")
        .overlay {
            if store.strategies.isEmpty {
                ContentUnavailableView {
                    Label("No Setups", systemImage: "square.stack.3d.up")
                } description: {
                    Text("Define the strategies you trade, then tag trades with them to see how each one performs.")
                } actions: {
                    Button("New Setup") { showNew = true }.buttonStyle(.glassProminent)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showNew = true } label: { Label("New Setup", systemImage: "plus") }
            }
        }
        .sheet(isPresented: $showNew) { SetupFormView(strategy: nil) }
        .confirmationDialog("Delete Setup?", isPresented: deleteBinding, titleVisibility: .visible, presenting: pendingDelete) { s in
            Button("Delete \(s.name)", role: .destructive) {
                Task { await Action.run($error) { try await store.deleteStrategy(s.id) } }
            }
        } message: { _ in
            Text("Trades tagged with this setup keep their results.")
        }
    }

    private var deleteBinding: Binding<Bool> {
        Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })
    }

    private func tradesFor(_ s: Strategy) -> [Trade] {
        store.scopeTrades.filter { $0.strategyId == s.id }
    }
}

private struct SetupRow: View {
    @Environment(JournalStore.self) private var store
    let strategy: Strategy
    let trades: [Trade]

    var body: some View {
        let s = Analytics.summarize(trades)
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(strategy.name).font(.body.weight(.medium))
                if let tf = strategy.timeframe, !tf.isEmpty {
                    Text(tf)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(Color(.tertiarySystemFill), in: Capsule())
                }
                if !strategy.isActive {
                    Text("Inactive").font(.caption).foregroundStyle(.secondary)
                }
            }
            if s.count == 0 {
                Text("No closed trades yet").font(.subheadline).foregroundStyle(.secondary)
            } else {
                HStack(spacing: 0) {
                    Text("\(s.count) trade\(s.count == 1 ? "" : "s") \u{00B7} \(Fmt.pct(s.winRate)) win rate \u{00B7} ")
                        .foregroundStyle(.secondary)
                    Text(Fmt.money(s.net, store.currency, sign: true, decimals: 0))
                        .foregroundStyle(Color.pnl(s.net))
                }
                .font(.subheadline)
                .monospacedDigit()
            }
        }
        .opacity(strategy.isActive ? 1 : 0.5)
        .padding(.vertical, 2)
    }
}

// MARK: - Detail

struct SetupDetailView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let strategy: Strategy
    @State private var showEdit = false
    @State private var confirmDelete = false
    @State private var error: String?

    /// The live copy, so edits made in the sheet show up here straight away.
    private var current: Strategy { store.strategy(strategy.id) ?? strategy }
    private var trades: [Trade] { store.scopeTrades.filter { $0.strategyId == strategy.id } }

    var body: some View {
        let s = current
        List {
            Section {
                performanceCard
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            } footer: {
                Text("Closed trades in \(store.scopeTitle).")
            }

            if let d = playbookTrimmed(s.description ?? "") {
                Section("Description") { Text(d) }
            }
            if let e = playbookTrimmed(s.entryCriteria ?? "") {
                Section("Entry Criteria") { Text(e) }
            }
            if let x = playbookTrimmed(s.exitCriteria ?? "") {
                Section("Exit Criteria") { Text(x) }
            }
            if let r = playbookTrimmed(s.rules ?? "") {
                Section("Rules") { Text(r) }
            }

            Section("Parameters") {
                LabeledContent("Timeframe", value: playbookTrimmed(s.timeframe ?? "") ?? "—")
                LabeledContent("Risk Per Trade", value: s.riskPerTrade.map { "\(playbookPlain($0))%" } ?? "—")
                LabeledContent("Min Risk:Reward", value: s.minRiskReward.map { "\(playbookPlain($0))R" } ?? "—")
                LabeledContent("Status", value: s.isActive ? "Active" : "Inactive")
            }
            PlaybookErrorSection(message: error)
        }
        .listStyle(.insetGrouped)
        .navigationTitle(s.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button("Edit") { showEdit = true }
                Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
            }
        }
        .sheet(isPresented: $showEdit) { SetupFormView(strategy: s) }
        .confirmationDialog("Delete Setup?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete \(s.name)", role: .destructive) {
                Task {
                    await Action.run($error) { try await store.deleteStrategy(strategy.id) }
                    if error == nil { dismiss() }
                }
            }
        } message: {
            Text("Trades tagged with this setup keep their results.")
        }
    }

    private var performanceCard: some View {
        let s = Analytics.summarize(trades)
        let curve = Analytics.equityCurve(trades)
        let tint: Color = s.net >= 0 ? .positive : .negative
        return HealthCard(title: "Performance", symbol: "chart.line.uptrend.xyaxis", tint: tint,
                          trailing: "\(s.count) trade\(s.count == 1 ? "" : "s")", chevron: false) {
            if s.count == 0 {
                Text("Tag closed trades with this setup to see its results.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Net P&L").font(.caption).foregroundStyle(.secondary)
                        HeadlineValue(value: Fmt.money(s.net, store.currency, sign: true, decimals: 0), color: Color.pnl(s.net))
                    }
                    HStack(alignment: .top) {
                        stat("Win Rate", Fmt.pct(s.winRate))
                        stat("Profit Factor", Fmt.dec(s.profitFactor))
                        stat("Avg R", Fmt.r(s.avgR), color: Color.pnl(s.avgR))
                    }
                    if curve.count >= 2 {
                        Chart(curve) { p in
                            AreaMark(x: .value("Date", p.date), y: .value("Cumulative P&L", p.value))
                                .foregroundStyle(tint.opacity(0.12))
                                .interpolationMethod(.monotone)
                            LineMark(x: .value("Date", p.date), y: .value("Cumulative P&L", p.value))
                                .foregroundStyle(tint)
                                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round))
                                .interpolationMethod(.monotone)
                        }
                        .chartXAxis(.hidden)
                        .chartYAxis {
                            AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
                                AxisGridLine()
                                AxisValueLabel {
                                    if let d = value.as(Double.self) { Text(Fmt.compact(d)).monospacedDigit() }
                                }
                            }
                        }
                        .frame(height: 100)
                        .accessibilityLabel("Cumulative profit and loss")
                    }
                }
            }
        }
    }

    private func stat(_ label: String, _ value: String, color: Color = .primary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.headline).foregroundStyle(color).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Form

struct SetupFormView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let strategy: Strategy?

    @State private var name: String
    @State private var timeframe: String
    @State private var details: String
    @State private var entry: String
    @State private var exit: String
    @State private var rules: String
    @State private var risk: String
    @State private var minRR: String
    @State private var isActive: Bool
    @State private var saving = false
    @State private var error: String?

    init(strategy: Strategy?) {
        self.strategy = strategy
        _name = State(initialValue: strategy?.name ?? "")
        _timeframe = State(initialValue: strategy?.timeframe ?? "")
        _details = State(initialValue: strategy?.description ?? "")
        _entry = State(initialValue: strategy?.entryCriteria ?? "")
        _exit = State(initialValue: strategy?.exitCriteria ?? "")
        _rules = State(initialValue: strategy?.rules ?? "")
        _risk = State(initialValue: strategy?.riskPerTrade.map(playbookPlain) ?? "")
        _minRR = State(initialValue: strategy?.minRiskReward.map(playbookPlain) ?? "")
        _isActive = State(initialValue: strategy?.isActive ?? true)
    }

    private static let timeframes = ["1m", "5m", "15m", "1h", "4h", "Daily"]

    private var invalidNumbers: Bool { playbookIsInvalidNumber(risk) || playbookIsInvalidNumber(minRR) }
    private var canSave: Bool { playbookTrimmed(name) != nil && !invalidNumbers && !saving }

    var body: some View {
        NavigationStack {
            Form {
                Section("Setup") {
                    TextField("Name", text: $name)
                    TextField("Timeframe", text: $timeframe)
                        .textInputAutocapitalization(.never)
                    PlaybookChipRow(options: Self.timeframes, selection: $timeframe)
                }
                Section("Description") {
                    TextField("What is this setup?", text: $details, axis: .vertical).lineLimit(2...6)
                }
                Section("Entry Criteria") {
                    TextField("When do you enter?", text: $entry, axis: .vertical).lineLimit(2...8)
                }
                Section("Exit Criteria") {
                    TextField("When do you exit?", text: $exit, axis: .vertical).lineLimit(2...8)
                }
                Section("Rules") {
                    TextField("Rules to follow", text: $rules, axis: .vertical).lineLimit(3...10)
                }
                Section {
                    LabeledContent("Risk Per Trade") {
                        HStack(spacing: 4) {
                            TextField("Optional", text: $risk)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .monospacedDigit()
                            Text("%").foregroundStyle(.secondary)
                        }
                    }
                    LabeledContent("Min Risk:Reward") {
                        HStack(spacing: 4) {
                            TextField("Optional", text: $minRR)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .monospacedDigit()
                            Text("R").foregroundStyle(.secondary)
                        }
                    }
                    Toggle("Active", isOn: $isActive)
                } footer: {
                    if invalidNumbers {
                        Text("Enter risk and reward as plain numbers, for example 1 or 2.5.").foregroundStyle(.red)
                    }
                }
                PlaybookErrorSection(message: error)
            }
            .navigationTitle(strategy == nil ? "New Setup" : "Edit Setup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save).disabled(!canSave)
                }
            }
            .interactiveDismissDisabled(saving)
        }
    }

    private func save() {
        var s = strategy ?? Strategy(name: "")
        s.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        s.timeframe = playbookTrimmed(timeframe)
        s.description = playbookTrimmed(details)
        s.entryCriteria = playbookTrimmed(entry)
        s.exitCriteria = playbookTrimmed(exit)
        s.rules = playbookTrimmed(rules)
        s.riskPerTrade = playbookNumber(risk)
        s.minRiskReward = playbookNumber(minRR)
        s.isActive = isActive
        let isNew = strategy == nil
        saving = true
        Task {
            await Action.run($error) { try await store.saveStrategy(s, isNew: isNew) }
            saving = false
            if error == nil { dismiss() }
        }
    }
}
