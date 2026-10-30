import SwiftUI

@Observable @MainActor
final class QuickLogModel {
    enum Step: Hashable { case mode, account, pair, side, setup, result, size, mood, why, save, done }
    var step: Step = .mode
    var forward = true
    var full = false
    var accountId = ""
    var symbol = ""
    var side: Side?
    var strategyId: String?
    var result: TradeResult?
    var r: Double?
    var amount = ""
    var mood = 0.5
    var reasons: Set<String> = []
    var wins: Set<String> = []
    var custom = ""
    var note = ""
    var saving = false
    var error: String?
    var saved: (id: String, text: String)?
}

/// "Log a Trade": the interactive flow behind the plus button, built like Apple's Log an Emotion or Mood sheet.
/// Large titles, frosted option cards, a teal Next button, and a flower that blooms with how you felt.
struct QuickLogFlow: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var m = QuickLogModel()
    @State private var showFull = false
    @State private var tradeCountBeforeFull = 0
    @FocusState private var focus: Bool

    // MARK: derived

    private var active: [Account] { store.activeAccounts }
    private var acc: Account? { store.account(m.accountId) }
    private var currency: String { acc?.currency ?? store.currency }
    private var risk: Double? { QuickLogLogic.usualRisk(store.trades, accountId: m.accountId) }
    private var symbols: [String] { QuickLogLogic.recentSymbols(store.trades.filter { m.accountId.isEmpty || $0.accountId == m.accountId }) }
    private var askAccount: Bool { store.scope == "all" && active.count > 1 }
    private var hasSetups: Bool { store.strategies.contains(where: \.isActive) }

    private var flow: [QuickLogModel.Step] {
        var f: [QuickLogModel.Step] = [.mode]
        if askAccount { f.append(.account) }
        f += [.pair, .side]
        if hasSetups { f.append(.setup) }
        f.append(.result)
        if m.result != .flat { f.append(.size) }
        f.append(.mood)
        if m.result != .flat { f.append(.why) }
        f.append(.save)
        return f
    }
    private var idx: Int { max(0, flow.firstIndex(of: m.step) ?? 0) }

    private var typed: Double? { Double(m.amount.replacingOccurrences(of: ",", with: ".")) }
    /// A typed amount wins; otherwise R times the usual risk.
    private var pnl: Double? {
        if m.result == .flat { return 0 }
        if let t = typed, t > 0 { return m.result == .loss ? -t : t }
        if let r = m.r, let risk { return (r * risk * 100).rounded() / 100 }
        return nil
    }
    private var rShown: Double? {
        if m.result == .flat { return 0 }
        if let r = m.r { return r }
        if let p = pnl, let risk, risk > 0 { return (p / risk * 100).rounded() / 100 }
        return nil
    }
    private var chosenReasons: [LossReason] { QuickLogLogic.lossReasons.filter { m.reasons.contains($0.id) } }
    private var customText: String { let t = m.custom.trimmingCharacters(in: .whitespaces); return t.prefix(1).uppercased() + t.dropFirst() }

    private var canNext: Bool {
        switch m.step {
        case .mode, .setup, .mood, .done: true
        case .account: !m.accountId.isEmpty
        case .pair: !m.symbol.trimmingCharacters(in: .whitespaces).isEmpty
        case .side: m.side != nil
        case .result: m.result != nil
        case .size: pnl != nil && pnl != 0
        case .why: m.result == .win ? true : (!m.reasons.isEmpty || !customText.isEmpty)
        case .save: pnl != nil && !m.saving
        }
    }

    // MARK: body

    var body: some View {
        ZStack {
            background
            VStack(spacing: 0) {
                topBar
                ZStack {
                    page
                        .id(m.step)
                        .transition(.asymmetric(
                            insertion: .move(edge: m.forward ? .trailing : .leading).combined(with: .opacity),
                            removal: .move(edge: m.forward ? .leading : .trailing).combined(with: .opacity)))
                }
                .frame(maxHeight: .infinity)
                .clipped()
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { footer }
        .presentationBackground(Color(.systemBackground))
        .presentationDragIndicator(.hidden)
        .interactiveDismissDisabled(m.step != .mode && m.step != .done)
        .tint(Color(red: 0.0, green: 0.48, blue: 1.0))
        .sensoryFeedback(.selection, trigger: MoodScale.index(m.mood))
        .sensoryFeedback(.success, trigger: m.saved?.id)
        .onAppear {
            m.accountId = (store.scope != "all" && active.contains { $0.id == store.scope }) ? store.scope : (active.first?.id ?? "")
        }
        .sheet(isPresented: $showFull, onDismiss: { if store.trades.count > tradeCountBeforeFull { dismiss() } }) { TradeFormView(trade: nil) }
    }

    // MARK: chrome

    private var background: some View {
        let top: Color = scheme == .dark ? Color(red: 0.09, green: 0.14, blue: 0.16) : Color(red: 0.84, green: 0.88, blue: 0.88)
        let bottom: Color = scheme == .dark ? Color(red: 0.05, green: 0.10, blue: 0.13) : Color(red: 0.73, green: 0.83, blue: 0.86)
        return ZStack {
            LinearGradient(colors: [top, bottom], startPoint: .top, endPoint: .bottom)
            if m.step == .mood {
                MoodScale.color(m.mood, saturation: 0.55).opacity(scheme == .dark ? 0.22 : 0.30).blendMode(scheme == .dark ? .plusLighter : .normal)
            }
        }
        .ignoresSafeArea()
        .animation(.smooth(duration: 0.4), value: m.step)
    }

    private var topBar: some View {
        HStack {
            GlassCircleButton(symbol: "chevron.left", label: "Back", action: back)
                .opacity(idx == 0 || m.step == .done ? 0 : 1).disabled(idx == 0 || m.step == .done)
            Spacer()
            Capsule().fill(.primary.opacity(0.12)).frame(width: 96, height: 4)
                .overlay(alignment: .leading) {
                    GeometryReader { g in
                        Capsule().fill(logTeal).frame(width: g.size.width * (m.step == .done ? 1 : Double(idx) / Double(max(1, flow.count - 1))))
                    }
                }
                .accessibilityElement().accessibilityLabel("Step \(idx + 1) of \(flow.count)")
                .opacity(m.step == .done ? 0 : 1)
            Spacer()
            GlassCircleButton(symbol: "xmark", label: "Close") { dismiss() }
        }
        .padding(.horizontal, 20).padding(.top, 20).padding(.bottom, 6)
        .animation(.smooth, value: idx)
    }

    private var footer: some View {
        VStack(spacing: 12) {
            if let e = m.error { Text(e).font(.footnote).foregroundStyle(.red) }
            if m.step == .done {
                HStack(spacing: 12) {
                    Button { goDetails() } label: { Text("Add Details").font(.headline).frame(maxWidth: .infinity, minHeight: 50) }
                        .buttonStyle(.glass)
                    Button { another() } label: { Text("Log Another").font(.headline).frame(maxWidth: .infinity, minHeight: 50) }
                        .buttonStyle(.glassProminent).tint(logTeal)
                }
                .padding(.horizontal, 28)
            } else {
                Button(action: primary) {
                    Group {
                        if m.saving { ProgressView().tint(.white) }
                        else { Text(m.step == .save ? "Save to Journal" : "Next").font(.title3.weight(.semibold)) }
                    }
                    .frame(maxWidth: .infinity).frame(height: 56)
                }
                .buttonStyle(.glassProminent).tint(logTeal).disabled(!canNext)
                .padding(.horizontal, 48)
                if m.step == .setup || (m.step == .why && m.result == .win && m.wins.isEmpty && customText.isEmpty) {
                    Button("Skip") { if m.step == .setup { m.strategyId = nil }; next() }
                        .font(.body.weight(.medium)).foregroundStyle(logTeal)
                }
            }
        }
        .padding(.top, 8).padding(.bottom, 12)
        .animation(.smooth, value: m.step)
    }

    // MARK: pages

    @ViewBuilder
    private var page: some View {
        switch m.step {
        case .mode: modePage
        case .account: accountPage
        case .pair: pairPage
        case .side: sidePage
        case .setup: setupPage
        case .result: resultPage
        case .size: sizePage
        case .mood: moodPage
        case .why: whyPage
        case .save: savePage
        case .done: donePage
        }
    }

    private func pageScroll<C: View>(_ title: String, subtitle: String? = nil, hero: AnyView? = nil, @ViewBuilder _ content: () -> C) -> some View {
        ScrollView {
            VStack(spacing: 22) {
                if let hero { hero.padding(.top, 8) }
                VStack(spacing: 8) {
                    Text(title).font(.system(size: 34, weight: .bold)).multilineTextAlignment(.center).minimumScaleFactor(0.8)
                        .fixedSize(horizontal: false, vertical: true)
                    if let subtitle { Text(subtitle).font(.body).foregroundStyle(.secondary).multilineTextAlignment(.center) }
                }
                .padding(.top, hero == nil ? 24 : 0)
                content()
            }
            .padding(.horizontal, 22).padding(.bottom, 24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
    }

    private var modePage: some View {
        pageScroll("Log a Trade", hero: AnyView(FlowerCluster())) {
            VStack(spacing: 14) {
                OptionCard(symbol: "bolt.fill", caption: "Quick Log", title: "Pair, result, and how you felt", detail: "About 20 seconds", selected: !m.full) { m.full = false }
                OptionCard(symbol: "square.and.pencil", caption: "Full Journal", title: "Prices, checklist, and notes", selected: m.full) { m.full = true }
            }
        }
    }

    private var accountPage: some View {
        pageScroll("Which Account?") {
            VStack(spacing: 12) {
                ForEach(active) { a in
                    OptionCard(symbol: a.isPropFirm ? "flag.checkered" : "building.columns.fill", caption: a.kindLabel, title: a.name,
                               detail: Fmt.money(Analytics.accountEquity(a, store.trades, store.data.transactions), a.currency, decimals: 0),
                               selected: m.accountId == a.id) { m.accountId = a.id; advance(from: .account) }
                }
            }
        }
    }

    private var pairPage: some View {
        pageScroll("What Did You Trade?") {
            VStack(spacing: 22) {
                if !symbols.isEmpty {
                    FlowLayout(spacing: 10) {
                        ForEach(symbols, id: \.self) { s in
                            LogChip(title: s, selected: m.symbol == s) { m.symbol = s; focus = false; advance(from: .pair) }
                        }
                    }
                }
                TextField(symbols.isEmpty ? "Type the pair, like NQ or EURUSD" : "Or type another pair", text: Binding(
                    get: { symbols.contains(m.symbol) ? "" : m.symbol },
                    set: { m.symbol = $0.uppercased().filter { $0.isLetter || $0.isNumber || "._/-".contains($0) }.prefix(14).description }))
                    .focused($focus)
                    .font(.title3.weight(.semibold)).multilineTextAlignment(.center)
                    .textInputAutocapitalization(.characters).autocorrectionDisabled()
                    .submitLabel(.next).onSubmit { if canNext { next() } }
                    .padding(.vertical, 18).padding(.horizontal, 20)
                    .logCard(cornerRadius: 30, scheme: scheme)
            }
        }
    }

    private var sidePage: some View {
        pageScroll("\(m.symbol): Long or Short?") {
            HStack(spacing: 14) {
                sideCard(.long, symbol: "arrow.up.right", caption: "Buying", tint: .positive)
                sideCard(.short, symbol: "arrow.down.right", caption: "Selling", tint: .negative)
            }
        }
    }

    private func sideCard(_ s: Side, symbol: String, caption: String, tint: Color) -> some View {
        let on = m.side == s
        return Button { m.side = s; advance(from: .side) } label: {
            VStack(spacing: 10) {
                Image(systemName: symbol).font(.system(size: 34, weight: .bold)).foregroundStyle(tint)
                    .frame(width: 72, height: 72).background(tint.opacity(0.14), in: Circle())
                Text(s.label).font(.title2.weight(.bold)).foregroundStyle(.primary)
                Text(caption).font(.subheadline).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 30)
            .logCard(cornerRadius: 36, scheme: scheme)
            .overlay { if on { RoundedRectangle(cornerRadius: 36, style: .continuous).strokeBorder(tint, lineWidth: 2.5) } }
            .overlay(alignment: .topTrailing) { if on { Image(systemName: "checkmark.circle.fill").font(.title2).foregroundStyle(tint).padding(14) } }
        }
        .buttonStyle(PressableStyle())
        .animation(.snappy, value: on)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var setupPage: some View {
        pageScroll("Which Setup Was It?") {
            VStack(spacing: 12) {
                ForEach(store.strategies.filter(\.isActive)) { s in
                    OptionCard(symbol: "scope", caption: s.timeframe ?? "Setup", title: s.name, selected: m.strategyId == s.id) { m.strategyId = s.id; advance(from: .setup) }
                }
            }
        }
    }

    private var resultPage: some View {
        pageScroll("How Did It End?") {
            VStack(spacing: 12) {
                OptionCard(symbol: "arrow.up.right.circle.fill", caption: "Winner", title: "Took money off the table", tint: .positive, selected: m.result == .win) { pick(.win) }
                OptionCard(symbol: "arrow.down.right.circle.fill", caption: "Loser", title: "The market said no", tint: .negative, selected: m.result == .loss) { pick(.loss) }
                OptionCard(symbol: "equal.circle.fill", caption: "Breakeven", title: "In and out, nothing lost", selected: m.result == .flat) { pick(.flat) }
            }
        }
    }

    private var sizePage: some View {
        pageScroll(m.result == .win ? "How Much Did It Pay?" : "How Deep Was the Damage?") {
            VStack(spacing: 20) {
                if let risk, let chips = QuickLogLogic.rChips[m.result ?? .win] {
                    HStack(spacing: 10) {
                        ForEach(chips, id: \.self) { x in
                            LogChip(title: "\(x > 0 ? "+" : Fmt.minus)\(Fmt.dec(abs(x), x == x.rounded() ? 0 : 1))R", selected: m.r == x && m.amount.isEmpty,
                                    tint: x > 0 ? .positive : .negative) { m.r = x; m.amount = ""; focus = false }
                        }
                    }
                    Text("1R is your usual risk on \(acc?.name ?? "this account"): \(Fmt.money(risk, currency, decimals: 0))")
                        .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                } else {
                    Text("No history on \(acc?.name ?? "this account") yet, so type the amount.").font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }
                VStack(spacing: 6) {
                    Text(risk == nil ? "Amount" : "Or the exact amount").font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                    TextField("0.00", text: Binding(get: { m.amount }, set: { m.amount = $0.filter { "0123456789.,".contains($0) }; if !m.amount.isEmpty { m.r = nil } }))
                        .keyboardType(.decimalPad).focused($focus)
                        .font(.system(size: 32, weight: .bold, design: .rounded)).multilineTextAlignment(.center).monospacedDigit()
                        .padding(.vertical, 14).logCard(cornerRadius: 30, scheme: scheme)
                }
                resultPreview
            }
        }
    }

    private var resultPreview: some View {
        VStack(spacing: 2) {
            if let p = pnl {
                Text(Fmt.money(p, currency, sign: true)).font(.system(size: 40, weight: .bold, design: .rounded)).foregroundStyle(Color.pnl(p)).monospacedDigit()
                if let r = rShown, risk != nil { Text(Fmt.r(r, decimals: 1)).font(.headline).foregroundStyle(.secondary).monospacedDigit() }
            } else {
                Text("Pick a size above").font(.body).foregroundStyle(.secondary)
            }
        }
        .frame(minHeight: 70)
        .contentTransition(.numericText())
        .animation(.snappy, value: pnl)
    }

    private var moodPage: some View {
        let level = MoodScale.level(m.mood)
        let hue = MoodScale.hue(m.mood)
        return pageScroll("How Were You Feeling When You Took It?") {
            VStack(spacing: 18) {
                FlowerView(hue: hue, petals: 8, bloom: 0.15 + 0.85 * m.mood, roundness: 0.1 + 0.85 * m.mood, size: 250)
                    .frame(height: 260)
                    .scaleEffect(0.86 + 0.14 * m.mood)
                Text(level.label).font(.system(size: 28, weight: .bold)).foregroundStyle(MoodScale.color(m.mood, saturation: 0.85, brightness: scheme == .dark ? 1 : 0.62))
                    .contentTransition(.interpolate).animation(.smooth, value: level.label)
                VStack(spacing: 6) {
                    Slider(value: $m.mood, in: 0...1)
                        .tint(MoodScale.color(m.mood, saturation: 0.8, brightness: 0.9))
                        .accessibilityLabel("State of mind").accessibilityValue(level.label)
                    HStack {
                        Text("Very Unpleasant"); Spacer(); Text("Very Pleasant")
                    }
                    .font(.footnote.weight(.medium)).foregroundStyle(.secondary)
                }
                .padding(.horizontal, 6)
            }
        }
    }

    private var whyPage: some View {
        let loss = m.result == .loss
        return pageScroll(loss ? "What Cost You the Trade?" : "What Went Right?",
                          subtitle: loss ? "Be honest, nobody is watching. Pick all that apply." : "Optional. Repeating what works is half the job.") {
            VStack(spacing: 16) {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                    if loss {
                        ForEach(QuickLogLogic.lossReasons) { x in
                            reasonCard(symbol: x.symbol, label: x.label, hint: x.hint, on: m.reasons.contains(x.id), tint: x.id == "clean" ? .secondary : .negative) { toggleReason(x.id) }
                        }
                    } else {
                        ForEach(QuickLogLogic.winNotes, id: \.id) { x in
                            reasonCard(symbol: x.symbol, label: x.label, hint: nil, on: m.wins.contains(x.id), tint: .positive) {
                                if m.wins.contains(x.id) { m.wins.remove(x.id) } else { m.wins.insert(x.id) }
                            }
                        }
                    }
                }
                TextField("Something else, in your own words", text: Binding(get: { m.custom }, set: {
                    m.custom = String($0.prefix(loss ? 60 : 80))
                    if loss, !$0.isEmpty { m.reasons.remove("clean") }
                }))
                .focused($focus).submitLabel(.done).onSubmit { focus = false }
                .padding(.vertical, 16).padding(.horizontal, 20).logCard(cornerRadius: 28, scheme: scheme)
            }
        }
    }

    private func reasonCard(symbol: String, label: String, hint: String?, on: Bool, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: symbol).font(.title3).foregroundStyle(tint == .secondary ? Color.secondary : tint)
                    Spacer()
                    if on { Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.accentColor).transition(.scale) }
                }
                Text(label).font(.headline).foregroundStyle(.primary).multilineTextAlignment(.leading)
                if let hint { Text(hint).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.leading).lineLimit(2) }
                Spacer(minLength: 0)
            }
            .padding(16).frame(maxWidth: .infinity, minHeight: hint == nil ? 92 : 124, alignment: .leading)
            .logCard(cornerRadius: 28, scheme: scheme)
            .overlay { if on { RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(Color.accentColor, lineWidth: 2) } }
        }
        .buttonStyle(PressableStyle())
        .animation(.snappy, value: on)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var savePage: some View {
        let level = MoodScale.level(m.mood)
        return pageScroll("Ready to Log It?") {
            VStack(spacing: 16) {
                VStack(spacing: 14) {
                    HStack(spacing: 14) {
                        Image(systemName: m.result == .win ? "arrow.up.right.circle.fill" : m.result == .loss ? "arrow.down.right.circle.fill" : "equal.circle.fill")
                            .font(.system(size: 38)).foregroundStyle(m.result == .win ? Color.positive : m.result == .loss ? Color.negative : Color.secondary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(m.symbol) \(m.side?.label ?? "")").font(.title3.weight(.semibold))
                            Text("\(acc?.name ?? "")").font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(Fmt.money(pnl, currency, sign: true)).font(.title3.weight(.bold)).foregroundStyle(Color.pnl(pnl)).monospacedDigit()
                            if let r = rShown, risk != nil, m.result != .flat { Text(Fmt.r(r, decimals: 1)).font(.subheadline).foregroundStyle(.secondary).monospacedDigit() }
                        }
                    }
                    Divider()
                    HStack(spacing: 8) {
                        Image(systemName: "leaf.fill").foregroundStyle(MoodScale.color(m.mood, saturation: 0.8, brightness: 0.85))
                        Text(level.label).font(.subheadline.weight(.medium))
                        Spacer()
                        if m.result == .loss {
                            Text((chosenReasons.map(\.label) + (customText.isEmpty ? [] : [customText])).joined(separator: ", "))
                                .font(.footnote).foregroundStyle(.secondary).lineLimit(2).multilineTextAlignment(.trailing)
                        }
                    }
                }
                .padding(20).logCard(cornerRadius: 32, scheme: scheme)

                VStack(alignment: .leading, spacing: 8) {
                    Text("One line to remember it by").font(.subheadline.weight(.medium)).foregroundStyle(.secondary).padding(.leading, 6)
                    TextField("Sweep, shift, iFVG retest, then I hesitated…", text: $m.note, axis: .vertical)
                        .lineLimit(2...4).focused($focus)
                        .padding(18).logCard(cornerRadius: 28, scheme: scheme)
                }
            }
        }
    }

    private var donePage: some View {
        pageScroll("Logged", hero: AnyView(DoneBurst(win: m.result == .win))) {
            Text(m.saved?.text ?? "").font(.title3).multilineTextAlignment(.center).foregroundStyle(.primary.opacity(0.85))
                .padding(.horizontal, 8)
        }
    }

    // MARK: actions

    private func next() {
        guard let n = flow[safe: idx + 1] else { return }
        focus = false
        m.forward = true; m.error = nil
        withAnimation(.smooth(duration: 0.38)) { m.step = n }
    }

    private func back() {
        guard let p = flow[safe: idx - 1] else { return }
        focus = false
        m.forward = false; m.error = nil
        withAnimation(.smooth(duration: 0.38)) { m.step = p }
    }

    /// After a one-tap answer, move on once the choice has been seen.
    private func advance(from step: QuickLogModel.Step) {
        Task {
            try? await Task.sleep(for: .milliseconds(240))
            if m.step == step { next() }
        }
    }

    private func primary() {
        switch m.step {
        case .mode:
            if m.full { tradeCountBeforeFull = store.trades.count; showFull = true } else { next() }
        case .save: save()
        default: next()
        }
    }

    private func pick(_ r: TradeResult) {
        m.result = r; m.r = nil; m.amount = ""; m.reasons = []; m.wins = []; m.custom = ""
        Task {
            try? await Task.sleep(for: .milliseconds(240))
            if m.step == .result { m.forward = true; withAnimation(.smooth(duration: 0.38)) { m.step = r == .flat ? .mood : .size } }
        }
    }

    private func toggleReason(_ id: String) {
        if id == "clean" { m.custom = ""; m.reasons = m.reasons.contains("clean") ? [] : ["clean"]; return }
        m.reasons.remove("clean")
        if m.reasons.contains(id) { m.reasons.remove(id) } else { m.reasons.insert(id) }
    }

    private func save() {
        guard let acc, let side = m.side, let result = m.result, let pnl else { return }
        m.saving = true; m.error = nil
        let level = MoodScale.level(m.mood)
        let wentRight = QuickLogLogic.winNotes.filter { m.wins.contains($0.id) }.map(\.label)
        var parts: [String] = []
        let note = m.note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !note.isEmpty { parts.append(note) }
        if result == .loss, !chosenReasons.isEmpty || !customText.isEmpty { parts.append("What cost it: \((chosenReasons.map(\.label) + [customText].filter { !$0.isEmpty }).joined(separator: ", ")).") }
        if result == .win, !wentRight.isEmpty || !customText.isEmpty { parts.append("What went right: \((wentRight + [customText].filter { !$0.isEmpty }).joined(separator: ", ")).") }
        parts.append("Mood when taking it: \(level.label.lowercased()).")

        let now = Date()
        let trade = Trade(accountId: acc.id, strategyId: m.strategyId, symbol: m.symbol.trimmingCharacters(in: .whitespaces).uppercased(), side: side,
                          status: .closed, session: QuickLogLogic.sessionNow(now), entryDate: now, exitDate: now, pnl: pnl, riskAmount: risk,
                          notes: parts.joined(separator: "\n"), emotions: level.emotion, source: "quick")
        var tags: [(String, Severity)] = chosenReasons.compactMap { r in r.tag.map { ($0, r.severity) } }
        if result == .loss, !customText.isEmpty { tags.append((String(customText.prefix(60)), .medium)) }
        let mistakes = tags.map { TradeMistake(tradeId: "", tag: $0.0, severity: $0.1) }
        let isClean = m.reasons.contains("clean") && customText.isEmpty

        Task {
            defer { m.saving = false }
            do {
                let text = QuickLogLogic.afterNote(result: result, trades: store.trades, mistakes: store.data.mistakes, accountId: acc.id, tags: tags.map(\.0), clean: isClean)
                let id = try await store.saveTrade(trade, mistakes: mistakes.isEmpty ? nil : mistakes, isNew: true)
                m.saved = (id, text)
                m.forward = true
                withAnimation(.smooth(duration: 0.45)) { m.step = .done }
            } catch { m.error = error.localizedDescription }
        }
    }

    private func goDetails() {
        guard let id = m.saved?.id else { return }
        dismiss()
        // Hand the new trade to whoever is showing us.
        NotificationCenter.default.post(name: .openTradeDetails, object: id)
    }

    private func another() {
        let acc = m.accountId
        m = QuickLogModel()
        m.accountId = acc
        m.forward = false
        withAnimation(.smooth(duration: 0.38)) { m.step = askAccount ? .account : .pair }
    }
}

extension Notification.Name { static let openTradeDetails = Notification.Name("ifvg.openTradeDetails") }

private extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}

/// The finishing flourish: flowers pop outward from the centre.
private struct DoneBurst: View {
    let win: Bool
    @State private var out = false
    var body: some View {
        ZStack {
            ForEach(0..<6, id: \.self) { i in
                let a = Double(i) / 6 * 2 * .pi
                FlowerView(hue: [0.58, 0.30, 0.07, 0.72, 0.50, 0.14][i], petals: 6 + i % 3, bloom: 1, roundness: 0.8, size: i % 2 == 0 ? 54 : 38)
                    .offset(x: out ? cos(a) * 112 : 0, y: out ? sin(a) * 56 : 0)
                    .scaleEffect(out ? 1 : 0.1).opacity(out ? 1 : 0)
                    .animation(.spring(response: 0.6, dampingFraction: 0.62).delay(Double(i) * 0.05), value: out)
            }
            FlowerView(hue: win ? 0.07 : 0.55, petals: 9, bloom: 1, roundness: 0.9, size: 130)
                .scaleEffect(out ? 1 : 0.2)
                .animation(.spring(response: 0.55, dampingFraction: 0.6), value: out)
        }
        .frame(height: 190)
        .onAppear { out = true }
    }
}
