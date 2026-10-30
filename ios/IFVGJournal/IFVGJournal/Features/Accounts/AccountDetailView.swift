import SwiftUI
import Charts

/// One account, Health-app style: equity, stats, evaluation rules, recent money movements.
struct AccountDetailView: View {
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let account: Account
    @State private var showEdit = false
    @State private var confirmDelete = false
    @State private var error: String?

    private var live: Account? { store.account(account.id) }

    var body: some View {
        Group {
            if let a = live {
                content(a)
            } else {
                EmptyHint(symbol: "building.columns", title: "Account Not Found", message: "This account is no longer available.")
            }
        }
        .background(Color.groupedBackground)
        .navigationTitle(live?.name ?? account.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let a = live {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { showEdit = true } label: { Label("Edit", systemImage: "pencil") }
                        Button {
                            store.scope = a.id
                        } label: { Label("Show Only This Account", systemImage: "scope") }
                        Divider()
                        Button(role: .destructive) { confirmDelete = true } label: { Label("Delete", systemImage: "trash") }
                    } label: {
                        Image(systemName: "ellipsis.circle").accessibilityLabel("More")
                    }
                }
            }
        }
        .sheet(isPresented: $showEdit) { AccountFormView(account: live ?? account) }
        .confirmationDialog("Delete this account?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete Account", role: .destructive) {
                Task {
                    await Action.run($error) { try await store.deleteAccount(account.id) }
                    if error == nil { dismiss() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("\(live?.name ?? account.name) and all of its trades will be removed. This can't be undone.")
        }
        .accountErrorAlert($error)
    }

    // MARK: content

    @ViewBuilder
    private func content(_ a: Account) -> some View {
        let trades = store.trades.filter { $0.accountId == a.id }
        let txs = store.data.transactions.filter { $0.accountId == a.id }
        let equity = Analytics.accountEquity(a, store.trades, store.data.transactions)
        let summary = Analytics.summarize(trades)

        ScrollView {
            VStack(spacing: 16) {
                equityCard(a, trades: trades, equity: equity)
                statsCard(a, summary: summary)
                if a.isPropFirm { rulesCard(a) }
                else if let goal = a.equityGoal, goal > 0 { goalCard(a, equity: equity, goal: goal) }
                transactionsCard(a, txs: txs)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .scrollIndicators(.hidden)
    }

    private func equityCard(_ a: Account, trades: [Trade], equity: Double) -> some View {
        let points = curve(a, trades)
        let up = equity >= a.initialBalance
        let tint: Color = up ? .positive : .negative
        return HealthCard(title: "Equity", symbol: "chart.line.uptrend.xyaxis", tint: .accentColor, trailing: subtitle(a), chevron: false) {
            HeadlineValue(value: Fmt.money(equity, a.currency), color: .primary)
            HStack(spacing: 6) {
                PnLText(value: equity - a.initialBalance, currency: a.currency).font(.subheadline.weight(.semibold))
                Text("since start").font(.subheadline).foregroundStyle(.secondary)
            }
            if points.count >= 2 {
                Chart {
                    ForEach(points) { p in
                        AreaMark(x: .value("Date", p.date), yStart: .value("Start", a.initialBalance), yEnd: .value("Equity", p.value))
                            .foregroundStyle(LinearGradient(colors: [tint.opacity(0.28), tint.opacity(0.02)], startPoint: .top, endPoint: .bottom))
                            .interpolationMethod(.monotone)
                        LineMark(x: .value("Date", p.date), y: .value("Equity", p.value))
                            .foregroundStyle(tint)
                            .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                            .interpolationMethod(.monotone)
                    }
                    RuleMark(y: .value("Starting Balance", a.initialBalance))
                        .foregroundStyle(.secondary.opacity(0.5))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
                .chartYScale(domain: .automatic(includesZero: false))
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { v in
                        AxisGridLine()
                        AxisValueLabel {
                            if let d = v.as(Double.self) { Text(axisLabel(d)).monospacedDigit() }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 3)) { _ in
                        AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    }
                }
                .frame(height: 170)
                .padding(.top, 4)
            } else {
                Text("The equity curve appears after the first closed trade.")
                    .font(.footnote).foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
        }
    }

    private func statsCard(_ a: Account, summary s: Analytics.Summary) -> some View {
        HealthCard(title: "Performance", symbol: "chart.bar.fill", tint: .indigo, chevron: false) {
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 14) {
                GridRow {
                    AccountStat(title: "Net P&L") { PnLText(value: s.net, currency: a.currency, decimals: 0) }
                    AccountStat(title: "Win Rate") { Text(Fmt.pct(s.winRate)).monospacedDigit() }
                }
                GridRow {
                    AccountStat(title: "Profit Factor") { Text(Fmt.dec(s.profitFactor)).monospacedDigit() }
                    AccountStat(title: "Trades") { Text(Fmt.int(s.count)).monospacedDigit() }
                }
            }
        }
    }

    // MARK: prop firm rules

    private func rulesCard(_ a: Account) -> some View {
        let st = Analytics.propStatus(a, store.trades, store.data.transactions)
        return HealthCard(title: "Evaluation Rules", symbol: "checkmark.shield.fill", tint: .orange, chevron: false) {
            VStack(alignment: .leading, spacing: 18) {
                if let target = st.target, target > 0 {
                    let frac = max(0, st.profit) / target
                    AccountRuleRow(title: "Profit Target",
                                   detail: "\(Fmt.money(max(0, st.profit), a.currency, decimals: 0)) of \(Fmt.money(target, a.currency, decimals: 0))",
                                   fraction: frac, tint: frac >= 1 ? .positive : .accentColor)
                }
                if let floor = st.floor, let buffer = st.bufferToFloor, let limit = a.maxLossLimit, limit > 0 {
                    let frac = max(0, buffer) / limit
                    AccountRuleRow(title: a.trailingDrawdown ? "Room Above Trailing Floor" : "Room Above Loss Floor",
                                   detail: "\(Fmt.money(buffer, a.currency, decimals: 0)) above \(Fmt.money(floor, a.currency, decimals: 0))",
                                   fraction: frac, tint: frac > 0.5 ? .positive : frac > 0.25 ? .orange : .negative)
                }
                if let limit = st.dailyLimit, limit > 0 {
                    let used = max(0, -st.dailyPnl)
                    let frac = used / limit
                    AccountRuleRow(title: "Today vs Daily Limit",
                                   detail: "\(Fmt.money(st.dailyPnl, a.currency, sign: true, decimals: 0)) today, limit \(Fmt.money(limit, a.currency, decimals: 0))",
                                   fraction: frac, tint: frac < 0.5 ? .positive : frac < 0.8 ? .orange : .negative)
                }
                if let minDays = st.minDays, minDays > 0 {
                    let frac = Double(st.tradingDays) / Double(minDays)
                    AccountRuleRow(title: "Trading Days",
                                   detail: "\(st.tradingDays) of \(minDays) minimum",
                                   fraction: frac, tint: frac >= 1 ? .positive : .accentColor)
                }
                if st.target == nil && st.floor == nil && st.dailyLimit == nil && st.minDays == nil {
                    Text("No rules set. Edit the account to add a profit target and loss limits.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
    }

    private func goalCard(_ a: Account, equity: Double, goal: Double) -> some View {
        let span = goal - a.initialBalance
        let frac = span > 0 ? (equity - a.initialBalance) / span : 0
        return HealthCard(title: "Equity Goal", symbol: "flag.checkered", tint: .green, chevron: false) {
            AccountRuleRow(title: "Progress",
                           detail: "\(Fmt.money(equity, a.currency, decimals: 0)) of \(Fmt.money(goal, a.currency, decimals: 0))",
                           fraction: frac, tint: frac >= 1 ? .positive : .accentColor)
        }
    }

    // MARK: transactions

    private func transactionsCard(_ a: Account, txs: [FinancialTransaction]) -> some View {
        let recent = txs.sorted { $0.date > $1.date }.prefix(5)
        return HealthCard(title: "Recent Transactions", symbol: "arrow.left.arrow.right.circle.fill", tint: .teal, chevron: false) {
            if recent.isEmpty {
                Text("No deposits, withdrawals, payouts or fees for this account.")
                    .font(.footnote).foregroundStyle(.secondary)
            } else {
                VStack(spacing: 12) {
                    ForEach(recent) { t in
                        HStack(spacing: 12) {
                            Image(systemName: t.type.symbol)
                                .font(.title3)
                                .foregroundStyle(t.type.balanceSign > 0 ? Color.positive : t.type.balanceSign < 0 ? Color.negative : Color.secondary)
                                .frame(width: 28)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(t.type.label).font(.subheadline.weight(.medium))
                                Text(t.note?.isEmpty == false ? "\(t.date.formatted(date: .abbreviated, time: .omitted)) · \(t.note!)"
                                     : t.date.formatted(date: .abbreviated, time: .omitted))
                                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            let signed = t.type.balanceSign >= 0 ? t.amount : -t.amount
                            Text(Fmt.money(t.type.balanceSign == 0 ? -t.amount : signed, a.currency, sign: true))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(t.type.balanceSign > 0 ? Color.positive : Color.negative)
                                .monospacedDigit()
                        }
                    }
                }
            }
        }
    }

    // MARK: helpers

    private struct CurvePoint: Identifiable { let id: String; let date: Date; let value: Double }

    private func curve(_ a: Account, _ trades: [Trade]) -> [CurvePoint] {
        let pts = Analytics.equityCurve(trades, start: a.initialBalance)
        guard let first = pts.first else { return [] }
        let startDay = min(a.startDate ?? a.createdAt, first.date.addingTimeInterval(-86_400))
        return [CurvePoint(id: "start", date: startDay, value: a.initialBalance)] + pts.map { CurvePoint(id: $0.id, date: $0.date, value: $0.value) }
    }

    private func axisLabel(_ v: Double) -> String {
        Fmt.compact(v).replacingOccurrences(of: "+", with: "")
    }

    private func subtitle(_ a: Account) -> String {
        if let b = a.broker, !b.isEmpty { return "\(a.kindLabel) · \(b)" }
        return a.kindLabel
    }
}

private struct AccountStat<Value: View>: View {
    let title: String
    @ViewBuilder var value: Value
    init(title: String, @ViewBuilder value: () -> Value) { self.title = title; self.value = value() }
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            value.font(.title2.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AccountRuleRow: View {
    let title: String
    let detail: String
    let fraction: Double
    var tint: Color = .accentColor
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.subheadline.weight(.medium))
                Spacer(minLength: 8)
                Text(Fmt.pct(min(max(fraction, 0), 9.99) * 100))
                    .font(.subheadline.weight(.semibold)).foregroundStyle(tint).monospacedDigit()
            }
            Track(fraction: fraction, tint: tint)
            Text(detail).font(.caption).foregroundStyle(.secondary).monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }
}
