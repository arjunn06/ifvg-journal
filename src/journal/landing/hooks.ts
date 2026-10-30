import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Matches a media query, live. Starts false on the server and on first paint. */
export function useMedia(query: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

/**
 * Entrances: elements marked data-r are shown at once when scripts or motion are off. With motion on, they start
 * lowered and transparent and rise once as they enter the viewport. Transform and opacity only.
 */
export function useReveal(root: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm || !('IntersectionObserver' in window)) return;
    el.dataset.motion = 'on';
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { (e.target as HTMLElement).classList.add('is-in'); io.unobserve(e.target); }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    el.querySelectorAll('[data-r]').forEach((n) => io.observe(n));
    return () => { io.disconnect(); delete el.dataset.motion; };
  }, [root]);
}

/** Sets a font size so that one line of text exactly fills its container's width. */
export function useFitText<T extends HTMLElement>(text: string) {
  const box = useRef<HTMLDivElement>(null);
  const span = useRef<T>(null);
  useLayoutEffect(() => {
    const b = box.current, s = span.current;
    if (!b || !s) return;
    const fit = () => {
      s.style.fontSize = '100px';
      const w = s.getBoundingClientRect().width;
      if (w > 0) s.style.fontSize = `${(100 * b.clientWidth) / w}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(b);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [text]);
  return { box, span };
}
