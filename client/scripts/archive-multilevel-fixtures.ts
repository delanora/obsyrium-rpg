/** Mesmas fixtures puras para CPU e Chromium; nunca importa dados da campanha. */
import type { NarrativeGraphDto } from "../../src/modules/shared/narrative";
export function archiveBenchmarkFixture(
  count: number,
  kind: string,
): NarrativeGraphDto {
  const placements = Array.from({ length: count }, (_, i) => {
    const second = i >= Math.floor(count / 2),
      k = second ? i - Math.floor(count / 2) : i;
    const multi = kind === "multinivel",
      separate = kind === "independente" || kind === "interdependente";
    return {
      id: "p" + i,
      cardId: "p" + i,
      boardId: "b",
      parentPlacementId:
        multi && i > 0 && i < 20
          ? "p" + Math.floor((i - 1) / 3)
          : separate && k > 0 && k < 6
            ? "p" + (second ? Math.floor(count / 2) : 0)
            : !separate && i > 0 && i < 6
              ? "p0"
              : null,
      x: separate
        ? (second ? (kind === "independente" ? 20000 : 2400) : 0) +
          (k % 10) * 400
        : kind === "denso"
          ? (i % 20) * 45
          : (i % 20) * 400,
      y:
        kind === "denso"
          ? Math.floor(i / 20) * 45
          : Math.floor((separate ? k : i) / 20) * 300,
      width: 280,
      height: 200,
      zIndex: 0,
      card: {
        id: "p" + i,
        title: "Fixture " + i,
        category: "note" as const,
        summary: "",
        content: "",
        version: 0,
        createdAt: "",
        updatedAt: "",
      },
    };
  });
  const graph: NarrativeGraphDto = {
    board: {
      id: "b",
      name: "Fixture",
      description: "",
      version: 0,
      createdAt: "",
      updatedAt: "",
    },
    placements,
    links: placements
      .slice(1)
      .map((p, i) => ({
        id: "l" + i,
        sourceId: p.parentPlacementId ?? "p0",
        targetId: p.id,
        relation: "related" as const,
        directed: true,
        label: "Relacionado",
        description: "",
        version: 0,
      })),
  };
  return graph;
}
