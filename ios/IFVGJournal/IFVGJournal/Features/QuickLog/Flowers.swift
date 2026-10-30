import SwiftUI

// The glassy flower illustrations from Apple's State of Mind flow, drawn with SwiftUI shapes:
// translucent petals with a bright rim and a soft glow, so they sit on the gradient like glass.

/// A teardrop petal, narrow at the base and round at the tip.
private struct Petal: Shape {
    /// 0 = a thin pointed blade, 1 = a full round petal.
    var roundness: Double
    var animatableData: Double { get { roundness } set { roundness = newValue } }
    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height
        let shoulder = 0.30 + 0.2 * roundness              // how far up the widest point sits
        p.move(to: CGPoint(x: r.midX, y: r.maxY))
        p.addCurve(to: CGPoint(x: r.midX, y: r.minY),
                   control1: CGPoint(x: r.midX - w * (0.55 + 0.35 * roundness), y: r.maxY - h * shoulder),
                   control2: CGPoint(x: r.midX - w * (0.50 + 0.10 * roundness), y: r.minY + h * 0.02))
        p.addCurve(to: CGPoint(x: r.midX, y: r.maxY),
                   control1: CGPoint(x: r.midX + w * (0.50 + 0.10 * roundness), y: r.minY + h * 0.02),
                   control2: CGPoint(x: r.midX + w * (0.55 + 0.35 * roundness), y: r.maxY - h * shoulder))
        return p
    }
}

struct FlowerView: View {
    /// 0...1 on the colour wheel.
    var hue: Double
    var petals = 8
    /// 0 = a closed bud, 1 = fully open.
    var bloom: Double = 1
    var roundness: Double = 0.8
    var size: CGFloat = 200
    var saturation: Double = 0.62

    var body: some View {
        let outer = Color(hue: hue, saturation: saturation, brightness: 0.98)
        let inner = Color(hue: hue + 0.02, saturation: min(1, saturation + 0.3), brightness: 0.88)
        ZStack {
            layer(count: petals, length: 0.50, width: 0.30, offset: 0, outer: outer.opacity(0.78), inner: inner.opacity(0.55))
            layer(count: petals, length: 0.34, width: 0.22, offset: 0.5, outer: outer.opacity(0.95), inner: inner)
            Circle()
                .fill(RadialGradient(colors: [.white, .white.opacity(0.9), inner.opacity(0.0)], center: .center, startRadius: 0, endRadius: size * 0.06))
                .frame(width: size * 0.12 * (0.6 + 0.4 * bloom), height: size * 0.12 * (0.6 + 0.4 * bloom))
        }
        .frame(width: size, height: size)
        .shadow(color: inner.opacity(0.35), radius: size * 0.08, y: size * 0.03)
        .animation(.smooth(duration: 0.25), value: hue)
        .animation(.smooth(duration: 0.25), value: bloom)
        .animation(.smooth(duration: 0.25), value: roundness)
        .accessibilityHidden(true)
    }

    private func layer(count: Int, length: Double, width: Double, offset: Double, outer: Color, inner: Color) -> some View {
        let b = 0.45 + 0.55 * bloom
        return ZStack {
            ForEach(0..<count, id: \.self) { i in
                Petal(roundness: roundness)
                    .fill(LinearGradient(colors: [outer, inner], startPoint: .top, endPoint: .bottom))
                    .overlay {
                        Petal(roundness: roundness)
                            .stroke(LinearGradient(colors: [.white.opacity(0.85), .white.opacity(0.1)], startPoint: .top, endPoint: .bottom), lineWidth: max(0.8, size * 0.006))
                    }
                    .frame(width: size * width * b * (0.7 + 0.3 * roundness), height: size * length * b)
                    .frame(width: size * width, height: size * length * 2, alignment: .top)
                    .rotationEffect(.degrees((Double(i) + offset) * 360 / Double(count)), anchor: .center)
            }
        }
    }
}

/// A glass bubble: a soft disc with a bright ring and a centre dot (the round shapes in the reference).
struct BubbleView: View {
    var hue: Double
    var size: CGFloat = 70
    var body: some View {
        ZStack {
            Circle().fill(RadialGradient(colors: [Color(hue: hue, saturation: 0.45, brightness: 1).opacity(0.25), Color(hue: hue, saturation: 0.55, brightness: 0.95).opacity(0.85)],
                                         center: .center, startRadius: 0, endRadius: size / 2))
            Circle().strokeBorder(LinearGradient(colors: [.white.opacity(0.9), .white.opacity(0.05)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1.5)
            Circle().fill(Color(hue: hue, saturation: 0.35, brightness: 1).opacity(0.7)).frame(width: size * 0.36, height: size * 0.36)
            Circle().fill(.white.opacity(0.9)).frame(width: size * 0.08, height: size * 0.08)
        }
        .frame(width: size, height: size)
        .shadow(color: Color(hue: hue, saturation: 0.6, brightness: 0.9).opacity(0.3), radius: 8, y: 3)
        .accessibilityHidden(true)
    }
}

/// A star-shaped bloom (the small purple one in the reference).
struct StarBloomView: View {
    var hue: Double
    var size: CGFloat = 60
    var body: some View {
        FlowerView(hue: hue, petals: 7, bloom: 0.8, roundness: 0.1, size: size, saturation: 0.7)
    }
}

/// The hero cluster that opens the flow: a handful of flowers and bubbles that drift gently.
struct FlowerCluster: View {
    @State private var float = false
    var body: some View {
        ZStack {
            piece(x: -118, y: 28, phase: 0) { FlowerView(hue: 0.60, petals: 9, bloom: 1, roundness: 0.9, size: 96) }
            piece(x: -44, y: -34, phase: 1) { FlowerView(hue: 0.27, petals: 5, bloom: 1, roundness: 1, size: 104, saturation: 0.7) }
            piece(x: -42, y: 52, phase: 2) { FlowerView(hue: 0.08, petals: 6, bloom: 1, roundness: 0.5, size: 34, saturation: 0.75) }
            piece(x: 36, y: 18, phase: 3) { FlowerView(hue: 0.06, petals: 8, bloom: 1, roundness: 0.85, size: 150, saturation: 0.55) }
            piece(x: 124, y: -26, phase: 1) { BubbleView(hue: 0.53, size: 84) }
            piece(x: 160, y: 40, phase: 2) { StarBloomView(hue: 0.72, size: 62) }
            piece(x: -124, y: -52, phase: 3) { BubbleView(hue: 0.52, size: 34) }
        }
        .frame(height: 190)
        .onAppear { withAnimation(.easeInOut(duration: 3.2).repeatForever(autoreverses: true)) { float = true } }
    }

    private func piece<V: View>(x: CGFloat, y: CGFloat, phase: Int, @ViewBuilder _ v: () -> V) -> some View {
        v().offset(x: x, y: y + (float ? CGFloat(phase % 2 == 0 ? -5 : 5) : CGFloat(phase % 2 == 0 ? 5 : -5)))
    }
}
