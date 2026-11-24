import { memo, useId } from "react";
import type { ArchiveCamera } from "./archiveCamera";

/** Superfície periódica no espaço do quadro: mesma câmera dos cards/linhas.
 * O SVG ocupa só a viewport; o padrão cobre qualquer posição sem plano gigante. */
export const ArchiveBackground = memo(function ArchiveBackground({
  camera,
}: {
  camera: ArchiveCamera;
}) {
  const patternId = `archive-texture-${useId().replace(/:/g, "")}`;
  // Translação periódica equivalente, mantendo a matriz pequena em pans extensos.
  const phase = (value: number, period: number) =>
    ((value % period) + period) % period;
  const x = phase(camera.x, 1254 * camera.zoom);
  const y = phase(camera.y, 1254 * camera.zoom);
  return (
    <svg className="archive-background" aria-hidden="true" focusable="false">
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={1254}
          height={1254}
          patternTransform={`translate(${x} ${y}) scale(${camera.zoom})`}
        >
          <image
            href="/archive/textura-linho-azul-marinho.png"
            width={1254}
            height={1254}
            preserveAspectRatio="none"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      {/* Escurecimento de UI separado: não incorpora vinheta aos tiles. */}
      <rect width="100%" height="100%" fill="#050c12" fillOpacity={0.12} />
    </svg>
  );
});
