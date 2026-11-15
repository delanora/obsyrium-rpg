import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Destino local ao workspace: reposiciona os controles sem duplicar o estado do grid. */
export const GridToolbarContext = createContext<HTMLElement | null>(null);
export function GridToolbarSlot({ children }: { children: ReactNode }) {
  const target = useContext(GridToolbarContext);
  return target ? createPortal(children, target) : children;
}
