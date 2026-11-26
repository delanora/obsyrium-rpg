/** Verificação geométrica do caminho REALMENTE desenhado.
 *
 * O traço renderizado é `archiveLinkPathCommands(pontos)`: linhas e arcos
 * quadráticos já arredondados. Validar a polilinha original (ou reconstruir o
 * arco por amostragem) provava outra curva. Aqui cada comando é testado como
 * será pintado:
 *
 * - `L`: teste exato de segmento contra retângulo (Liang–Barsky), inclusive
 *   segmentos degenerados (comprimento zero viram teste de ponto);
 * - `Q`: subdivisão de De Casteljau. Enquanto a corda do sub-arco, inflada pelo
 *   desvio máximo da curva em relação à corda (`|P0 − 2C + P2| / 4`), não toca o
 *   retângulo, a ausência de interseção é **demonstrada**, não amostrada; se a
 *   subdivisão esgotar o orçamento, o resultado é inconclusivo e a rota fica
 *   `unverified`.
 *
 * Categorias, explícitas:
 * - `hit` — o traço entra mais de `clearance` unidades no interior de um card
 *   (interseção real; vira `residual` e estado `intersects`);
 * - `touch` — o traço encosta na caixa ou entra até `clearance` unidades:
 *   folga visual declarada (borda, arredondamento de duas casas, porta do
 *   próprio vínculo). Não é interseção, mas também não é "ausência de contato";
 * - `conclusive === false` — região não verificada (orçamento/profundidade):
 *   nunca é reportada como livre.
 *
 * `verified-clear` significa, portanto: nenhum comando desenhado entra mais de
 * `clearance` unidades no interior de nenhum card próximo, e nenhuma região
 * ficou sem verificação.
 */
import type { ArchivePoint, ArchiveRect } from "./archiveCamera";
import {
  inflateArchiveRect,
  segmentCrossesArchiveRect,
  type ArchiveLinkCommand,
} from "./archiveLinkGeometry";

/** Folga visual declarada entre o traço e o interior de um card. */
export const ARCHIVE_PATH_CLEARANCE = 0.5;

export interface ArchivePathProbe {
  /** Interseção conclusiva com o interior além da folga declarada. */
  hit: boolean;
  /** Contato de borda/folga: encosta, mas não atravessa o interior. */
  touch: boolean;
  /** A varredura terminou dentro do orçamento. */
  conclusive: boolean;
  tests: number;
  /** Folga usada nesta varredura (diagnóstico e testes). */
  clearance: number;
}

export interface ArchivePathProbeOptions {
  /** Folga visual descontada do card antes do teste. */
  clearance?: number;
  /** Desvio máximo aceito antes de reportar toque. */
  tolerance?: number;
  /** Profundidade máxima de subdivisão (limite de segurança). */
  maxDepth?: number;
  /** Conta o contato de borda (custa uma segunda varredura por comando). */
  trackTouch?: boolean;
  /** Consome orçamento; `false` interrompe e torna o resultado inconclusivo. */
  spend?: () => boolean;
}

const EPS = 1e-9;

export function archivePathProbe(
  commands: readonly ArchiveLinkCommand[],
  rect: ArchiveRect,
  options: ArchivePathProbeOptions = {},
): ArchivePathProbe {
  const clearance = options.clearance ?? ARCHIVE_PATH_CLEARANCE;
  const tolerance = options.tolerance ?? 0.1;
  const maxDepth = options.maxDepth ?? 14;
  const trackTouch = options.trackTouch ?? true;
  const spend = options.spend ?? (() => true);
  const inner =
    clearance > 0 ? inflateArchiveRect(rect, -clearance) : { ...rect };
  let tests = 0;
  let hit = false;
  let touch = false;
  let conclusive = true;
  let current: ArchivePoint = { x: 0, y: 0 };

  /** Testa a corda inflada pelo raio de desvio: toque aqui é interseção. */
  const crosses = (start: ArchivePoint, end: ArchivePoint, radius: number) =>
    segmentCrossesArchiveRect(
      start,
      end,
      inflateArchiveRect(inner, radius),
      0,
    );

  const grazes = (start: ArchivePoint, end: ArchivePoint, radius: number) =>
    segmentCrossesArchiveRect(start, end, inflateArchiveRect(rect, radius), 0);

  const visit = (
    start: ArchivePoint,
    control: ArchivePoint,
    end: ArchivePoint,
    depth: number,
  ): boolean => {
    // Distância máxima da curva quadrática à corda: |P0 - 2C + P2| / 4.
    const deviation =
      Math.hypot(
        start.x - 2 * control.x + end.x,
        start.y - 2 * control.y + end.y,
      ) / 4;
    if (deviation <= tolerance) {
      if (!spend()) return false;
      tests++;
      if (crosses(start, end, deviation)) {
        hit = true;
        return true;
      }
      if (trackTouch && !touch) {
        if (!spend()) return false;
        tests++;
        if (grazes(start, end, deviation)) touch = true;
      }
      return true;
    }
    if (depth >= maxDepth) {
      conclusive = false;
      return true;
    }
    const first = {
      x: (start.x + control.x) / 2,
      y: (start.y + control.y) / 2,
    };
    const second = {
      x: (control.x + end.x) / 2,
      y: (control.y + end.y) / 2,
    };
    const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    return (
      visit(start, first, middle, depth + 1) &&
      visit(middle, second, end, depth + 1)
    );
  };

  for (const command of commands) {
    if (command.kind === "M") {
      current = { x: command.x, y: command.y };
      continue;
    }
    const target = { x: command.x, y: command.y };
    if (command.kind === "L") {
      if (!spend()) {
        conclusive = false;
        break;
      }
      tests++;
      // Sem descartar segmentos curtos: comprimento zero cai no teste de ponto.
      if (crosses(current, target, 0)) {
        hit = true;
      } else if (trackTouch && !touch) {
        if (!spend()) {
          conclusive = false;
          break;
        }
        tests++;
        if (grazes(current, target, 0)) touch = true;
      }
      current = target;
      continue;
    }
    if (!visit(current, { x: command.cx, y: command.cy }, target, 0)) {
      conclusive = false;
      break;
    }
    current = target;
  }
  return { hit, touch, conclusive, tests, clearance };
}

/** Caixa de um único comando, a partir do ponto corrente do path. */
export function archiveCommandBounds(
  current: ArchivePoint,
  command: ArchiveLinkCommand,
  margin = 1,
): ArchiveRect {
  const points: ArchivePoint[] =
    command.kind === "Q"
      ? [
          current,
          { x: command.cx, y: command.cy },
          { x: command.x, y: command.y },
        ]
      : [current, { x: command.x, y: command.y }];
  let minX = Number.POSITIVE_INFINITY,
    minY = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  // A curva fica no fecho convexo dos pontos de controle; a margem cobre o
  // arredondamento de duas casas do path e o raio do arco.
  return {
    x: minX - margin,
    y: minY - margin,
    width: Math.max(EPS, maxX - minX) + margin * 2,
    height: Math.max(EPS, maxY - minY) + margin * 2,
  };
}
