import SwiftUI

// Building blocks that follow the system look (the Health app's cards, grouped backgrounds, SF Symbols,
// Liquid Glass controls). Nothing here invents a new visual language; where it goes beyond a stock
// control it copies how the stock one looks.

extension Color {
    static let positive = Color(.systemGreen)
    static let negative = Color(.systemRed)
    static func pnl(_ v: Double?) -> Color {
        guard let v else { return .secondary }
        return v > 0 ? .positive : v < 0 ? .negative : .primary
    }
    static let card = Color(.secondarySystemGroupedBackground)
    static let groupedBackground = Color(.systemGroupedBackground)
}

/// The corner radius iOS 26 uses for large grouped cards.
let cardRadius: CGFloat = 26

struct PnLText: View {
    let value: Double?
    var currency = "USD"
    var decimals = 2
    var signed = true
    var body: some View {
        Text(Fmt.money(value, currency, sign: signed, decimals: decimals))
            .foregroundStyle(Color.pnl(value))
            .monospacedDigit()
    }
}

struct SignedText: View {
    let value: Double?
    var decimals = 2
    var suffix = ""
    var body: some View {
        Text(Fmt.signed(value, decimals: decimals, suffix: suffix)).foregroundStyle(Color.pnl(value)).monospacedDigit()
    }
}

/// The small L / S marker used on trade rows.
struct SideBadge: View {
    let side: Side
    var body: some View {
        Text(side.letter)
            .font(.caption.weight(.bold))
            .foregroundStyle(side == .long ? Color.positive : Color.negative)
            .frame(width: 26, height: 26)
            .background((side == .long ? Color.positive : Color.negative).opacity(0.14), in: Circle())
            .accessibilityLabel(side.label)
    }
}

/// A Health-style card: coloured symbol + title, optional chevron, then content.
struct HealthCard<Content: View>: View {
    let title: String
    let symbol: String
    var tint: Color = .accentColor
    var trailing: String?
    var chevron = true
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: symbol).font(.subheadline.weight(.semibold)).foregroundStyle(tint)
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(tint)
                Spacer(minLength: 4)
                if let trailing { Text(trailing).font(.footnote).foregroundStyle(.secondary) }
                if chevron { Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary) }
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.card, in: RoundedRectangle(cornerRadius: cardRadius, style: .continuous))
    }
}

/// Big number with a small unit, as the Health app prints a headline value.
struct HeadlineValue: View {
    let value: String
    var unit: String?
    var color: Color = .primary
    var size: Font = .system(size: 34, weight: .bold, design: .rounded)
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(value).font(size).foregroundStyle(color).monospacedDigit().minimumScaleFactor(0.6).lineLimit(1)
            if let unit { Text(unit).font(.subheadline.weight(.semibold)).foregroundStyle(.secondary) }
        }
    }
}

/// A horizontal ranked bar, as used for sessions and mistake costs.
struct RankBar: View {
    let label: String
    let sub: String
    let share: Double          // 0...1
    let value: Double?
    var currency = "USD"
    var tint: Color?
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.subheadline.weight(.medium))
                    Text(sub).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                PnLText(value: value, currency: currency, decimals: 0).font(.subheadline.weight(.semibold))
            }
            GeometryReader { g in
                Capsule().fill(Color(.tertiarySystemFill))
                    .overlay(alignment: .leading) {
                        Capsule().fill(tint ?? Color.pnl(value)).frame(width: max(4, g.size.width * min(1, max(0, share))))
                    }
            }
            .frame(height: 6)
        }
    }
}

/// A thin progress track (prop-firm limits).
struct Track: View {
    let fraction: Double
    var tint: Color = .accentColor
    var body: some View {
        GeometryReader { g in
            Capsule().fill(Color(.tertiarySystemFill))
                .overlay(alignment: .leading) { Capsule().fill(tint).frame(width: max(6, g.size.width * min(1, max(0, fraction)))) }
        }
        .frame(height: 8)
    }
}

/// A circular gauge, like the Activity-ring look: used for win rate and plan adherence.
struct RingGauge: View {
    let fraction: Double
    var tint: Color
    var lineWidth: CGFloat = 8
    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.18), lineWidth: lineWidth)
            Circle().trim(from: 0, to: min(1, max(0.001, fraction)))
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

/// The picker that scopes every screen to one account or all of them, shown as an avatar like Health's profile button.
struct AccountScopeMenu: View {
    @Environment(JournalStore.self) private var store
    @Environment(AuthService.self) private var auth
    @Binding var showSettings: Bool

    var body: some View {
        Menu {
            Picker("Account", selection: Binding(get: { store.scope }, set: { store.scope = $0 })) {
                Label("All Accounts", systemImage: "square.stack.3d.up").tag("all")
                ForEach(store.activeAccounts) { a in Text(a.name).tag(a.id) }
            }
            Divider()
            Button { showSettings = true } label: { Label("Settings", systemImage: "gearshape") }
        } label: {
            Image(systemName: store.scope == "all" ? "square.stack.3d.up.fill" : "building.columns.fill")
                .accessibilityLabel("Account: \(store.scopeTitle)")
        }
    }
}

struct PeriodPicker: View {
    @Environment(JournalStore.self) private var store
    var body: some View {
        @Bindable var store = store
        Picker("Period", selection: $store.period) {
            ForEach(Period.allCases) { Text($0.label).tag($0) }
        }
        .pickerStyle(.segmented)
    }
}

struct EmptyHint: View {
    let symbol: String
    let title: String
    let message: String
    var body: some View {
        ContentUnavailableView(title, systemImage: symbol, description: Text(message))
    }
}

/// Settings and the "this is sample data" state.
struct ErrorBanner: View {
    let message: String
    var retry: (() -> Void)?
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 4) {
                Text("Couldn't load your journal").font(.subheadline.weight(.semibold))
                Text(message).font(.footnote).foregroundStyle(.secondary)
                if let retry { Button("Try Again", action: retry).font(.footnote.weight(.semibold)) }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

/// Hide the keyboard from anywhere.
extension View {
    func dismissKeyboardOnScroll() -> some View { scrollDismissesKeyboard(.interactively) }
}

/// Local helper to run an async throwing action and surface its error.
@MainActor
struct Action {
    static func run(_ message: Binding<String?>, _ work: () async throws -> Void) async {
        do { try await work(); message.wrappedValue = nil } catch { message.wrappedValue = error.localizedDescription }
    }
}
