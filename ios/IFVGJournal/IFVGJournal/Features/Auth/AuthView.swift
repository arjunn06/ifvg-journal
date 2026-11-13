import SwiftUI

/// The IFVG mark: the logo glyph, white on the dark tile (the web logo, drawn natively so it stays crisp).
struct LogoMark: View {
    var size: CGFloat = 84
    var body: some View {
        Canvas { ctx, s in
            // The master artwork's glyph spans 86 units centred on (96, 92); it fills 60% of the tile.
            let k = s.width * 0.6 / 86
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: s.width / 2 + (x - 96) * k, y: s.height / 2 + (y - 92) * k)
            }
            var shape = Path()
            shape.move(to: p(53, 135))
            shape.addLines([p(74.5, 113.5), p(96, 92), p(117.5, 70.5), p(139, 70.5), p(139, 135),
                            p(117.5, 135), p(117.5, 102.75), p(85.25, 135)])
            shape.closeSubpath()
            shape.move(to: p(139, 70.5))
            shape.addLines([p(117.5, 70.5), p(139, 49)])
            shape.closeSubpath()
            ctx.fill(shape, with: .color(.white))
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
