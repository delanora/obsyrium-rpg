/** Verificação geométrica do caminho REALMENTE desenhado.
 *
 * O traço renderizado é `archiveLinkPathCommands(pontos)`: linhas e arcos
 * quadráticos já arredondados. Validar a polilinha original (ou reconstruir o
 * arco por amostragem) provava outra curva. Aqui cada comando é testado como
 * será pintado:
 *
 * - `L`: teste exato de segmento contra retângulo (Liang–Barsky);
 * - `Q`: subdivisão de De Casteljau. Enquanto a corda do sub-arco, inflada pelo
 *   desvio máximo da curva em relação à corda (`|P0 − 2C + P2| / 4`), não toca o
 *   retângulo, a ausência de interseção é **demonstrada**, não amostrada. Ao
 *   chegar à tolerância, o toque é reportado como interseção (falso positivo
 *   máximo da ordem da tolerância, nunca falso negativo); se a subdivisão
 *   esgotar o orçamento, o resultado é inconclusivo e a rota fica `unverified`.
 */
import type { ArchivePoint, ArchiveRect } from "./archiveCamera";
import {
  archiveLinkDistance,
  inflateArchiveRect,
  segmentCrossesArchiveRect,
  type ArchiveLinkCommand,
} from "./archiveLinkGeometry";

export interface ArchivePathProbe {
  /** Interseção conclusiva com o interior do retângulo. */
  hit: boolean;
  /** A varredura terminou dentro do orçamento. */
  conclusive: boolean;
  tests: number;
}

export interface ArchivePathProbeOptions {
  /** Desvio máximo aceito antes de reportar toque. */
  tolerance?: number;
  /** Profundidade máxima de subdivisão (limite de segurança). */
  maxDepth?: number;
  /** Consome orçamento; `false` interrompe e torna o resultado inconclusivo. */
  spend?: () => boolean;
}

const EPS = 1e-9;

export function archivePathProbe(
  commands: readonly ArchiveLinkCommand[],
  rect: ArchiveRect,
  options: ArchivePathProbeOptions = {},
): ArchivePathProbe {
  const tolerance = options.tolerance ?? 0.1;
  const maxDepth = options.maxDepth ?? 14;
  const spend = options.spend ?? (() => true);
  let tests = 0;
  let hit = false;
  let conclusive = true;
  let current: ArchivePoint = { x: 0, y: 0 };

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
      if (
        archiveLinkDistance(start, end) < 0.5 ||
        !segmentCrossesArchiveRect(
          start,
          end,
          inflateArchiveRect(rect, deviation),
          0,
        )
      )
        return true;
      hit = true;
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
      if (
        archiveLinkDistance(current, target) >= 0.5 &&
        segmentCrossesArchiveRect(current, target, rect, 1)
      )
        hit = true;
      current = target;
      continue;
    }
    if (!visit(current, { x: command.cx, y: command.cy }, target, 0)) {
      conclusive = false;
      break;
    }
    current = target;
  }
  return { hit, conclusive, tests };
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
