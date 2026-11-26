/** Identidade das relações: tabela pura, sem DOM/HTTP. Geometria não muda aqui. */
import assert from "node:assert/strict";
import {
  NARRATIVE_RELATIONS,
  NARRATIVE_RELATION_LABELS,
} from "../../src/modules/shared/narrative";
import {
  ARCHIVE_RELATION_MARKERS,
  ARCHIVE_RELATION_VISUALS,
  archiveRelationMarkerId,
  archiveRelationStyle,
  archiveRelationVisual,
} from "../src/components/archive/archiveRelationStyle";
import { archiveLinkRouteGeometry } from "../src/components/archive/archiveLinkRouting";

let checks = 0;
const check = (label: string, run: () => void) => {
  run();
  checks++;
  console.log(`ok ${checks} — ${label}`);
};

check("todo tipo real de relação tem roupa própria", () => {
  for (const relation of NARRATIVE_RELATIONS) {
    const visual = ARCHIVE_RELATION_VISUALS[relation];
    assert.ok(visual, `sem visual: ${relation}`);
    assert.match(visual.tone, /^#[0-9a-f]{6}$/i);
    assert.match(visual.shade, /^#[0-9a-f]{6}[0-9a-f]{2}$/i);
    assert.ok(visual.width >= 1.3 && visual.width <= 2.4);
    if (visual.dash) assert.match(visual.dash, /^\d+(\.\d+)?( \d+(\.\d+)?)+$/);
  }
});

check("as doze relações se distinguem pela cor", () => {
  const tones = new Set(
    NARRATIVE_RELATIONS.map((relation) => ARCHIVE_RELATION_VISUALS[relation].tone),
  );
  assert.equal(tones.size, NARRATIVE_RELATIONS.length);
});

check("cada tipo aponta para um marcador existente e único", () => {
  const ids = new Set<string>();
  for (const relation of NARRATIVE_RELATIONS) {
    const visual = ARCHIVE_RELATION_VISUALS[relation];
    assert.ok(ARCHIVE_RELATION_MARKERS[visual.marker]);
    const id = archiveRelationMarkerId(relation);
    assert.equal(id, `archive-relation-${relation}`);
    assert.ok(!ids.has(id), `id repetido: ${id}`);
    ids.add(id);
  }
});

check("rótulos continuam sendo o texto da fonte da verdade", () => {
  for (const relation of NARRATIVE_RELATIONS)
    assert.equal(typeof NARRATIVE_RELATION_LABELS[relation], "string");
});

check("custom é o fallback neutro de relação desconhecida", () => {
  assert.equal(archiveRelationVisual("inventada"), ARCHIVE_RELATION_VISUALS.custom);
  assert.equal(archiveRelationMarkerId("inventada"), "archive-relation-custom");
  const style = archiveRelationStyle("inventada") as Record<string, string>;
  assert.equal(style["--relation-tone"], ARCHIVE_RELATION_VISUALS.custom.tone);
  assert.equal(
    style["--relation-dash"],
    ARCHIVE_RELATION_VISUALS.custom.dash ?? "none",
  );
});

check("as variáveis CSS espelham a tabela do tipo", () => {
  const style = archiveRelationStyle("enemy") as Record<string, string>;
  assert.equal(style["--relation-tone"], "#a05c55");
  assert.equal(style["--relation-width"], "1.9px");
  assert.equal(style["--relation-dash"], "6 3");
  const solid = archiveRelationStyle("contains") as Record<string, string>;
  assert.equal(solid["--relation-dash"], "none");
});

check("a geometria expõe as pontas usadas pelos encaixes", () => {
  const a = { x: 0, y: 0, width: 200, height: 120 };
  const b = { x: 400, y: 300, width: 200, height: 120 };
  const geometry = archiveLinkRouteGeometry(undefined, a, b);
  // A porta fica sempre na borda real do card, nunca no miolo.
  const onBorder = (p: { x: number; y: number }, r: typeof a) =>
    (Math.abs(p.x - r.x) < 1e-6 ||
      Math.abs(p.x - (r.x + r.width)) < 1e-6 ||
      Math.abs(p.y - r.y) < 1e-6 ||
      Math.abs(p.y - (r.y + r.height)) < 1e-6) &&
    p.x >= r.x - 1e-6 &&
    p.x <= r.x + r.width + 1e-6 &&
    p.y >= r.y - 1e-6 &&
    p.y <= r.y + r.height + 1e-6;
  assert.ok(onBorder(geometry.from, a));
  assert.ok(onBorder(geometry.to, b));
  // O traço angular começa e termina nas mesmas pontas dos encaixes.
  const rounded = (value: number) => Math.round(value * 100) / 100;
  assert.ok(
    geometry.path.startsWith(
      `M${rounded(geometry.from.x)},${rounded(geometry.from.y)}`,
    ),
  );
  assert.ok(
    geometry.path.endsWith(
      `L${rounded(geometry.to.x)},${rounded(geometry.to.y)}`,
    ),
  );
  // Sem curvas amplas: só linhas, arcos pequenos de canto e nenhum fechamento.
  assert.ok(/^[MLQ0-9.,\- ]+$/.test(geometry.path));
  assert.ok(!/[CTSZ]/.test(geometry.path));
});

console.log(`\n${checks} verificações de identidade visual das relações.`);
