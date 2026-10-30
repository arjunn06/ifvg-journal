import SwiftUI

/// Which days made and lost the month, and what happened on them. A month grid tinted by result,
/// weekly totals beneath, and the selected day's trades.
struct CalendarTab: View {
    @Environment(JournalStore.self) private var store
    @State private var cursor: Date = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: Date()))!
    @State private var picked: String? = Analytics.dayKey(Date())
    @State private var showSettings = false

    private var cal: Calendar { Analytics.cal }
    private var atCurrent: Bool { cal.isDate(cursor, equalTo: Date(), toGranularity: .month) }

    var body: some View {
        let daily = Analytics.dailyMap(store.scopeTrades)
        let year = cal.component(.year, from: cursor), month = cal.component(.month, from: cursor)
        let weeks = Analytics.monthGrid(year: year, month: month, daily: daily)
        let monthDays = daily.values.filter { $0.key.hasPrefix(String(format: "%04d-%02d", year, month)) }
        let monthTrades = monthDays.flatMap(\.trades)
        let s = Analytics.summarize(monthTrades)
        let maxAbs = max(1, monthDays.map { abs($0.pnl) }.max() ?? 1)

        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    monthHeader
                    summaryCard(s, monthDays)
                    gridCard(weeks, maxAbs)
                    if !monthDays.isEmpty { weeksCard(weeks) }
                    if let key = picked { dayCard(key, daily[key]) }
                }
                .padding(.horizontal, 16).padding(.bottom, 24)
            }
            .background(Color.groupedBackground)
            .navigationTitle("Calendar")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { AccountScopeMenu(showSettings: $showSettings) } }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }

    // MARK: pieces

    private var monthHeader: some View {
        HStack(spacing: 10) {
            Text(Fmt.monthYear(cursor)).font(.title2.bold())
            Spacer()
            if !atCurrent {
                Button("Today") { step(to: Date()) }.buttonStyle(.glass).controlSize(.small)
            }
            GlassEffectContainer(spacing: 8) {
                HStack(spacing: 8) {
                    Button { step(by: -1) } label: { Image(systemName: "chevron.left").frame(width: 28, height: 28) }
                        .buttonStyle(.glass).accessibilityLabel("Previous Month")
                    Button { step(by: 1) } label: { Image(systemName: "chevron.right").frame(width: 28, height: 28) }
                        .buttonStyle(.glass).disabled(atCurrent).accessibilityLabel("Next Month")
                }
            }
        }
        .padding(.top, 4)
    }

    private func summaryCard(_ s: Analytics.Summary, _ days: [Analytics.Day]) -> some View {
        let green = days.filter { $0.pnl > 0 }.count
        return HealthCard(title: "Month", symbol: "calendar", tint: .accentColor, trailing: "\(s.count) closed trades", chevron: false) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                VStack(alignment: .leading, spacing: 2) {
                    HeadlineValue(value: days.isEmpty ? Fmt.money(0, store.currency) : Fmt.money(s.net, store.currency, sign: true),
                                  color: days.isEmpty ? .secondary : Color.pnl(s.net), size: .system(size: 30, weight: .bold, design: .rounded))
                    Text("Net Result").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                stat(days.isEmpty ? "—" : "\(green) of \(days.count)", "Green Days")
                Spacer()
                stat(Fmt.pct(s.winRate), "Win Rate")
            }
        }
    }

    private func stat(_ v: String, _ label: String) -> some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(v).font(.headline).monospacedDigit()
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }

    private func gridCard(_ weeks: [Analytics.Week], _ maxAbs: Double) -> some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                ForEach(["M", "T", "W", "T", "F", "S", "S"].enumerated().map { $0 }, id: \.offset) { _, d in
                    Text(d).font(.caption.weight(.semibold)).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                }
            }
            ForEach(weeks) { w in
                HStack(spacing: 6) {
                    ForEach(w.cells) { c in
                        DayCell(cell: c, maxAbs: maxAbs, selected: picked == c.key, today: c.key == Analytics.dayKey(Date())) {
                            guard c.inMonth else { return }
                            withAnimation(.snappy) { picked = (picked == c.key ? nil : c.key) }
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(Color.card, in: RoundedRectangle(cornerRadius: cardRadius, style: .continuous))
    }

    private func weeksCard(_ weeks: [Analytics.Week]) -> some View {
        HealthCard(title: "Weeks", symbol: "rectangle.split.3x1.fill", tint: .indigo, chevron: false) {
            VStack(spacing: 0) {
                ForEach(Array(weeks.filter { $0.count > 0 }.enumerated()), id: \.element.id) { i, w in
                    if i > 0 { Divider() }
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Week of \(w.cells.first!.date.formatted(.dateTime.day().month(.abbreviated)))").font(.subheadline.weight(.medium))
                            Text("\(w.count) trade\(w.count == 1 ? "" : "s")").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        PnLText(value: w.pnl, currency: store.currency, decimals: 0).font(.subheadline.weight(.semibold))
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }

    @ViewBuilder
    private func dayCard(_ key: String, _ day: Analytics.Day?) -> some View {
        let date = Self.date(from: key)
        HealthCard(title: Fmt.relativeDay(date), symbol: "calendar.day.timeline.left", tint: .orange,
                   trailing: day.map { Fmt.money($0.pnl, store.currency, sign: true, decimals: 0) }, chevron: false) {
            if let day {
                VStack(spacing: 0) {
                    ForEach(Array(day.trades.sorted { $0.closeDate > $1.closeDate }.enumerated()), id: \.element.id) { i, t in
                        if i > 0 { Divider() }
                        NavigationLink { TradeDetailView(tradeID: t.id) } label: { TradeRow(trade: t).padding(.vertical, 8) }.buttonStyle(.plain)
                    }
                }
            } else {
                Text("No closed trades on this day.").font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    // MARK: helpers

    private func step(by n: Int) {
        cursor = cal.date(byAdding: .month, value: n, to: cursor)!
        picked = nil
    }
    private func step(to d: Date) {
        cursor = cal.date(from: cal.dateComponents([.year, .month], from: d))!
        picked = Analytics.dayKey(d)
    }
    static func date(from key: String) -> Date {
        let p = key.split(separator: "-").compactMap { Int($0) }
        return Analytics.cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2])) ?? Date()
    }
}

private struct DayCell: View {
    let cell: Analytics.Cell
    let maxAbs: Double
    let selected: Bool
    let today: Bool
    let action: () -> Void

    var body: some View {
        let pnl = cell.day?.pnl
        let tint: Color = (pnl ?? 0) > 0 ? .positive : (pnl ?? 0) < 0 ? .negative : .clear
        let strength = pnl.map { 0.16 + 0.5 * min(1, abs($0) / maxAbs) } ?? 0
        Button(action: action) {
            VStack(spacing: 1) {
                Text("\(Analytics.cal.component(.day, from: cell.date))")
                    .font(.system(size: 15, weight: today ? .bold : .medium, design: .rounded))
                    .foregroundStyle(today ? Color.accentColor : .primary)
                if let pnl, cell.inMonth {
                    Text(Fmt.compact(pnl)).font(.system(size: 10, weight: .semibold)).monospacedDigit().foregroundStyle(tint).lineLimit(1).minimumScaleFactor(0.6)
                } else {
                    Text(" ").font(.system(size: 10))
                }
            }
            .frame(maxWidth: .infinity).frame(height: 52)
            .background(tint.opacity(cell.inMonth ? strength : 0), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                if selected { RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.accentColor, lineWidth: 2) }
            }
            .opacity(cell.inMonth ? 1 : 0.28)
        }
        .buttonStyle(.plain)
        .disabled(!cell.inMonth)
        .accessibilityLabel("\(cell.date.formatted(.dateTime.weekday(.wide).day().month(.wide)))\(pnl.map { ", result \(Fmt.money($0, "USD", sign: true, decimals: 0))" } ?? "")")
    }
}
