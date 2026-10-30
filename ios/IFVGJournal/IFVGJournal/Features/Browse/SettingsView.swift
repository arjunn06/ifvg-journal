import SwiftUI

struct SettingsView: View {
    @Environment(AuthService.self) private var auth
    @Environment(JournalStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var confirmSignOut = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        LogoMark(size: 48)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(store.isDemo ? "Sample Data" : (auth.email ?? "Signed In")).font(.headline)
                            Text(store.isDemo ? "Changes stay on this device until you leave." : "Synced with your IFVG Journal account.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Journal") {
                    LabeledContent("Accounts", value: "\(store.accounts.count)")
                    LabeledContent("Trades", value: Fmt.int(store.trades.count))
                    LabeledContent("Setups", value: "\(store.strategies.count)")
                    if !store.isDemo {
                        Button { Task { await store.refresh(showSpinner: true) } } label: { Label("Refresh Now", systemImage: "arrow.clockwise") }
                    }
                }

                Section {
                    if store.isDemo {
                        Button { store.reset(); dismiss() } label: { Label("Exit Sample Data", systemImage: "rectangle.portrait.and.arrow.right") }
                    } else {
                        Button(role: .destructive) { confirmSignOut = true } label: { Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right") }
                    }
                }

                Section {
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                } footer: { Text("IFVG Journal for iPhone shares one account and one database with the web app.") }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .confirmationDialog("Sign out of IFVG Journal?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) { Task { await auth.signOut(); store.reset(); dismiss() } }
            }
        }
    }
}
