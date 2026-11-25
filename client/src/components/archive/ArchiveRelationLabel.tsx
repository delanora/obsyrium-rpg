import { useLayoutEffect, useRef, useState } from "react";
import type { NarrativeRelation } from "../../../../src/modules/shared/narrative";

// Relações repetidas compartilham a medição; o carregamento da fonte invalida a chave.
const labelWidths = new Map<string, number>();

/** Cápsula de couro com filete do tipo; a largura acompanha o texto real. */
export function ArchiveRelationLabel({
  label,
  relation,
  point,
  onSelect,
}: {
  label: string;
  relation: NarrativeRelation;
  point: { x: number; y: number };
  onSelect: () => void;
}) {
  const text = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(() =>
    Math.max(88, label.length * 7 + 30),
  );
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (!active || !text.current) return;
      const style = getComputedStyle(text.current);
      const key = `${document.fonts?.status}:${style.font}:${style.letterSpacing}:${label}`;
      let measured = labelWidths.get(key);
      if (measured === undefined) {
        measured = Math.max(
          88,
          Math.ceil(text.current.getComputedTextLength()) + 30,
        );
        if (labelWidths.size >= 512) labelWidths.clear();
        labelWidths.set(key, measured);
      }
      setWidth(measured);
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
    };
  }, [label]);
  const left = point.x - width / 2;
  const right = point.x + width / 2;
  // Losangos externos: eco dos cantos do Fichário, não um ícone de interface.
  const gem = (cx: number) =>
    `M${cx - 3.4} ${point.y} ${cx} ${point.y - 3.4} ${cx + 3.4} ${point.y} ${cx} ${point.y + 3.4}Z`;
  return (
    <g
      className="archive-relation-label"
      data-relation={relation}
      data-origin-x={point.x}
      data-origin-y={point.y}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <rect
        className="archive-relation-hit"
        x={left}
        y={point.y - 17}
        width={width}
        height={34}
        rx={17}
      />
      <rect
        className="archive-relation-plate"
        x={left}
        y={point.y - 13}
        width={width}
        height={26}
        rx={13}
      />
      <rect
        className="archive-relation-plate-inner"
        x={left + 3.5}
        y={point.y - 9.5}
        width={width - 7}
        height={19}
        rx={9.5}
      />
      <path className="archive-relation-gem" d={gem(left - 7)} />
      <path className="archive-relation-gem" d={gem(right + 7)} />
      <text
        ref={text}
        className="archive-relation-text"
        x={point.x}
        y={point.y}
        dominantBaseline="central"
      >
        {label}
      </text>
    </g>
  );
}
