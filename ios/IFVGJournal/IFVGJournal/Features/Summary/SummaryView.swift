import SwiftUI
import Charts

/// The Summary tab, laid out like the Health app's: a segmented range, a headline card, then tiles that
/// each open something deeper. Every figure is computed from the rows in view (see Analytics).
struct SummaryView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.openLog) private var openLog
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            ScrollView {
                if store.loading && !store.loaded {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 80)
                } else if store.trades.isEmpty {
                    EmptyJournal(error: store.error)
                } else {
                    SummaryContent()
                }
            }
            .background(Color.groupedBackground)
            .navigationTitle("Summary")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { AccountScopeMenu(showSettings: $showSettings) } }
            .sheet(isPresented: $showSettings) { SettingsView() }
            .refreshable { await store.refresh() }
        }
    }
}

private struct EmptyJournal: View {
    @Environment(\.openLog) private var openLog
    let error: String?
    var body: some View {
        VStack(spacing: 16) {
            if let error { ErrorBanner(message: error).padding(.horizontal, 16) }
            ContentUnavailableView {
                Label("Your Journal Is Empty", systemImage: "book.closed")
            } description: {
                Text("Log a trade the moment you close it: the setup, how it ended, what you felt. Your numbers build themselves from those entries.")
            } actions: {
                Button("Log Your First Trade", action: openLog).buttonStyle(.glassProminent)
            }
            .padding(.top, 40)
        }
    }
}

private struct SummaryContent: View {
    @Environment(JournalStore.self) private var store

    var body: some View {
        let trades = store.viewTrades
        let s = Analytics.summarize(trades)
        let currency = store.currency
        let prior: Analytics.Summary? = Analytics.priorWindow(store.period).map { Analytics.summarize(Analytics.inWindow(store.scopeTrades, $0)) }
        let adherence = Analytics.planAdherence(trades, store.data.mistakes)
        let finding = Analytics.topFinding(trades, strategies: store.strategies, mistakes: store.data.mistakes, currency: currency)
        let before = equityBefore()
        let curve = Analytics.equityCurve(trades, start: store.startBalance + before)

        VStack(spacing: 16) {
            PeriodPicker().padding(.horizontal, 16)
            if let e = store.error { ErrorBanner(message: e) { Task { await store.refresh(showSpinner: true) } }.padding(.horizontal, 16) }

            VStack(spacing: 12) {
                if let finding { HighlightCard(finding: finding) }
                NetResultCard(summary: s, prior: prior, curve: curve, currency: currency)
                MetricGrid(summary: s, adherence: adherence, currency: currency)
                if let single = store.scopeAccounts.first, store.scopeAccounts.count == 1, single.isPropFirm {
                    PropCard(account: single)
                }
                TodayCard()
                SessionsCard(trades: trades, currency: currency)
                MistakeCostCard(trades: trades, currency: currency)
                RecentTradesCard()
            }
            .padding(.horizontal, 16)
        }
        .padding(.bottom, 24)
    }

    /// Realised P&L before the period starts, so the equity line begins where the account stood.
    private func equityBefore() -> Double {
        guard let start = Analytics.periodStart(store.period) else { return 0 }
        return store.scopeTrades.filter { $0.isClosed && $0.closeDate < start }.reduce(0) { $0 + $1.net }
    }
}

// MARK: - Cards

private struct HighlightCard: View {
    let finding: Analytics.Finding
    var body: some View {
        HealthCard(title: "Highlights", symbol: "sparkles", tint: finding.tone == .neg ? .orange : .accentColor, chevron: false) {
            Text(finding.text).font(.body.weight(.medium)).fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct NetResultCard: View {
    let summary: Analytics.Summary
    let prior: Analytics.Summary?
    let curve: [Analytics.EquityPoint]
    let currency: String
    @Environment(JournalStore.self) private var store

    var body: some View {
        NavigationLink { PerformanceDetailView() } label: {
            HealthCard(title: "Net Result", symbol: "chart.line.uptrend.xyaxis", tint: .accentColor, trailing: store.period.label) {
                VStack(alignment: .leading, spacing: 4) {
                    HeadlineValue(value: Fmt.money(summary.net, currency, sign: true), color: Color.pnl(summary.net))
                    if let prior {
                        let delta = (summary.net * 100).rounded() / 100 - (prior.net * 100).rounded() / 100
                        Text("\(Fmt.money(delta, currency, sign: true, decimals: 0)) vs prior \(store.period.label)")
                            .font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Text("\(summary.count) closed trades").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                EquityChart(points: curve, currency: currency, height: 96, tint: summary.net < 0 ? .negative : .accentColor)
                    .padding(.top, 4)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct MetricGrid: View {
    let summary: Analytics.Summary
    let adherence: Analytics.Adherence?
    let currency: String

    var body: some View {
        let cols = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        LazyVGrid(columns: cols, spacing: 12) {
            tile("Win Rate", "target", .green) {
                HStack {
                    HeadlineValue(value: Fmt.pct(summary.winRate), size: .system(size: 28, weight: .bold, design: .rounded))
                    Spacer(minLength: 0)
                    RingGauge(fraction: (summary.winRate ?? 0) / 100, tint: .green, lineWidth: 6).frame(width: 34, height: 34)
                }
                caption("\(summary.wins) won · \(summary.losses) lost · \(summary.flat) flat")
            }
            tile("Profit Factor", "scalemass.fill", .indigo) {
                HeadlineValue(value: summary.profitFactor.map { Fmt.dec($0) } ?? "—", size: .system(size: 28, weight: .bold, design: .rounded))
                caption(summary.avgWin != nil && summary.avgLoss != nil
                        ? "Avg \(Fmt.money(summary.avgWin, currency, decimals: 0)) / \(Fmt.money(-(summary.avgLoss ?? 0), currency, decimals: 0))"
                        : "Needs a win and a loss")
            }
            tile("Expectancy", "plusminus.circle.fill", .orange) {
                HeadlineValue(value: Fmt.r(summary.avgR), size: .system(size: 28, weight: .bold, design: .rounded), color: Color.pnl(summary.avgR))
                caption(summary.expectancy.map { "\(Fmt.money($0, currency, sign: true, decimals: 0)) a trade" } ?? "per trade")
            }
            tile("Max Drawdown", "arrow.down.right.circle.fill", .red) {
                HeadlineValue(value: Fmt.money(summary.maxDrawdown == 0 ? 0 : -summary.maxDrawdown, currency, decimals: 0),
                              size: .system(size: 28, weight: .bold, design: .rounded))
                caption("Worst peak to trough")
            }
            tile("Plan Followed", "checkmark.seal.fill", .teal) {
                HStack {
                    HeadlineValue(value: adherence.map { Fmt.pct($0.pct) } ?? "—", size: .system(size: 28, weight: .bold, design: .rounded))
                    Spacer(minLength: 0)
                    RingGauge(fraction: (adherence?.pct ?? 0) / 100, tint: .teal, lineWidth: 6).frame(width: 34, height: 34)
                }
                caption(adherence.map { "\($0.clean) of \($0.total) trades clean" } ?? "No trades yet")
            }
            tile("Streak", "flame.fill", .pink) {
                HeadlineValue(value: summary.streakCount == 0 ? "—" : "\(summary.streakCount)\(summary.streakKind.map(String.init) ?? "")",
                              size: .system(size: 28, weight: .bold, design: .rounded))
                caption("Best \(summary.longestWin)W · worst \(summary.longestLoss)L")
            }
        }
    }

    private func tile<C: View>(_ title: String, _ symbol: String, _ tint: Color, @ViewBuilder _ content: () -> C) -> some View {
        NavigationLink { ReportsView() } label: {
            HealthCard(title: title, symbol: symbol, tint: tint, chevron: false) { content() }
        }
        .buttonStyle(.plain)
    }
    private func caption(_ s: String) -> some View {
        Text(s).font(.caption).foregroundStyle(.secondary).lineLimit(2).fixedSize(horizontal: false, vertical: true)
    }
}

private struct PropCard: View {
    @Environment(JournalStore.self) private var store
    let account: Account

    var body: some View {
        let p = Analytics.propStatus(account, store.trades, store.data.transactions)
        let cur = account.currency
        NavigationLink { AccountDetailView(account: account) } label: {
            HealthCard(title: "Evaluation Rules", symbol: "flag.checkered", tint: .purple, trailing: account.name) {
                VStack(alignment: .leading, spacing: 16) {
                    if let target = p.target, target > 0 {
                        limit("Profit Target", Fmt.money(p.profit, cur, sign: true, decimals: 0), "of \(Fmt.money(target, cur, decimals: 0))", (p.targetPct ?? 0) / 100, .green)
                    }
                    if let buffer = p.bufferToFloor, let max = account.maxLossLimit, max > 0 {
                        limit(account.trailingDrawdown ? "Room Above Trailing Floor" : "Room Above Floor", Fmt.money(buffer, cur, decimals: 0),
                              "of \(Fmt.money(max, cur, decimals: 0))", buffer / max, buffer / max < 0.25 ? .red : .accentColor)
                    }
                    if let daily = p.dailyLimit, daily > 0 {
                        limit("Today vs Daily Limit", Fmt.money(p.dailyPnl, cur, sign: true, decimals: 0), "of \(Fmt.minus)\(Fmt.money(daily, cur, decimals: 0))",
                              p.dailyPnl < 0 ? -p.dailyPnl / daily : 0, .orange)
                    }
                    if let minDays = p.minDays {
                        HStack { Text("Trading Days").font(.subheadline); Spacer(); Text("\(p.tradingDays) of \(minDays) required").font(.subheadline).foregroundStyle(.secondary) }
                    }
                }
            }
        }
        .buttonStyle(.plain)
    }

    private func limit(_ title: String, _ value: String, _ of: String, _ fraction: Double, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.subheadline)
                Spacer()
                Text(value).font(.subheadline.weight(.semibold)).monospacedDigit()
                Text(of).font(.caption).foregroundStyle(.secondary)
            }
            Track(fraction: fraction, tint: tint)
        }
    }
}

private struct TodayCard: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.openLog) private var openLog

    var body: some View {
        let todayKey = Analytics.dayKey(Date())
        let closedToday = store.scopeTrades.filter { $0.isClosed && Analytics.dayKey($0.closeDate) == todayKey }
        let open = store.scopeTrades.filter { $0.status == .open }
        let net = closedToday.reduce(0) { $0 + $1.net }
        HealthCard(title: "Today", symbol: "sun.max.fill", tint: .orange, trailing: Fmt.relativeDay(Date()), chevron: false) {
            HStack(alignment: .firstTextBaseline) {
                HeadlineValue(value: closedToday.isEmpty ? "—" : Fmt.money(net, store.currency, sign: true),
                              color: closedToday.isEmpty ? .secondary : Color.pnl(net), size: .system(size: 28, weight: .bold, design: .rounded))
                Spacer()
                Text("\(closedToday.count) closed · \(open.count) open").font(.footnote).foregroundStyle(.secondary)
            }
            if closedToday.isEmpty && open.isEmpty {
                Text("Nothing logged today. Log a trade the moment you are in.").font(.footnote).foregroundStyle(.secondary)
                Button { openLog() } label: { Label("Log a Trade", systemImage: "plus") }.buttonStyle(.glass).padding(.top, 2)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array((open + closedToday.sorted { $0.closeDate > $1.closeDate }.prefix(4)).enumerated()), id: \.element.id) { i, t in
                        if i > 0 { Divider() }
                        NavigationLink { TradeDetailView(tradeID: t.id) } label: { TradeRow(trade: t).padding(.vertical, 8) }.buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

private struct SessionsCard: View {
    let trades: [Trade]
    let currency: String
    var body: some View {
        let rows = Analytics.bySession(trades).filter { $0.count > 0 }.sorted { $0.net > $1.net }
        if !rows.isEmpty {
            let maxAbs = max(1, rows.map { abs($0.net) }.max() ?? 1)
            NavigationLink { ReportsView() } label: {
                HealthCard(title: "Sessions", symbol: "clock.fill", tint: .blue, trailing: "Net Result") {
                    VStack(spacing: 14) {
                        ForEach(rows) { r in
                            RankBar(label: r.label, sub: "\(r.count) trades · \(r.winRate.map { "\(Int($0.rounded()))%" } ?? "—") won",
                                    share: abs(r.net) / maxAbs, value: r.net, currency: currency)
                        }
                    }
                }
            }
            .buttonStyle(.plain)
        }
    }
}

private struct MistakeCostCard: View {
    @Environment(JournalStore.self) private var store
    let trades: [Trade]
    let currency: String
    var body: some View {
        let costs = Analytics.mistakeCosts(trades, store.data.mistakes).filter { $0.cost < 0 }
        if !costs.isEmpty {
            let maxAbs = max(1, costs.map { abs($0.cost) }.max() ?? 1)
            NavigationLink { MistakesView() } label: {
                HealthCard(title: "What Mistakes Cost", symbol: "exclamationmark.triangle.fill", tint: .red, trailing: "Losses on tagged trades") {
                    VStack(spacing: 14) {
                        ForEach(costs.prefix(5)) { c in
                            RankBar(label: c.tag, sub: "\(c.count) trade\(c.count == 1 ? "" : "s")", share: abs(c.cost) / maxAbs, value: c.cost, currency: currency)
                        }
                    }
                }
            }
            .buttonStyle(.plain)
        }
    }
}

private struct RecentTradesCard: View {
    @Environment(JournalStore.self) private var store
    var body: some View {
        let recent = store.scopeTrades.sorted { $0.entryDate > $1.entryDate }.prefix(5)
        HealthCard(title: "Recent Trades", symbol: "list.bullet.rectangle.fill", tint: .indigo, chevron: false) {
            VStack(spacing: 0) {
                ForEach(Array(recent.enumerated()), id: \.element.id) { i, t in
                    if i > 0 { Divider() }
                    NavigationLink { TradeDetailView(tradeID: t.id) } label: { TradeRow(trade: t, showDate: true).padding(.vertical, 8) }.buttonStyle(.plain)
                }
            }
            NavigationLink { TradesListView() } label: {
                HStack { Text("Show All Trades").font(.subheadline.weight(.medium)); Spacer(); Image(systemName: "chevron.right").font(.footnote) }
                    .padding(.top, 6)
            }
        }
    }
}

// MARK: - Detail

/// Net result, expanded: equity, daily result and drawdown over the chosen period.
struct PerformanceDetailView: View {
    @Environment(JournalStore.self) private var store
    enum Kind: String, CaseIterable, Identifiable { case equity = "Equity", daily = "Daily", drawdown = "Drawdown"; var id: String { rawValue } }
    @State private var kind: Kind = .equity

    var body: some View {
        let trades = store.viewTrades
        let s = Analytics.summarize(trades)
        let before: Double = Analytics.periodStart(store.period).map { start in
            store.scopeTrades.filter { $0.isClosed && $0.closeDate < start }.reduce(0) { $0 + $1.net }
        } ?? 0
        let curve = Analytics.equityCurve(trades, start: store.startBalance + before)
        let days = Array(Analytics.dailyMap(trades).values)

        ScrollView {
            VStack(spacing: 16) {
                PeriodPicker()
                Picker("Chart", selection: $kind) { ForEach(Kind.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)

                VStack(alignment: .leading, spacing: 8) {
                    HeadlineValue(value: Fmt.money(s.net, store.currency, sign: true), color: Color.pnl(s.net))
                    Text(store.period.label == "All" ? "All time" : "Last \(store.period.label)").font(.footnote).foregroundStyle(.secondary)
                    Group {
                        switch kind {
                        case .equity: EquityChart(points: curve, currency: store.currency, height: 260, interactive: true, tint: s.net < 0 ? .negative : .accentColor)
                        case .daily: DailyBarsChart(days: days, height: 260)
                        case .drawdown: DrawdownChart(points: curve, height: 260)
                        }
                    }
                    .padding(.top, 8)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.card, in: RoundedRectangle(cornerRadius: cardRadius, style: .continuous))

                VStack(spacing: 0) {
                    row("Closed Trades", Fmt.int(s.count))
                    Divider().padding(.leading, 16)
                    row("Best Trade", Fmt.money(s.best, store.currency, sign: true))
                    Divider().padding(.leading, 16)
                    row("Worst Trade", Fmt.money(s.worst, store.currency, sign: true))
                    Divider().padding(.leading, 16)
                    row("Fees", Fmt.money(s.fees == 0 ? 0 : -s.fees, store.currency))
                    Divider().padding(.leading, 16)
                    row("Trading Days", "\(days.count)")
                }
                .background(Color.card, in: RoundedRectangle(cornerRadius: cardRadius, style: .continuous))
            }
            .padding(.horizontal, 16).padding(.bottom, 24)
        }
        .background(Color.groupedBackground)
        .navigationTitle("Net Result")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ t: String, _ v: String) -> some View {
        HStack { Text(t); Spacer(); Text(v).foregroundStyle(.secondary).monospacedDigit() }.padding(.horizontal, 16).padding(.vertical, 13)
    }
}
