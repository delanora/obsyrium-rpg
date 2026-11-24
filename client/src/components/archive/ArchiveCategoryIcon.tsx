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

export function ArchiveCategoryIcon({ category }: { category: NarrativeCategory }) {
  return (
    <img
      className="archive-category-icon"
      src={`/archive/icons/${ARCHIVE_CATEGORY_ASSETS[category]}`}
      alt=""
      aria-hidden="true"
      width={44}
      height={44}
      draggable={false}
      decoding="async"
    />
  );
}
