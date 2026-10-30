import SwiftUI

struct NotesView: View {
    @Environment(JournalStore.self) private var store
    @State private var search = ""
    @State private var category: String?
    @State private var editor: NoteEditorTarget?
    @State private var pendingDelete: Note?
    @State private var error: String?

    private var notes: [Note] { store.data.notes }

    private var filtered: [Note] {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines)
        return notes
            .filter { category == nil || $0.category == category }
            .filter { n in
                q.isEmpty || n.title.localizedCaseInsensitiveContains(q) || n.content.localizedCaseInsensitiveContains(q)
                    || n.tags.contains { $0.localizedCaseInsensitiveContains(q) }
            }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    private var categories: [String] {
        var out = Note.categories
        for c in notes.map(\.category) where !out.contains(c) { out.append(c) }
        return out
    }

    var body: some View {
        let shown = filtered
        let pinned = shown.filter(\.isFavorite)
        let rest = shown.filter { !$0.isFavorite }
        List {
            if !pinned.isEmpty {
                Section("Favorites") { ForEach(pinned) { row($0) } }
            }
            if !rest.isEmpty {
                Section(pinned.isEmpty ? "" : "Notes") { ForEach(rest) { row($0) } }
            }
            PlaybookErrorSection(message: error)
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Notes")
        .searchable(text: $search, prompt: "Search Notes")
        .overlay {
            if notes.isEmpty {
                ContentUnavailableView {
                    Label("No Notes", systemImage: "note.text")
                } description: {
                    Text("Write down trade ideas, lessons and market analysis.")
                } actions: {
                    Button("New Note") { editor = .init(note: nil) }.buttonStyle(.glassProminent)
                }
            } else if shown.isEmpty {
                if search.isEmpty {
                    ContentUnavailableView("No Notes in This Category", systemImage: "note.text")
                } else {
                    ContentUnavailableView.search(text: search)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .secondaryAction) {
                Menu {
                    Picker("Category", selection: $category) {
                        Text("All Categories").tag(String?.none)
                        ForEach(categories, id: \.self) { Text($0).tag(String?.some($0)) }
                    }
                } label: {
                    Label("Filter", systemImage: category == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button { editor = .init(note: nil) } label: { Label("New Note", systemImage: "plus") }
            }
        }
        .sheet(item: $editor) { target in NoteEditorView(note: target.note) }
        .confirmationDialog("Delete Note?", isPresented: deleteBinding, titleVisibility: .visible, presenting: pendingDelete) { n in
            Button("Delete Note", role: .destructive) {
                Task { await Action.run($error) { try await store.deleteNote(n.id) } }
            }
        } message: { n in
            Text("\u{201C}\(n.title.isEmpty ? "Untitled" : n.title)\u{201D} will be removed.")
        }
    }

    private var deleteBinding: Binding<Bool> {
        Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } })
    }

    private func row(_ note: Note) -> some View {
        Button { editor = .init(note: note) } label: { NoteRow(note: note) }
            .buttonStyle(.plain)
            .swipeActions(edge: .leading) {
                Button(note.isFavorite ? "Unfavorite" : "Favorite", systemImage: note.isFavorite ? "star.slash" : "star") {
                    var n = note
                    n.isFavorite.toggle()
                    Task { await Action.run($error) { try await store.saveNote(n, isNew: false) } }
                }
                .tint(.yellow)
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button("Delete", systemImage: "trash", role: .destructive) { pendingDelete = note }
            }
    }
}

private struct NoteEditorTarget: Identifiable {
    let id = UUID()
    let note: Note?
}

private struct NoteRow: View {
    let note: Note
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(note.title.isEmpty ? "Untitled" : note.title).font(.headline).lineLimit(1)
                Spacer(minLength: 4)
                if note.isFavorite {
                    Image(systemName: "star.fill").font(.caption).foregroundStyle(.yellow).accessibilityLabel("Favorite")
                }
            }
            if !note.content.isEmpty {
                Text(note.content).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            }
            HStack(spacing: 4) {
                Text(note.category)
                Text("·")
                Text(note.updatedAt, format: .relative(presentation: .named, unitsStyle: .wide))
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            if !note.tags.isEmpty {
                Text(note.tags.map { "#\($0)" }.joined(separator: "  "))
                    .font(.caption)
                    .foregroundStyle(Color.accentColor)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}

// MARK: - Editor

struct NoteEditorView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let note: Note?

    @State private var title: String
    @State private var content: String
    @State private var category: String
    @State private var tagsText: String
    @State private var isFavorite: Bool
    @State private var saving = false
    @State private var confirmDiscard = false
    @State private var error: String?
    @FocusState private var focus: Field?

    private enum Field { case title, body }

    init(note: Note?) {
        self.note = note
        _title = State(initialValue: note?.title ?? "")
        _content = State(initialValue: note?.content ?? "")
        _category = State(initialValue: note?.category ?? "General")
        _tagsText = State(initialValue: (note?.tags ?? []).joined(separator: ", "))
        _isFavorite = State(initialValue: note?.isFavorite ?? false)
    }

    private var tags: [String] {
        var out: [String] = []
        for part in tagsText.split(whereSeparator: { $0 == "," || $0 == "\n" }) {
            var t = part.trimmingCharacters(in: .whitespacesAndNewlines)
            while t.hasPrefix("#") { t.removeFirst() }
            if !t.isEmpty, !out.contains(where: { $0.caseInsensitiveCompare(t) == .orderedSame }) { out.append(t) }
        }
        return out
    }

    private var categories: [String] {
        var out = Note.categories
        for c in store.data.notes.map(\.category) + [category] where !out.contains(c) { out.append(c) }
        return out
    }

    private var isEmpty: Bool { playbookTrimmed(title) == nil && playbookTrimmed(content) == nil }
    private var isDirty: Bool {
        guard let note else { return !isEmpty }
        return title != note.title || content != note.content || category != note.category
            || tags != note.tags || isFavorite != note.isFavorite
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 10) {
                    TextField("Title", text: $title, axis: .vertical)
                        .font(.largeTitle.weight(.bold))
                        .lineLimit(1...3)
                        .focused($focus, equals: .title)
                        .submitLabel(.next)
                        .onSubmit { focus = .body }
                    HStack(spacing: 8) {
                        Picker("Category", selection: $category) {
                            ForEach(categories, id: \.self) { Text($0).tag($0) }
                        }
                        .labelsHidden()
                        .buttonStyle(.glass)
                        Image(systemName: "number").foregroundStyle(.secondary).accessibilityHidden(true)
                        TextField("Tags, separated by commas", text: $tagsText)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .font(.subheadline)
                    }
                    if let error {
                        Label(error, systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(.red)
                    }
                    Divider()
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)

                TextEditor(text: $content)
                    .focused($focus, equals: .body)
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, 15)
                    .overlay(alignment: .topLeading) {
                        if content.isEmpty {
                            Text("Start writing")
                                .foregroundStyle(.tertiary)
                                .padding(.horizontal, 20).padding(.top, 8)
                                .allowsHitTesting(false)
                        }
                    }
            }
            .background(Color(.systemBackground))
            .navigationTitle(note == nil ? "New Note" : "Edit Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { if isDirty { confirmDiscard = true } else { dismiss() } }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button { isFavorite.toggle() } label: {
                        Label(isFavorite ? "Unfavorite" : "Favorite", systemImage: isFavorite ? "star.fill" : "star")
                    }
                    .tint(isFavorite ? .yellow : nil)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: done).disabled(saving)
                }
            }
            .confirmationDialog("Discard Changes?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Discard Changes", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            }
            .interactiveDismissDisabled(isDirty)
            .onAppear { if note == nil { focus = .title } }
        }
    }

    private func done() {
        guard isDirty, !(note == nil && isEmpty) else { dismiss(); return }
        var n = note ?? Note(title: "", content: "")
        n.title = playbookTrimmed(title) ?? "Untitled"
        n.content = content
        n.category = category
        n.tags = tags
        n.isFavorite = isFavorite
        let isNew = note == nil
        saving = true
        Task {
            await Action.run($error) { try await store.saveNote(n, isNew: isNew) }
            saving = false
            if error == nil { dismiss() }
        }
    }
}
