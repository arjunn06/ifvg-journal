import type { ReactNode } from 'react';
import { ViewOverrideContext } from '../view';

/**
 * Marketing and sign-in surfaces show sample figures as money whatever the signed-in user chose in the header.
 * Components below read the mode with useViewMode(), which honours this; string formatting on these pages uses
 * the `*Plain` functions in format.ts.
 */
export function PlainFigures({ children }: { children: ReactNode }) {
  return <ViewOverrideContext.Provider value="money">{children}</ViewOverrideContext.Provider>;
}
