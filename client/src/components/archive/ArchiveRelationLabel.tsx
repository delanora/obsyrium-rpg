import { useLayoutEffect, useRef, useState } from "react";

// Relações repetidas compartilham a medição; o carregamento da fonte invalida a chave.
const labelWidths = new Map<string, number>();

/** Três segmentos preservam as pontas; a largura acompanha o texto real. */
export function ArchiveRelationLabel({
  label,
  point,
  onSelect,
}: {
  label: string;
  point: { x: number; y: number };
  onSelect: () => void;
}) {
  const text = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(() =>
    Math.max(84, label.length * 7.5 + 32),
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
          84,
          Math.ceil(text.current.getComputedTextLength()) + 32,
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
  return (
    <g
      className="archive-relation-label"
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
      <foreignObject
        className="archive-relation-decoration"
        x={left}
        y={point.y - 17}
        width={width}
        height={34}
        aria-hidden="true"
      >
        <div className="archive-relation-art" />
      </foreignObject>
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
