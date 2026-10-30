import SwiftUI

// Pieces of the log flow that copy Apple's State of Mind sheet: frosted option cards with a caption row, a
// large title and a blue check, glass capsule chips, and a layout that wraps chips like text.

let logTeal = Color(red: 0.20, green: 0.58, blue: 0.70)

struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

/// The frosted rounded card from the reference: caption with an icon, a large title, an optional blue detail line,
/// and a check at the trailing edge when selected.
struct OptionCard: View {
    @Environment(\.colorScheme) private var scheme
    let symbol: String
    let caption: String
    let title: String
    var detail: String?
    var tint: Color = .secondary
    var selected = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Label(caption, systemImage: symbol)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(tint == .secondary ? Color.secondary : tint)
                        .labelStyle(.titleAndIcon)
                    Text(title).font(.title3.weight(.semibold)).foregroundStyle(.primary)
                        .multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                    if let detail { Text(detail).font(.subheadline.weight(.semibold)).foregroundStyle(Color.accentColor) }
                }
                Spacer(minLength: 8)
                if selected {
                    Image(systemName: "checkmark").font(.title2.weight(.semibold)).foregroundStyle(Color.accentColor)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, 24).padding(.vertical, 20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .logCard(cornerRadius: 36, scheme: scheme)
        }
        .buttonStyle(PressableStyle())
        .animation(.snappy, value: selected)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

extension View {
    /// The frosted-white surface used for every card on the log sheet.
    func logCard(cornerRadius: CGFloat = 30, scheme: ColorScheme) -> some View {
        background {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(scheme == .dark ? Color.white.opacity(0.10) : Color.white.opacity(0.66))
        }
        .overlay {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .strokeBorder(Color.white.opacity(scheme == .dark ? 0.12 : 0.7), lineWidth: 0.8)
        }
    }
}

/// A glass capsule that turns solid when picked.
struct LogChip: View {
    let title: String
    var selected = false
    var tint: Color = logTeal
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).font(.title3.weight(.semibold)).padding(.horizontal, 20).padding(.vertical, 8)
        }
        .buttonStyle(ChipStyle(selected: selected, tint: tint))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct ChipStyle: ButtonStyle {
    let selected: Bool
    let tint: Color
    @Environment(\.colorScheme) private var scheme
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(selected ? Color.white : Color.primary)
            .background {
                Capsule().fill(selected ? AnyShapeStyle(tint.gradient) : AnyShapeStyle(scheme == .dark ? Color.white.opacity(0.12) : Color.white.opacity(0.62)))
            }
            .overlay { Capsule().strokeBorder(Color.white.opacity(selected ? 0.35 : 0.6), lineWidth: 0.8) }
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
            .animation(.snappy, value: selected)
    }
}

/// Wraps its children onto rows, centred, like text.
struct FlowLayout: Layout {
    var spacing: CGFloat = 10

    private func rows(_ subviews: Subviews, width: CGFloat) -> [[Int]] {
        var rows: [[Int]] = [[]]
        var x: CGFloat = 0
        for (i, s) in subviews.enumerated() {
            let w = s.sizeThatFits(.unspecified).width
            if x + w > width, !rows[rows.count - 1].isEmpty { rows.append([]); x = 0 }
            rows[rows.count - 1].append(i)
            x += w + spacing
        }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 320
        let rs = rows(subviews, width: width)
        let heights = rs.map { r in r.map { subviews[$0].sizeThatFits(.unspecified).height }.max() ?? 0 }
        return CGSize(width: width, height: heights.reduce(0, +) + spacing * CGFloat(max(0, rs.count - 1)))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for r in rows(subviews, width: bounds.width) {
            let sizes = r.map { subviews[$0].sizeThatFits(.unspecified) }
            let total = sizes.map(\.width).reduce(0, +) + spacing * CGFloat(max(0, r.count - 1))
            var x = bounds.minX + (bounds.width - total) / 2
            for (k, i) in r.enumerated() {
                subviews[i].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sizes[k]))
                x += sizes[k].width + spacing
            }
            y += (sizes.map(\.height).max() ?? 0) + spacing
        }
    }
}

/// The big round glass buttons in the sheet's top corners.
struct GlassCircleButton: View {
    let symbol: String
    let label: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: symbol).font(.title3.weight(.semibold)).foregroundStyle(.primary).frame(width: 46, height: 46)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .accessibilityLabel(label)
    }
}
