import {
  useLayoutEffect,
  useState,
  type RefObject,
  type HTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

/** Painel fora do recorte da barra rolável, ancorado no controle que o abriu. */
export function ArchiveDockPopover({
  anchor,
  ...props
}: HTMLAttributes<HTMLElement> & { anchor: RefObject<HTMLElement | null> }) {
  const [posicao, setPosicao] = useState<{
    left: number;
    bottom: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  useLayoutEffect(() => {
    const posicionar = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(350, window.innerWidth - 24);
      const bottom = Math.max(12, window.innerHeight - rect.top + 10);
      setPosicao({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        bottom,
        width,
        maxHeight: Math.max(100, window.innerHeight - bottom - 12),
      });
    };
    posicionar();
    const barra = anchor.current?.closest(".archive-dock-row");
    barra?.addEventListener("scroll", posicionar, { passive: true });
    window.addEventListener("resize", posicionar);
    return () => {
      barra?.removeEventListener("scroll", posicionar);
      window.removeEventListener("resize", posicionar);
    };
  }, [anchor]);
  return posicao
    ? createPortal(
        <section {...props} style={{ ...posicao, ...props.style }} />,
        document.body,
      )
    : null;
}
