import type { CSSProperties } from "react";
import type { NarrativeCategory } from "../../../../src/modules/shared/narrative";

/** Arte derivada da categoria; não integra o estado persistido do card. */
export const ARCHIVE_CATEGORY_ASSETS: Record<NarrativeCategory, string> = {
  region: "regiao.png",
  locality: "localidade.png",
  dungeon: "masmorra.png",
  room: "sala.png",
  npc: "npc.png",
  creature: "criatura.png",
  item: "item.png",
  faction: "faccao.png",
  event: "acontecimento.png",
  scene: "cena.png",
  encounter: "encontro.png",
  trap: "armadilha.png",
  clue: "pista.png",
  sound: "efeito-sonoro.png",
  image: "imagem.png",
  note: "anotacao.png",
};

const CATEGORY_TONES: Record<NarrativeCategory, string> = {
  region: "#31586b",
  locality: "#776045",
  dungeon: "#514160",
  room: "#4d5863",
  npc: "#65516e",
  creature: "#763f39",
  item: "#315c60",
  faction: "#35536a",
  event: "#796037",
  scene: "#71474e",
  encounter: "#773d36",
  trap: "#725044",
  clue: "#3d6454",
  sound: "#39656a",
  image: "#475b78",
  note: "#776147",
};

/** Fallback visual defensivo; as categorias válidas continuam definidas no catálogo. */
export function archiveCategoryAppearance(category: string) {
  const known = Object.hasOwn(ARCHIVE_CATEGORY_ASSETS, category);
  const key = known ? (category as NarrativeCategory) : "note";
  return {
    icon: `/archive/icons/${ARCHIVE_CATEGORY_ASSETS[key]}`,
    folder: known
      ? ARCHIVE_CATEGORY_ASSETS[key].replace(/\.png$/, "")
      : "comuns",
    tone: known ? CATEGORY_TONES[key] : "#776045",
  };
}

export function archiveCategoryStyle(category: string): CSSProperties {
  const { folder, tone } = archiveCategoryAppearance(category);
  const base = `/archive/card-parts/${folder}`;
  return {
    "--category-tone": tone,
    "--archive-header-left": `url("${base}/cabecalho-esquerda.png")`,
    "--archive-header-fill-left": `url("${base}/cabecalho-miolo-esquerda.png")`,
    "--archive-header-center": `url("${base}/cabecalho-centro.png")`,
    "--archive-header-fill-right": `url("${base}/cabecalho-miolo-direita.png")`,
    "--archive-header-right": `url("${base}/cabecalho-direita.png")`,
    "--archive-support": `url("${base}/suporte-icone.png")`,
  } as CSSProperties;
}

export function ArchiveCategoryIcon({
  category,
}: {
  category: NarrativeCategory;
}) {
  return (
    <img
      className="archive-category-icon"
      src={archiveCategoryAppearance(category).icon}
      alt=""
      aria-hidden="true"
      width={44}
      height={44}
      draggable={false}
      decoding="async"
    />
  );
}
