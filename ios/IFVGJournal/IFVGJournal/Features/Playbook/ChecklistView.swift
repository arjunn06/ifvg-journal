import SwiftUI

private let checklistCategories = ["Context", "Trigger", "Timing", "Entry", "Risk"]

struct ChecklistView: View {
    @Environment(JournalStore.self) private var store
    @State private var editor: ChecklistEditorTarget?
    @State private var pendingDelete: ConfluenceItem?
    @State private var error: String?

    private var items: [ConfluenceItem] { store.data.confluenceItems }

    private struct Group: Identifiable {
        var id: String { title }
        let title: String
        let items: [ConfluenceItem]
    }

    private var groups: [Group] {
        let general = "General"
        let byTitle = Dictionary(grouping: items) { item -> String in
            playbookTrimmed(item.category ?? "") ?? general
        }
        func rank(_ t: String) -> Int {
            if let i = checklistCategories.firstIndex(where: { $0.caseInsensitiveCompare(t) == .orderedSame }) { return i }
            return t == general ? 1000 : 100
        }
        return byTitle.keys
            .sorted { (rank($0), $0) < (rank($1), $1) }
            .map { Group(title: $0, items: byTitle[$0] ?? []) }
    }

    var body: some View {
        List {
            if !items.isEmpty { summarySection }
            ForEach(groups) { group in
                Section(group.title) {
                    ForEach(group.items) { item in
                        Button { editor = .init(item: item) } label: { ChecklistRow(item: item) }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button("Delete", systemImage: "trash", role: .destructive) { pendingDelete = item }
                                Button("Edit", systemImage: "pencil") { editor = .init(item: item) }.tint(.accentColor)
                            }
                    }
                }
            }
            PlaybookErrorSection(message: error)
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Checklist")
        .overlay {
            if items.isEmpty {
                ContentUnavailableView {
                    Label("No Checklist Items", systemImage: "checklist")
                } description: {
                    Text("Add the conditions you want in place before every trade. Each trade is scored against them.")
                } actions: {
                    Button("New Item") { editor = .init(item: nil) }.buttonStyle(.glassProminent)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { editor = .init(item: nil) } label: { Label("New Item", systemImage: "plus") }
            }
        }
        .sheet(item: $editor) { target in ChecklistItemFormView(item: target.item) }
        .confirmationDialog("Delete Item?", isPresented: deleteBinding, titleVisibility: .visible, presenting: pendingDelete) { item in
            Button("Delete \(item.name)", role: .destructive) {
                Task { await Action.run($error) { try await store.deleteConfluenceItem(item.id) } }
            }
        } message: { _ in
            Text("Past trades keep their scores.")
        }
    }

    private var deleteBinding: Binding<Bool> {
        Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })
    }

    // MARK: summary

    private var summarySection: some View {
        let active = items.filter(\.isActive)
        let total = active.reduce(0) { $0 + $1.weight }
        return Section {
            LabeledContent("Active Items", value: "\(active.count) of \(items.count)")
            LabeledContent("Total Weight", value: playbookPlain(total))
            if let line = finding { Label(line, systemImage: "lightbulb").font(.subheadline) }
        }
        .monospacedDigit()
    }

    private var finding: String? {
        let rows = Analytics.byConfluence(store.scopeTrades).filter { $0.count >= 3 && $0.expectancy != nil }
        guard rows.count >= 2,
              let best = rows.max(by: { ($0.expectancy ?? 0) < ($1.expectancy ?? 0) }),
              let worst = rows.min(by: { ($0.expectancy ?? 0) < ($1.expectancy ?? 0) }),
              best.key != worst.key, let be = best.expectancy, let we = worst.expectancy, be > we else { return nil }
        let c = store.currency
        return "Trades at a fuller checklist pay: \(Fmt.money(be, c, sign: true, decimals: 0)) a trade at \(best.label.lowercased()), against \(Fmt.money(we, c, sign: true, decimals: 0)) at \(worst.label.lowercased())."
    }
}

private struct ChecklistEditorTarget: Identifiable {
    let id = UUID()
    let item: ConfluenceItem?
}

private struct ChecklistRow: View {
    let item: ConfluenceItem
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name).font(.body)
                if let d = playbookTrimmed(item.description ?? "") {
                    Text(d).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            Text("\u{00D7}\(playbookPlain(item.weight))")
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10).padding(.vertical, 3)
                .background(Color(.tertiarySystemFill), in: Capsule())
                .accessibilityLabel("Weight \(playbookPlain(item.weight))")
        }
        .opacity(item.isActive ? 1 : 0.5)
        .contentShape(Rectangle())
    }
}

// MARK: - Form

struct ChecklistItemFormView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let item: ConfluenceItem?

    @State private var name: String
    @State private var details: String
    @State private var category: String
    @State private var weight: Double
    @State private var isActive: Bool
    @State private var saving = false
    @State private var error: String?

    init(item: ConfluenceItem?) {
        self.item = item
        _name = State(initialValue: item?.name ?? "")
        _details = State(initialValue: item?.description ?? "")
        _category = State(initialValue: item?.category ?? "")
        _weight = State(initialValue: item?.weight ?? 1)
        _isActive = State(initialValue: item?.isActive ?? true)
    }

    private var suggestions: [String] {
        var out = checklistCategories
        for c in store.data.confluenceItems.compactMap({ playbookTrimmed($0.category ?? "") })
        where !out.contains(where: { $0.caseInsensitiveCompare(c) == .orderedSame }) { out.append(c) }
        return out
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Item") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $details, axis: .vertical).lineLimit(2...5)
                }
                Section("Category") {
                    TextField("General", text: $category)
                    PlaybookChipRow(options: suggestions, selection: $category)
                }
                Section {
                    Stepper(value: $weight, in: 0.5...5, step: 0.5) {
                        LabeledContent("Weight", value: "\u{00D7}\(playbookPlain(weight))").monospacedDigit()
                    }
                    Toggle("Active", isOn: $isActive)
                } footer: {
                    Text("Heavier items count for more in a trade's confluence score.")
                }
                PlaybookErrorSection(message: error)
            }
            .navigationTitle(item == nil ? "New Item" : "Edit Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save).disabled(playbookTrimmed(name) == nil || saving)
                }
            }
            .interactiveDismissDisabled(saving)
        }
    }

    private func save() {
        var c = item ?? ConfluenceItem(name: "")
        c.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        c.description = playbookTrimmed(details)
        c.category = playbookTrimmed(category)
        c.weight = weight
        c.isActive = isActive
        let isNew = item == nil
        saving = true
        Task {
            await Action.run($error) { try await store.saveConfluenceItem(c, isNew: isNew) }
            saving = false
            if error == nil { dismiss() }
        }
    }
}
