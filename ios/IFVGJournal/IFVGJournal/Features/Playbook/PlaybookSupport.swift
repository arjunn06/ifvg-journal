import SwiftUI

// Small helpers shared by the four Playbook screens. Everything here is prefixed so it cannot collide
// with other features.

/// An inline save error, shown as the last section of a Form or List.
struct PlaybookErrorSection: View {
    let message: String?
    var body: some View {
        if let message {
            Section {
                Label(message, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }
}

/// A horizontally scrolling row of suggestion chips that fills a text field above it.
struct PlaybookChipRow: View {
    let options: [String]
    @Binding var selection: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(options, id: \.self) { option in
                    if isSelected(option) {
                        Button(option) { selection = option }
                            .buttonStyle(.glassProminent)
                    } else {
                        Button(option) { selection = option }
                            .buttonStyle(.glass)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 2)
        }
        .controlSize(.small)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
    }

    private func isSelected(_ option: String) -> Bool {
        selection.trimmingCharacters(in: .whitespacesAndNewlines).caseInsensitiveCompare(option) == .orderedSame
    }
}

/// Parses a user-typed decimal ("1,5" and "1.5" both work). Empty means nil; junk also means nil.
func playbookNumber(_ text: String) -> Double? {
    let t = text.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
    guard !t.isEmpty else { return nil }
    return Double(t)
}

/// True when the field has text that is not a number.
func playbookIsInvalidNumber(_ text: String) -> Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && playbookNumber(text) == nil
}

/// A number without a trailing ".0".
func playbookPlain(_ v: Double) -> String {
    v == v.rounded() ? String(Int(v)) : String(v)
}

func playbookTrimmed(_ s: String) -> String? {
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    return t.isEmpty ? nil : t
}
