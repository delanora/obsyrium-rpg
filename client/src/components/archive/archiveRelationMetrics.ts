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
  const next = Math.max(88, Math.round(width));
  const previous = widths.get(label);
  if (widths.size >= 512) widths.clear();
  widths.set(label, next);
  if (previous === next) return;
  for (const listener of listeners) listener();
}

/**
 * Inscritos avisados quando uma largura medida muda. O canvas usa isto para
 * reavaliar a assinatura do plano — com tolerância, não a cada medição.
 */
const listeners = new Set<() => void>();

export function onArchiveRelationLabelWidthsChange(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Larguras já medidas para os textos pedidos (sem estimativas). */
export function archiveRelationMeasuredWidths(
  labels: Iterable<string>,
): [string, number][] {
  const out: [string, number][] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const width = widths.get(label);
    if (width !== undefined) out.push([label, width]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Passo de quantização: oscilações menores não replanejam o quadro. */
export const ARCHIVE_RELATION_LABEL_WIDTH_STEP = 8;

/**
 * Assinatura das larguras de rótulo, quantizada. Entra na assinatura do plano
 * para que uma mudança relevante (fonte carregada, texto novo) replaneje, e
 * uma oscilação de poucos pixels não.
 */
export function archiveRelationLabelSignature(
  labels: Iterable<string>,
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const width = Math.round(
      estimateArchiveRelationLabelWidth(label) /
        ARCHIVE_RELATION_LABEL_WIDTH_STEP,
    );
    parts.push(`${label}:${width}`);
  }
  return parts.sort().join("|");
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
