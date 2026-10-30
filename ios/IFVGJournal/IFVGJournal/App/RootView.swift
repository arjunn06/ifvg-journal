import SwiftUI

struct RootView: View {
    @Environment(AuthService.self) private var auth
    @Environment(JournalStore.self) private var store

    var body: some View {
        Group {
            if auth.isRestoring {
                Color.groupedBackground.ignoresSafeArea().overlay { ProgressView() }
            } else if auth.isSignedIn || store.isDemo {
                MainTabs()
                    .transition(.opacity)
            } else {
                AuthView()
                    .transition(.opacity)
            }
        }
        .animation(.smooth, value: auth.isSignedIn || store.isDemo)
        .task(id: auth.userId) {
            if auth.isSignedIn { await store.startLive(auth: auth) }
            else if !store.isDemo { store.reset() }
        }
    }
}

enum AppTab: Hashable { case summary, calendar, browse, log }

/// Lets any screen start the log flow (empty states, the Today card) without knowing about the tab bar.
private struct OpenLogKey: EnvironmentKey { static let defaultValue: () -> Void = {} }
extension EnvironmentValues {
    var openLog: () -> Void {
        get { self[OpenLogKey.self] }
        set { self[OpenLogKey.self] = newValue }
    }
}

/// Summary · Calendar · Browse in the floating Liquid Glass bar, with the Log button detached on the trailing
/// side exactly where the system puts a `.search`-role tab (that is the native way to get the Health-app look).
struct MainTabs: View {
    @State private var tab: AppTab = .summary
    @State private var showLog = false

    var body: some View {
        TabView(selection: $tab) {
            Tab("Summary", systemImage: "chart.bar.xaxis", value: AppTab.summary) { SummaryView() }
            Tab("Calendar", systemImage: "calendar", value: AppTab.calendar) { CalendarTab() }
            Tab("Browse", systemImage: "square.grid.2x2", value: AppTab.browse) { BrowseView() }
            Tab(value: AppTab.log, role: .search) {
                Color.clear
            } label: {
                Label("Log Trade", systemImage: "plus")
            }
        }
        // The plus is an action, not a destination: bounce the selection back and present the log sheet.
        .onChange(of: tab) { old, new in
            guard new == .log else { return }
            tab = old
            showLog = true
        }
        .environment(\.openLog, { showLog = true })
        .sheet(isPresented: $showLog) { QuickLogFlow() }
    }
}
