// How money is shown across the signed-in app, chosen from the header:
//   money    $1,240.00        the figures as recorded
//   percent  +2.48%           each amount as a share of the starting balance of the account(s) in view
//   hidden   •••              no figures at all; results keep their green / red, so a screenshot still reads
//
// `money()` and friends in format.ts read this store, so the ~200 places that print an amount follow the
// switch without knowing about it. JournalProvider subscribes (useViewMode) and so re-renders every screen
// when the mode changes. Marketing pages opt out with <PlainFigures> (see ui/PlainFigures.tsx).

import { createContext, useContext, useSyncExternalStore } from 'react';

export type ViewMode = 'money' | 'percent' | 'hidden';
export const VIEW_MODES: readonly ViewMode[] = ['money', 'percent', 'hidden'];

const KEY = 'ifvg-view-mode';
const isMode = (v: unknown): v is ViewMode => v === 'money' || v === 'percent' || v === 'hidden';

function load(): ViewMode {
  try {
    const v = localStorage.getItem(KEY);
    if (isMode(v)) return v;
  } catch { /* storage blocked */ }
  return 'money';
}

let mode: ViewMode = load();
let base = 0;
const listeners = new Set<() => void>();

export const getViewMode = () => mode;
export function setViewMode(next: ViewMode) {
  if (next === mode) return;
  mode = next;
  try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/**
 * The denominator for percent view when a call site does not name one: the starting balance of the accounts in
 * scope. JournalProvider derives it from its own state on every render, before any screen below it renders,
 * so this is a cache of derived data, not independent state.
 */
export const getPercentBase = () => base;
export const setPercentBase = (n: number) => { base = n; };

/** The mode the user picked. A screen that calls this re-renders when the header switch changes. */
export function useStoredViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, getViewMode, getViewMode);
}

/** Pages that must always print real figures (the landing page, the sign-in preview) set this to 'money'. */
export const ViewOverrideContext = createContext<ViewMode | null>(null);

/** The mode in force for the caller: an override from above wins over the user's pick. */
export function useViewMode(): ViewMode {
  const stored = useStoredViewMode();
  return useContext(ViewOverrideContext) ?? stored;
}
