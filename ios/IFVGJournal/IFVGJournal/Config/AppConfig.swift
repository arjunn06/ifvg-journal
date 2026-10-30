import Foundation

/// Same Supabase project as the web app. The key is the project's public (anon / publishable) key,
/// the one the web bundle ships; row-level security is what protects the data.
enum AppConfig {
    static let supabaseURL = URL(string: "https://dynibyqrcbxneiwjyahn.supabase.co")!
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5bmlieXFyY2J4bmVpd2p5YWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjM3NjIsImV4cCI6MjA2ODMzOTc2Mn0.Dr-GmXwz-IOMUAWrJHfoRvekkZcBNtlnJIQKC4wjCcQ"
}
