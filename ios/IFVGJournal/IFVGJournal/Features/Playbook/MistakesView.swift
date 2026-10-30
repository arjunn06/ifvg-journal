import SwiftUI

private let mistakeCategories = ["Psychology", "Risk", "Process"]

/// One line in the Mistakes list: a vocabulary tag, or a tag found only on trades.
private struct MistakeEntry: Identifiable {
    var id: String { name.lowercased() }
    let name: String
    let category: String?
    let tagId: String?          // nil when the tag is not in the vocabulary (cannot be deleted)
    let count: Int
    let cost: Double            // zero or negative
}

struct MistakesView: View {
    @Environment(JournalStore.self) private var store
    @State private var showNew = false
    @State private var pendingDelete: MistakeEntry?
    @State private var error: String?

    private var entries: [MistakeEntry] {
        let costs = Analytics.mistakeCosts(store.scopeTrades, store.data.mistakes)
        var byName = Dictionary(costs.map { ($0.tag.lowercased(), $0) }, uniquingKeysWith: { a, _ in a })
        var out: [MistakeEntry] = []
        for tag in store.data.mistakeTags {
            let row = byName.removeValue(forKey: tag.name.lowercased())
            out.append(MistakeEntry(name: tag.name, category: playbookTrimmed(tag.category ?? ""), tagId: tag.id,
                                    count: row?.count ?? 0, cost: row?.cost ?? 0))
        }
        for row in byName.values where !row.tag.isEmpty {
            out.append(MistakeEntry(name: row.tag, category: nil, tagId: nil, count: row.count, cost: row.cost))
        }
        return out
    }

    private struct Group: Identifiable {
        var id: String { title }
        let title: String
        let entries: [MistakeEntry]
    }

    private func grouped(_ entries: [MistakeEntry]) -> [Group] {
        let other = "Other"
        let byTitle = Dictionary(grouping: entries) { $0.category ?? other }
        func rank(_ t: String) -> Int {
            if let i = mistakeCategories.firstIndex(where: { $0.caseInsensitiveCompare(t) == .orderedSame }) { return i }
            return t == other ? 1000 : 100
        }
        return byTitle.keys.sorted { (rank($0), $0) < (rank($1), $1) }.map { title in
            Group(title: title, entries: (byTitle[title] ?? []).sorted {
                $0.cost != $1.cost ? $0.cost < $1.cost : $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            })
        }
    }

    var body: some View {
        let all = entries
        List {
            Section {
                summaryCard
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            ForEach(grouped(all)) { group in
                Section(group.title) {
                    ForEach(group.entries) { entry in
                        MistakeEntryRow(entry: entry, currency: store.currency)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                if entry.tagId != nil {
                                    Button("Delete", systemImage: "trash", role: .destructive) { pendingDelete = entry }
                                }
                            }
                    }
                }
            }
            PlaybookErrorSection(message: error)
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Mistakes")
        .overlay {
            if all.isEmpty && store.scopeTrades.isEmpty {
                ContentUnavailableView {
                    Label("No Mistake Tags", systemImage: "exclamationmark.bubble")
                } description: {
                    Text("Add the habits you want to stop. Tag them on trades to see what each one costs.")
                } actions: {
                    Button("New Tag") { showNew = true }.buttonStyle(.glassProminent)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showNew = true } label: { Label("New Tag", systemImage: "plus") }
            }
        }
        .sheet(isPresented: $showNew) { MistakeTagFormView() }
        .confirmationDialog("Delete Tag?", isPresented: deleteBinding, titleVisibility: .visible, presenting: pendingDelete) { e in
            Button("Delete \(e.name)", role: .destructive) {
                if let id = e.tagId { Task { await Action.run($error) { try await store.deleteMistakeTag(id) } } }
            }
        } message: { _ in
            Text("Trades already tagged with it keep the tag.")
        }
    }

    private var deleteBinding: Binding<Bool> {
        Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })
    }

    // MARK: summary

    private var summaryCard: some View {
        let adherence = Analytics.planAdherence(store.scopeTrades, store.data.mistakes)
        let flagged = Set(store.data.mistakes.map(\.tradeId))
        let losers = store.scopeTrades.filter { $0.isClosed && $0.net < 0 && flagged.contains($0.id) }
        let cost = losers.reduce(0) { $0 + $1.net }
        let pct = adherence?.pct ?? 0
        let tint: Color = pct >= 80 ? .positive : pct >= 60 ? .orange : .negative
        return HealthCard(title: "Plan Followed", symbol: "checkmark.seal.fill", tint: tint, trailing: store.scopeTitle, chevron: false) {
            if let adherence {
                HStack(alignment: .center, spacing: 18) {
                    ZStack {
                        RingGauge(fraction: pct / 100, tint: tint, lineWidth: 10)
                        Text(Fmt.pct(pct)).font(.headline).monospacedDigit()
                    }
                    .frame(width: 84, height: 84)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Plan followed \(Fmt.pct(pct))")

                    VStack(alignment: .leading, spacing: 10) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Clean Trades").font(.caption).foregroundStyle(.secondary)
                            Text("\(adherence.clean) of \(adherence.total)").font(.headline).monospacedDigit()
                        }
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Cost of Mistakes").font(.caption).foregroundStyle(.secondary)
                            if losers.isEmpty {
                                Text("None").font(.headline).foregroundStyle(.secondary)
                            } else {
                                PnLText(value: cost, currency: store.currency, decimals: 0).font(.headline)
                                Text("\(losers.count) losing trade\(losers.count == 1 ? "" : "s") tagged")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }
            } else {
                Text("Close and tag trades to see how often you follow your plan.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

private struct MistakeEntryRow: View {
    let entry: MistakeEntry
    let currency: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name).font(.body)
                Text(entry.count == 0 ? "No trades" : "\(entry.count) trade\(entry.count == 1 ? "" : "s")")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            if entry.cost < 0 {
                PnLText(value: entry.cost, currency: currency, decimals: 0).font(.body.weight(.semibold))
            } else {
                Text("\u{2014}").foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - New tag

private struct MistakeTagFormView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var category = ""
    @State private var saving = false
    @State private var error: String?

    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var duplicate: Bool {
        store.data.mistakeTags.contains { $0.name.caseInsensitiveCompare(trimmed) == .orderedSame }
    }
    private var suggestions: [String] {
        var out = mistakeCategories
        for c in store.data.mistakeTags.compactMap({ playbookTrimmed($0.category ?? "") })
        where !out.contains(where: { $0.caseInsensitiveCompare(c) == .orderedSame }) { out.append(c) }
        return out
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                } footer: {
                    if duplicate { Text("A tag with this name already exists.").foregroundStyle(.red) }
                }
                Section("Category") {
                    TextField("Other", text: $category)
                    PlaybookChipRow(options: suggestions, selection: $category)
                }
                PlaybookErrorSection(message: error)
            }
            .navigationTitle("New Tag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save).disabled(trimmed.isEmpty || duplicate || saving)
                }
            }
            .interactiveDismissDisabled(saving)
        }
        .presentationDetents([.medium, .large])
    }

    private func save() {
        let n = trimmed
        let c = playbookTrimmed(category)
        saving = true
        Task {
            await Action.run($error) { try await store.addMistakeTag(name: n, category: c) }
            saving = false
            if error == nil { dismiss() }
        }
    }
}
