// The public page. One argument: your own record, scored against your own checklist, shows where the edge is.
// Pictures are real fragments of the signed-in app, fed by the sample journal (see ../landing/data.ts).

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Mark } from '../ui/kit';
import { money, monthLabel, signed } from '../format';
import { landingData } from '../landing/data';
import { useFitText, useReveal } from '../landing/hooks';
import { CalendarFragment, calendarMonth, ChecklistDemo, EdgeFragments, HeroFragment, MistakeFragments, PropFragment } from '../landing/fragments';
import './Landing.css';

const R = ({ children, i = 0, kind = 'rise', className = '', as: Tag = 'div' }: { children: ReactNode; i?: number; kind?: 'rise' | 'settle' | 'row'; className?: string; as?: 'div' | 'p' | 'h2' | 'li' }) => (
  <Tag data-r={kind} className={className} style={{ ['--i' as string]: i }}>{children}</Tag>
);

const FEATURES: { name: string; text: string }[] = [
  { name: 'Trade log', text: 'Every trade with its prices, session, setup, the emotion you felt and your notes.' },
  { name: 'Checklist', text: 'Weighted items, a live score, and the score saved with the trade.' },
  { name: 'Mistake tags', text: 'Name what went wrong and see what each mistake cost you.' },
  { name: 'Reports', text: 'Edge by session, setup, confluence score and weekday.' },
  { name: 'Prop rules', text: 'Profit target, trailing drawdown, daily loss limit and trading days.' },
  { name: 'Calendar', text: 'A P&L calendar, a colour for every day, a total for every week.' },
  { name: 'Accounts', text: 'Several accounts, with deposits, withdrawals, fees and payouts kept beside the trades.' },
  { name: 'Your phone', text: 'The same journal in your phone’s browser, with lists made for a thumb.' },
];

const FAQ: { q: string; a: ReactNode }[] = [
  { q: 'What does it log?', a: 'Each trade with its symbol, side, entry, stop, target and exit, the session, the setup, the checklist and its score, the emotion you felt, your notes and any mistake tags.' },
  { q: 'How is the score worked out?', a: 'Each checklist item has a weight. The score is the weight of the items you ticked divided by the weight of all of them, shown live while you log and saved with the trade.' },
  { q: 'Does it track prop firm rules?', a: 'Yes. Mark an account as a prop firm and set its profit target, loss limit (trailing or fixed), daily loss limit and minimum trading days. The journal shows where the account stands against each one.' },
  { q: 'Can I look around first?', a: 'Yes. Explore with sample data opens the whole journal on a made-up set of trades, with no account. Nothing you change there is saved.' },
  { q: 'Does it work on my phone?', a: 'Yes. It runs in your phone’s browser with a layout of its own: the same journal, with lists in place of wide tables.' },
  { q: 'Does it place trades?', a: 'No. It is a journal, not a trading platform. It records your trades and never places an order.' },
  { q: 'What does it cost?', a: <>Basic is free. Professional is ₹850 a month, and comes with a 30-day money-back guarantee. The details are under <a href="#plans">Plans</a> and in the <Link to="/refund">refund policy</Link>.</> },
];

function Faq() {
  const [sel, setSel] = useState(0);
  return (
    <div className="lp-faq">
      <ul className="lp-faq-list">
        {FAQ.map((f, i) => (
          <li key={f.q} className={sel === i ? 'on' : ''}>
            <button type="button" aria-expanded={sel === i} aria-controls={`faq-a-${i}`} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)}>
              <span className="lp-dot" aria-hidden="true" />{f.q}
            </button>
            <div id={`faq-a-${i}`} className="lp-faq-a lp-faq-inline" hidden={sel !== i}>{f.a}</div>
          </li>
        ))}
      </ul>
      <div className="lp-faq-pane" aria-live="polite"><div key={sel} className="lp-faq-a">{FAQ[sel].a}</div></div>
    </div>
  );
}

function Footer() {
  const { box, span } = useFitText<HTMLSpanElement>('IFVG Journal');
  return (
    <footer className="lp-footer">
      <div className="lp-footer-top">
        <div className="lp-footer-what">
          <p>A trading journal for futures and forex traders who work ICT and iFVG setups. Every figure in the interface pictures is sample data.</p>
          <p className="lp-credit">Picture: <a href="https://commons.wikimedia.org/wiki/File:Dojima-Rice-Exchange-Osaka-by-Yoshimitsu-Sasaki.png">“Dojima Rice Exchange, Osaka”</a> by Yoshimitsu Sasaki, <a href="https://creativecommons.org/publicdomain/mark/1.0/">public domain</a>, via Wikimedia Commons.</p>
        </div>
        <nav className="lp-footer-links" aria-label="Footer">
          <Link to="/auth">Sign in</Link>
          <Link to="/dashboard?demo=1">Sample data</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refund">Refund</Link>
          <a href="mailto:support@ifvg.in">Support</a>
        </nav>
      </div>
      <div className="lp-name" ref={box} aria-hidden="true"><span ref={span}>IFVG Journal</span></div>
    </footer>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  useEffect(() => {
    const prev = document.title;
    document.title = 'IFVG Journal: a trading journal for iFVG traders';
    return () => { document.title = prev; };
  }, []);

  const L = landingData();
  const top = L.tiers[L.tiers.length - 1], bottom = L.tiers[0];
  const cal = useMemo(calendarMonth, []);
  const bestDay = [...cal.days].sort((a, b) => b.pnl - a.pnl)[0];
  const worstDay = [...cal.days].sort((a, b) => a.pnl - b.pnl)[0];

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="lp" ref={root}>
      <header className="lp-nav">
        <Link to="/" className="lp-brand" aria-label="IFVG Journal, home"><Mark size={26} /><span>IFVG Journal</span></Link>
        <nav className="lp-nav-links" aria-label="Page">
          <a href="#checklist">Checklist</a>
          <a href="#edge">Edge</a>
          <a href="#prop">Prop rules</a>
          <a href="#plans">Plans</a>
        </nav>
        <div className="lp-nav-end">
          <Link to="/auth" className="lp-text">Sign in</Link>
          <Link to="/auth" className="lp-btn sm">Start journaling</Link>
        </div>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="h-hero">
          <div className="lp-hero-top">
            <h1 id="h-hero" className="lp-h1">
              <span className="lp-line"><span>The trading journal</span></span>
              <span className="lp-line"><span>for iFVG traders</span></span>
            </h1>
            <div className="lp-hero-side">
              <p className="lp-lead">Log each trade against your ICT checklist, tag the mistakes, and see which session, setup and score actually pay you.</p>
              <div className="lp-actions">
                <Link to="/auth" className="lp-btn">Start journaling</Link>
                <Link to="/dashboard?demo=1" className="lp-text">Explore with sample data</Link>
              </div>
            </div>
          </div>
          <div className="lp-hero-pic"><HeroFragment /></div>
          <p className="lp-cap">Sample data: {L.summary.count} closed trades across {L.accounts === 2 ? 'two' : L.accounts} accounts.</p>
        </section>

        <section id="checklist" className="lp-sec lp-split" aria-labelledby="h-check">
          <div className="lp-copy">
            <R as="h2" className="lp-h2"><span id="h-check">A checklist with a live score</span></R>
            <R i={1} as="p" className="lp-p">Tick what is on the chart and the score follows, weighted by the items you care about most. Each trade keeps its score, so the journal can show what your fuller setups paid against your thinner ones.</R>
            <R i={2} className="lp-figs">
              <p><b className="lp-fig j-pos">{money(top.expectancy, 'USD', { sign: true, decimals: 0 })}</b><span>a trade at {top.label.toLowerCase()}, over {top.count} trades</span></p>
              <p><b className="lp-fig j-neg">{money(bottom.expectancy, 'USD', { decimals: 0 })}</b><span>a trade at {bottom.label.toLowerCase()}, over {bottom.count} trades</span></p>
            </R>
          </div>
          <R kind="settle" className="lp-pic"><ChecklistDemo /></R>
        </section>

        <section id="edge" className="lp-sec lp-rows" aria-labelledby="h-edge">
          <div className="lp-rows-head">
            <R as="h2" className="lp-h2"><span id="h-edge">Your edge has a session and a day</span></R>
            <R i={1} as="p" className="lp-p">Every trade carries its session. The matrix sets weekdays against sessions, so a weak Wednesday lunch or a strong New York morning shows as a colour, not a hunch.</R>
          </div>
          <R kind="settle" className="lp-pic"><EdgeFragments /></R>
        </section>

        <section id="mistakes" className="lp-sec lp-split lp-rev" aria-labelledby="h-mist">
          <div className="lp-copy">
            <R as="h2" className="lp-h2"><span id="h-mist">Mistakes, with a price</span></R>
            <R i={1} as="p" className="lp-p">Tag a trade with what went wrong: a moved stop, a FOMO entry, a revenge trade. The journal adds up what each tag cost on the trades that lost, and how much of your record is clean.</R>
            {L.adherence && (
              <R i={2} className="lp-figs">
                <p><b className="lp-fig">{L.adherence.clean} of {L.adherence.total}</b><span>sample trades carry no mistake tag, and net {money(L.adherence.cleanNet, 'USD', { sign: true, decimals: 0 })}</span></p>
              </R>
            )}
          </div>
          <R kind="settle" className="lp-pic"><MistakeFragments /></R>
        </section>

        <section id="prop" className="lp-sec lp-band" aria-labelledby="h-prop">
          <div className="lp-rows-head">
            <R as="h2" className="lp-h2"><span id="h-prop">Prop firm rules, tracked</span></R>
            <R i={1} as="p" className="lp-p">Set the profit target, the loss limit and whether it trails, the daily loss limit and the minimum trading days. The account shows where it stands against each one, and the equity line is drawn between the target and the floor.</R>
          </div>
          <R kind="settle" className="lp-pic"><PropFragment /></R>
        </section>

        <section id="calendar" className="lp-sec lp-split lp-wide" aria-labelledby="h-cal">
          <div className="lp-copy">
            <R as="h2" className="lp-h2"><span id="h-cal">Your month, day by day</span></R>
            <R i={1} as="p" className="lp-p">Each day takes the colour of its result, and every week has its total. Open a day to see the trades behind it.</R>
            {bestDay && (
              <R i={2} className="lp-figs">
                <p><b className="lp-fig">{cal.days.filter((d) => d.pnl > 0).length} of {cal.days.length}</b><span>days green in {monthLabel(cal.m)}</span></p>
                <p><b className="lp-fig j-pos">{money(bestDay.pnl, 'USD', { sign: true, decimals: 0 })}</b><span>the best day, over {bestDay.count} trades</span></p>
              </R>
            )}
          </div>
          <R kind="settle" className="lp-pic"><CalendarFragment /></R>
        </section>

        <section className="lp-sec lp-features" aria-labelledby="h-feat">
          <ul className="lp-flist">
            <li className="lp-frow lp-frow-h"><h2 id="h-feat" className="lp-fname">In the journal</h2></li>
            {FEATURES.map((f, i) => (
              <li key={f.name} className="lp-frow" data-r="row" style={{ ['--i' as string]: Math.min(i, 3) }}>
                <span className="lp-fname">{f.name}</span>
                <span className="lp-ftext">{f.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <figure className="lp-picband" aria-label="Archive picture">
          <div className="lp-picband-img" data-r="pic">
            <img src="/landing/dojima-rice-exchange.jpg" width="1920" height="831" loading="lazy" decoding="async"
              alt="Colour woodblock print of the Dōjima rice exchange in Osaka: a long pavilion on stilts over the river, crowded with traders, with boats and sails below." />
          </div>
          <figcaption>The Dōjima rice exchange, Osaka, about 1880. Futures were first traded in this market.</figcaption>
        </figure>

        <section id="plans" className="lp-sec lp-plans" aria-labelledby="h-plans">
          <R as="h2" className="lp-h2 lp-plans-h"><span id="h-plans">Plans</span></R>
          <div className="lp-fields">
            <article className="lp-field lp-field-a" data-r="rise">
              <h3 className="lp-pname">Basic</h3>
              <p className="lp-psub">To start journaling on one account.</p>
              <p className="lp-pinc">Up to 20 trades a month, basic performance analytics, the P&amp;L calendar, one trading account and a basic confluence checklist.</p>
              <div className="lp-pfoot">
                <p className="lp-price"><span>₹0</span><small>a month</small></p>
                <Link to="/auth" className="lp-btn ghost">Start journaling</Link>
              </div>
            </article>
            <article className="lp-field lp-field-b" data-r="rise" style={{ ['--i' as string]: 1 }}>
              <h3 className="lp-pname">Professional</h3>
              <p className="lp-psub">For traders who log every trade, on several accounts.</p>
              <p className="lp-pinc">Unlimited trades, advanced analytics and reports, multiple trading accounts, custom strategies and rules, the advanced confluence system, trade screenshots and notes, export and backup, and priority support.</p>
              <div className="lp-pfoot">
                <p className="lp-price"><span>₹850</span><small>a month</small></p>
                <Link to="/auth" className="lp-btn">Start journaling</Link>
              </div>
            </article>
          </div>
          <p className="lp-plans-note">Professional comes with a 30-day money-back guarantee. Read the <Link to="/refund">refund policy</Link>.</p>
        </section>

        <section id="faq" className="lp-sec" aria-labelledby="h-faq">
          <div className="lp-faq-wrap">
            <R as="h2" className="lp-h2 lp-faq-h"><span id="h-faq">Questions</span></R>
            <R kind="rise" i={1}><Faq /></R>
          </div>
        </section>

        <section className="lp-sec lp-cta" aria-labelledby="h-cta">
          <div className="lp-cta-row">
            {worstDay && (
              <div data-ui className="lp-tile lp-tile-l" aria-hidden="true">
                <div className={`j-day ${worstDay.pnl < 0 ? 'loss' : 'win'}`} style={{ ['--k' as string]: 1 }}>
                  <span className="d">Worst day</span>
                  <span><span className="v">{signed(worstDay.pnl, 0)}</span><span className="c">{worstDay.count} trades</span></span>
                </div>
              </div>
            )}
            <div className="lp-tile lp-tile-c" data-r="settle">
              <h2 id="h-cta" className="lp-cta-h">Log your next trade</h2>
              <p className="lp-cta-p">Create a free account and log your first trade against your checklist. The sample journal is open if you would rather look around first.</p>
              <div className="lp-actions">
                <Link to="/auth" className="lp-btn dark">Start journaling</Link>
                <Link to="/dashboard?demo=1" className="lp-text dark">Explore with sample data</Link>
              </div>
            </div>
            {bestDay && (
              <div data-ui className="lp-tile lp-tile-r" aria-hidden="true">
                <div className="j-day win" style={{ ['--k' as string]: 1 }}>
                  <span className="d">Best day</span>
                  <span><span className="v">{signed(bestDay.pnl, 0)}</span><span className="c">{bestDay.count} trades</span></span>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
