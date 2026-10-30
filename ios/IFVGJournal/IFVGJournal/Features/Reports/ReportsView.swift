import SwiftUI

enum ReportTab: String, CaseIterable, Identifiable {
    case edge = "Edge", behaviour = "Behaviour", distribution = "Distribution", periods = "Periods"
    var id: String { rawValue }
}

enum ReportSpan: String, CaseIterable, Identifiable {
    case weekly = "Weekly", monthly = "Monthly"
    var id: String { rawValue }
}

/// Reports: where the edge is, how behaviour changes results, the shape of outcomes, and period by period totals.
/// Pushed from Browse inside the caller's NavigationStack.
struct ReportsView: View {
    @Environment(JournalStore.self) private var store
    @State private var tab: ReportTab = .edge
    @State private var span: ReportSpan = .weekly

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Picker("Report", selection: $tab) {
                    ForEach(ReportTab.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                if tab == .periods {
                    Picker("Span", selection: $span) {
                        ForEach(ReportSpan.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                } else {
                    PeriodPicker()
                }

                content
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 24)
        }
        .background(Color.groupedBackground.ignoresSafeArea())
        .navigationTitle("Reports")
        .navigationBarTitleDisplayMode(.large)
    }

    private var hasClosedInView: Bool { store.viewTrades.contains(where: \.isClosed) }
    private var hasClosedInScope: Bool { store.scopeTrades.contains(where: \.isClosed) }

    @ViewBuilder private var content: some View {
        if tab == .periods {
            if hasClosedInScope {
                ReportPeriodsTab(span: span)
            } else {
                emptyHint
            }
        } else if !hasClosedInView {
            emptyHint
        } else {
            switch tab {
            case .edge: ReportEdgeTab()
            case .behaviour: ReportBehaviourTab()
            case .distribution: ReportDistributionTab()
            case .periods: EmptyView()
            }
        }
    }

    private var emptyHint: some View {
        EmptyHint(symbol: "chart.bar.xaxis", title: "No Closed Trades",
                  message: tab == .periods ? "Close a trade to see it summed by week and month."
                                           : "Close a trade in this period to see your reports.")
            .padding(.top, 24)
    }
}
