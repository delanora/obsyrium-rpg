import { api } from "./api";
import type { ArchiveOperation } from "../../src/modules/archive/archive.schema";
import type {
  NarrativeBoardDto,
  NarrativeGraphDto,
  NarrativeCardDto,
} from "../../src/modules/shared/narrative";
export type { ArchiveOperation };
export const ARCHIVE_CHANGED = "obsyrium:archive-changed";
export const notifyArchiveChanged = () =>
  window.dispatchEvent(new Event(ARCHIVE_CHANGED));
export const listBoards = () =>
  api<{ boards: NarrativeBoardDto[] }>("/api/archive/boards");
export const loadGraph = (id: string) =>
  api<NarrativeGraphDto>(`/api/archive/boards/${encodeURIComponent(id)}`);
export const listCards = () =>
  api<{
    cards: Pick<NarrativeCardDto, "id" | "title" | "category" | "version">[];
  }>("/api/archive/cards");
export const archiveOperation = (input: ArchiveOperation) =>
  api<{ id: string; version?: number; replayed?: boolean }>(
    "/api/archive/operations",
    { method: "POST", body: input },
  );
