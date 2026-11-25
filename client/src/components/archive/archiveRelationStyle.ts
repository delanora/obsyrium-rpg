import type { CSSProperties } from "react";
import {
  NARRATIVE_RELATIONS,
  type NarrativeRelation,
} from "../../../../src/modules/shared/narrative";

/** Formas de extremidade; a seta continua condicionada a `link.directed`. */
export type ArchiveRelationMarker = "arrow" | "barb" | "chevron" | "diamond";

export interface ArchiveRelationVisual {
  /** Latão/bronze/cobre/pigmento discreto: cor do traço, do encaixe e do filete. */
  tone: string;
  /** Camada larga e translúcida sob o traço; profundidade sem brilho. */
  shade: string;
  width: number;
  /** Tracejado/tracejado-pontilhado; `null` = sólido. */
  dash: string | null;
  /** Segunda camada sob o traço, para relações de estrutura/guarda. */
  sheath: boolean;
  marker: ArchiveRelationMarker;
}

/**
 * Uma tabela só para a roupa de cada tipo. A semântica vem de
 * `NARRATIVE_RELATIONS`; nenhum componente escolhe cor ou traço por conta
 * própria, e nenhum dado persistido depende daqui.
 */
export const ARCHIVE_RELATION_VISUALS: Record<
  NarrativeRelation,
  ArchiveRelationVisual
> = {
  // Contenção: latão envelhecido, traço estável e hierárquico.
  contains: {
    tone: "#c2a06a",
    shade: "#c2a06a26",
    width: 2.2,
    dash: null,
    sheath: true,
    marker: "diamond",
  },
  // Pertencimento: bronze escurecido, mais discreto que a contenção.
  belongs: {
    tone: "#9a7f56",
    shade: "#9a7f561f",
    width: 1.6,
    dash: "8 4",
    sheath: false,
    marker: "chevron",
  },
  // Neutra: ferro polido, presente sem chamar atenção.
  related: {
    tone: "#a29b8b",
    shade: "#a29b8b1c",
    width: 1.6,
    dash: "3 5",
    sheath: false,
    marker: "chevron",
  },
  // Conhecimento: prata fria com viés mineral, pontilhado de informação.
  knows: {
    tone: "#93aab0",
    shade: "#93aab021",
    width: 1.6,
    dash: "4 5",
    sheath: false,
    marker: "chevron",
  },
  // Posse: cobre selado, com o filete duplo de um lacre.
  owns: {
    tone: "#b8824f",
    shade: "#b8824f2b",
    width: 1.9,
    dash: null,
    sheath: true,
    marker: "diamond",
  },
  // Guarda: prata/ferro frio, traço firme de sentinela.
  protects: {
    tone: "#aab6b2",
    shade: "#aab6b221",
    width: 2,
    dash: "11 4 2 4",
    sheath: true,
    marker: "barb",
  },
  // Parceria: musgo quente, sem verde de interface.
  ally: {
    tone: "#a8a26d",
    shade: "#a8a26d21",
    width: 1.8,
    dash: "9 4",
    sheath: false,
    marker: "chevron",
  },
  // Antagonismo: vinho apagado com cobre queimado.
  enemy: {
    tone: "#a05c55",
    shade: "#a05c552e",
    width: 1.9,
    dash: "6 3",
    sheath: false,
    marker: "barb",
  },
  // Condução: latão claro, o traço mais presente do conjunto.
  leads: {
    tone: "#cba96b",
    shade: "#cba96b2e",
    width: 2.3,
    dash: null,
    sheath: true,
    marker: "arrow",
  },
  // Causa/efeito: cobre incisivo com quebra de ritmo.
  triggers: {
    tone: "#c08a4a",
    shade: "#c08a4a2b",
    width: 2,
    dash: "10 3 2 3",
    sheath: false,
    marker: "arrow",
  },
  // Território: verde musgo seco, passada larga.
  inhabits: {
    tone: "#82997f",
    shade: "#82997f21",
    width: 1.8,
    dash: "10 5",
    sheath: false,
    marker: "chevron",
  },
  // Personalizada: marfim queimado neutro; o rótulo carrega o sentido.
  custom: {
    tone: "#bfb195",
    shade: "#bfb1951e",
    width: 1.6,
    dash: "5 3",
    sheath: false,
    marker: "chevron",
  },
};

function relationKey(relation: string | undefined): NarrativeRelation {
  return relation &&
    NARRATIVE_RELATIONS.includes(relation as NarrativeRelation)
    ? (relation as NarrativeRelation)
    : "custom";
}

export function archiveRelationVisual(
  relation: string | undefined,
): ArchiveRelationVisual {
  return ARCHIVE_RELATION_VISUALS[relationKey(relation)];
}

/** Variáveis consumidas pelo SVG e pelo CSS; a geometria não as interpreta. */
export function archiveRelationStyle(relation: string | undefined): CSSProperties {
  const visual = archiveRelationVisual(relation);
  return {
    "--relation-tone": visual.tone,
    "--relation-shade": visual.shade,
    "--relation-width": `${visual.width}px`,
    "--relation-dash": visual.dash ?? "none",
  } as CSSProperties;
}

export function archiveRelationMarkerId(relation: string | undefined) {
  return `archive-relation-${relationKey(relation)}`;
}

export const ARCHIVE_RELATION_MARKERS: Record<
  ArchiveRelationMarker,
  {
    d: string;
    viewBox: string;
    refX: number;
    refY: number;
    width: number;
    height: number;
    filled: boolean;
  }
> = {
  arrow: {
    d: "M0 0 10 5 0 10 2.6 5Z",
    viewBox: "0 0 10 10",
    refX: 10,
    refY: 5,
    width: 9,
    height: 9,
    filled: true,
  },
  barb: {
    d: "M0 1.2 10 5 0 8.8 3.4 5Z",
    viewBox: "0 0 10 10",
    refX: 10,
    refY: 5,
    width: 8.5,
    height: 8.5,
    filled: true,
  },
  diamond: {
    d: "M0 5 5 0 10 5 5 10Z",
    viewBox: "0 0 10 10",
    refX: 8.8,
    refY: 5,
    width: 8,
    height: 8,
    filled: true,
  },
  chevron: {
    d: "M1.6 1.6 8.6 5 1.6 8.4",
    viewBox: "0 0 10 10",
    refX: 8.6,
    refY: 5,
    width: 8,
    height: 8,
    filled: false,
  },
};
