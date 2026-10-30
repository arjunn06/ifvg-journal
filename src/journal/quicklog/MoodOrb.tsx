import { moodAt } from './logic';

/** The state-of-mind slider: an organic orb that swells and changes colour with the value, and a pill slider under it.
 *  The slider is a real range input, so arrow keys, Home/End and screen readers work. */
export function MoodOrb({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const mood = moodAt(value);
  const v = value / 100;
  // the hue follows the value continuously between the seven stops (unpleasant red, warm amber, neutral blue, pleasant green)
  const stops = [-10, 14, 40, 205, 190, 170, 150];
  const pos = v * (stops.length - 1), i0 = Math.min(stops.length - 2, Math.floor(pos));
  const h = (stops[i0] + (stops[i0 + 1] - stops[i0]) * (pos - i0) + 360) % 360;
  return (
    <div className="ql-mood" style={{ ['--h' as string]: h.toFixed(0), ['--s' as string]: (0.78 + v * 0.42).toFixed(3) }}>
      <div className="ql-orb" aria-hidden="true">
        <span className="rg r4" /><span className="rg r3" /><span className="rg r2" /><span className="rg r1" />
        <span className="face">{mood.emoji}</span>
      </div>
      <div className="ql-mood-label" aria-live="polite">{mood.label}</div>
      <input
        className="ql-range" type="range" min={0} max={100} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="State of mind when you took the trade" aria-valuetext={mood.label}
        style={{ ['--p' as string]: `${value}%` }}
      />
      <div className="ql-range-ends"><span>Very unpleasant</span><span>Very pleasant</span></div>
    </div>
  );
}
