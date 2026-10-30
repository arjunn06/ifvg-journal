import SwiftUI

/// The IFVG mark: three candles over a blue range bar (the web logo, drawn natively so it stays crisp).
struct LogoMark: View {
    var size: CGFloat = 84
    var body: some View {
        Canvas { ctx, s in
            let k = s.width / 28
            func rect(_ x: Double, _ y: Double, _ w: Double, _ h: Double, _ c: Color) {
                ctx.fill(Path(CGRect(x: x * k, y: y * k, width: w * k, height: h * k)), with: .color(c))
            }
            rect(6.5 - 0.6, 13, 1.2, 14, .white); rect(14 - 0.6, 4, 1.2, 18, .white); rect(21.5 - 0.6, 1, 1.2, 13, .white)
            rect(4, 16, 5, 8, .white); rect(11.5, 8, 5, 11, .white); rect(19, 3, 5, 9, .white)
            rect(4, 12, 20, 4, Color(red: 0.29, green: 0.54, blue: 0.84))
        }
        .frame(width: size, height: size)
        .background(Color(red: 0.09, green: 0.09, blue: 0.10), in: RoundedRectangle(cornerRadius: size * 0.225, style: .continuous))
        .shadow(color: .black.opacity(0.15), radius: 14, y: 6)
        .accessibilityHidden(true)
    }
}

struct AuthView: View {
    @Environment(AuthService.self) private var auth
    @Environment(JournalStore.self) private var store

    enum Mode: String, CaseIterable { case signIn = "Sign In", signUp = "Create Account" }
    @State private var mode: Mode = .signIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var working = false
    @State private var message: String?
    @State private var info: String?
    @FocusState private var focus: Field?
    enum Field { case name, email, password }

    private var canSubmit: Bool { email.contains("@") && password.count >= 6 && !working }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 14) {
                    LogoMark()
                    Text("IFVG Journal").font(.largeTitle.bold())
                    Text("Log it. Review it. Trade it better.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                .padding(.top, 56)

                Picker("Mode", selection: $mode) { ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) } }
                    .pickerStyle(.segmented)

                VStack(spacing: 0) {
                    if mode == .signUp {
                        field { TextField("Name", text: $name).textContentType(.name).focused($focus, equals: .name).submitLabel(.next) }
                        Divider().padding(.leading, 16)
                    }
                    field {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                            .autocorrectionDisabled().focused($focus, equals: .email).submitLabel(.next)
                    }
                    Divider().padding(.leading, 16)
                    field {
                        SecureField("Password", text: $password)
                            .textContentType(mode == .signIn ? .password : .newPassword)
                            .focused($focus, equals: .password).submitLabel(.go).onSubmit(submit)
                    }
                }
                .background(Color.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))

                if let message { Text(message).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center) }
                if let info { Text(info).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center) }
                if let pending = auth.awaitingConfirmation {
                    Text("We sent a confirmation link to \(pending). Open it, then sign in.")
                        .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }

                VStack(spacing: 12) {
                    Button(action: submit) {
                        Group { if working { ProgressView() } else { Text(mode == .signIn ? "Sign In" : "Create Account").font(.headline) } }
                            .frame(maxWidth: .infinity, minHeight: 28)
                    }
                    .buttonStyle(.glassProminent).controlSize(.large).disabled(!canSubmit)

                    if mode == .signIn {
                        Button("Forgot Password?", action: forgot).font(.subheadline).disabled(!email.contains("@") || working)
                    }

                    HStack { Rectangle().fill(.quaternary).frame(height: 1); Text("or").font(.footnote).foregroundStyle(.secondary); Rectangle().fill(.quaternary).frame(height: 1) }
                        .padding(.vertical, 4)

                    Button { store.startDemo() } label: {
                        Label("Explore with Sample Data", systemImage: "sparkles").font(.headline).frame(maxWidth: .infinity, minHeight: 28)
                    }
                    .buttonStyle(.glass).controlSize(.large)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 40)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Color.groupedBackground.ignoresSafeArea())
        .animation(.smooth, value: mode)
        .onChange(of: mode) { message = nil; info = nil }
    }

    private func field<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        c().padding(.horizontal, 16).frame(height: 52)
    }

    private func submit() {
        guard canSubmit else { return }
        working = true; message = nil; info = nil
        Task {
            defer { working = false }
            do {
                if mode == .signIn { try await auth.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password) }
                else { try await auth.signUp(email: email.trimmingCharacters(in: .whitespaces), password: password, name: name) }
            } catch { message = error.localizedDescription }
        }
    }

    private func forgot() {
        working = true; message = nil
        Task {
            defer { working = false }
            do { try await auth.sendReset(email: email.trimmingCharacters(in: .whitespaces)); info = "If that email has an account, a reset link is on its way." }
            catch { message = error.localizedDescription }
        }
    }
}
