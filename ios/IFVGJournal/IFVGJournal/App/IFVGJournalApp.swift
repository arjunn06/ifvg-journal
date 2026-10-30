import SwiftUI

@main
struct IFVGJournalApp: App {
    @State private var auth = AuthService()
    @State private var store = JournalStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(store)
                .task { auth.restore() }
        }
    }
}
