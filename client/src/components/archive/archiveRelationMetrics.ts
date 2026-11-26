/** Medição compartilhada entre a cápsula (DOM) e o roteador (puro).
 *
 * O roteador nunca mede o DOM: usa a última largura conhecida do rótulo, que o
 * ArchiveRelationLabel atualiza em eventos de layout — nunca por frame.
 */
export const ARCHIVE_RELATION_LABEL_HEIGHT = 26;

const widths = new Map<string, number>();

const estimate = (label: string) => Math.max(88, label.length * 7 + 30);

export function estimateArchiveRelationLabelWidth(label: string): number {
  return widths.get(label) ?? estimate(label);
}

export function rememberArchiveRelationLabelWidth(
  label: string,
  width: number,
): void {
  if (!Number.isFinite(width) || width <= 0) return;
  if (widths.size >= 512) widths.clear();
  widths.set(label, Math.max(88, Math.round(width)));
}

export interface ArchiveRelationLabelBox {
  width: number;
  height: number;
}

export function archiveRelationLabelBox(label: string): ArchiveRelationLabelBox {
  return {
    width: estimateArchiveRelationLabelWidth(label),
    height: ARCHIVE_RELATION_LABEL_HEIGHT,
  };
}
