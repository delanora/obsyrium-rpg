import { useMemo } from 'react';
import { poseInicialDeOracao, texturaDaFace } from './deathFaces';
import { dieFaces, paintsValues, settleTransform, type V3 } from './polyhedra';

/** Direção da luz (no espaço do modelo) usada para o facetado das faces. */
const LIGHT: V3 = [-0.45, -0.78, 0.44];

/** Inclinação parada do dado antes de rolar (só para dar volume à peça). */
const IDLE_TILT = 'rotateX(-18deg) rotateY(26deg) rotateZ(4deg)';

/** Base escura que fica por baixo da textura (cobre frestas nas arestas). */
const OBSIDIANA = '#0f0b0d';

interface Die3DProps {
  sides: number;
  /** Valor a apresentar quando `reveal` está ligado. */
  value: number | null;
  /** Dado assentado: mostra os números e pousa na face do resultado. */
  reveal: boolean;
  tumbling?: boolean;
  dropped?: boolean;
  locked?: boolean;
  onClick?: () => void;
  title?: string;
  /**
   * `death-save` troca a pintura das faces pelas artes do Teste contra a Morte
   * (obsidiana, símbolo esculpido e borda de latão). A geometria e o valor continuam os mesmos;
   * a bandeja de morte tem movimento próprio e alinhamento suave da face.
   */
  percentile?: 'tens' | 'units';
  appearance?: 'death-save' | 'azure';
}

/**
 * Um dado de verdade em CSS 3D: as faces do poliedro são colocadas com
 * `matrix3d` (e pintadas dos dois lados, para o dado não ficar oco). O dado gira
 * (`.ddie-spin`) e pousa na orientação que traz o resultado para a câmera
 * (`.ddie-orient`).
 */
export function Die3D({
  sides,
  value,
  reveal,
  tumbling = false,
  dropped = false,
  locked = false,
  onClick,
  title,
  appearance,
  percentile,
}: Die3DProps) {
  const resina = appearance === 'azure';
  const geometria = sides;
  const faces = useMemo(() => dieFaces(geometria), [geometria]);
  const paints = paintsValues(sides);
  const temaMorte = appearance === 'death-save';
  // A pose de espera é ilustrativa: não preenche nem antecipa o resultado.
  const valorVisual = resina ? (value ?? sides) : value;
  const faceVisual = valorVisual;
  const settle = resina
    ? `rotateX(-10deg) rotateY(12deg) ${settleTransform(geometria, faceVisual ?? geometria)}`
    : temaMorte && !reveal && !tumbling
    ? poseInicialDeOracao()
    : value !== null && (reveal || (temaMorte && tumbling))
      ? settleTransform(sides, value)
      : null;

  const className = [
    'ddie',
    `ddie-s${sides}`,
    temaMorte ? 'is-death-save' : '',
    resina ? 'is-resin' : '',
    tumbling ? 'is-tumbling' : '',
    reveal ? 'is-revealed' : '',
    dropped ? 'is-dropped' : '',
    locked ? 'is-locked' : '',
    onClick ? 'is-clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <span className="ddie-orient" style={{ transform: settle ?? IDLE_TILT }}>
        <span className="ddie-spin">
          <span className="ddie-model">
            {faces.map((face) => {
              const textura = temaMorte ? texturaDaFace(face) : null;
              const shade = Math.max(0, face.normal[0] * LIGHT[0] + face.normal[1] * LIGHT[1] + face.normal[2] * LIGHT[2]);
              // Dado descartado (vantagem/desvantagem) fica mais fosco e sem cor.
              const saturation = dropped ? 8 : 46;
              const base = (dropped ? 50 : 64) + Math.round(shade * (dropped ? 16 : 26));

              // A base da inscrição acompanha uma aresta da própria face,
              // sem correção para a câmera ou mudança ao girar o poliedro.
              const [a, b] = face.polygon;
              let anguloNumero = Math.atan2(b[1] - a[1], b[0] - a[0]);
              const paraCentro = [face.center[0] - (a[0] + b[0]) / 2, face.center[1] - (a[1] + b[1]) / 2];
              if (Math.sin(anguloNumero) * paraCentro[0] - Math.cos(anguloNumero) * paraCentro[1] < 0) anguloNumero += Math.PI;
              const inscricao = face.value === null ? '' : percentile === 'tens'
                ? String((face.value % 10) * 10).padStart(2, '0')
                : percentile === 'units' ? face.value % 10 : face.value;
              return (
                <span
                  key={face.key}
                  className="ddie-face"
                  style={{
                    width: face.size,
                    height: face.size,
                    clipPath: face.clipPath,
                    transform: face.transform,
                    background: textura
                      ? OBSIDIANA
                      : resina
                        ? `radial-gradient(ellipse at ${22 + face.key * 17 % 55}% ${18 + face.key * 23 % 56}%, rgb(104 245 237 / .5), transparent 49%), radial-gradient(ellipse at 76% 82%, rgb(12 194 210 / .42), transparent 55%), radial-gradient(ellipse at 25% 18%, rgb(222 253 255 / .48), transparent 29%), linear-gradient(145deg, hsl(200 92% ${29 + shade * 22}%), hsl(216 90% ${15 + shade * 16}%))`
                        : `linear-gradient(150deg, hsl(38 ${saturation}% ${Math.min(92, base + 8)}%), hsl(33 ${saturation - 4}% ${Math.max(30, base - 12)}%))`,
                  }}
                >
                  {textura ? (
                    // A arte é a própria superfície da face: entra no plano dela,
                    // recortada pelo `clip-path`, e gira junto com o dado.
                    <img
                      className="ddie-texture"
                      src={textura.src}
                      alt=""
                      draggable={false}
                      style={{
                        width: textura.largura,
                        height: textura.altura,
                        transform: textura.transform,
                      }}
                    />
                  ) : null}
                  {!textura && (reveal || resina) && face.value !== null ? (
                    // O número fica no centroide da face (não no centro da
                    // caixa) e cresce junto com a face. É um `font-size` no
                    // espaço do modelo, então o `.ddie-model` o escala na
                    // proporção certa — nada de número minúsculo.
                    <span
                      className="ddie-num"
                      style={{
                        left: `${face.valueX}%`,
                        top: `${face.valueY}%`,
                        fontSize: `${face.valueSize * (percentile === 'tens' ? 0.8 : 1)}px`,
                        ...(resina ? { transform: `translate(-50%, -50%) rotate(${anguloNumero}rad)` } : {}),
                      }}
                    >
                      {inscricao}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </span>
        </span>
      </span>

      {!temaMorte && !resina && (!reveal || !paints) ? (
        <span className="ddie-badge">
          {reveal && value !== null && !paints ? value : `d${sides}`}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        data-percentile={percentile}
        title={title ?? 'Clique para remover'}
        aria-label={locked ? `d${sides} fixo` : `Remover d${sides} do pool`}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }

  return (
    <span className={className} data-percentile={percentile} title={title ?? `d${sides}`} aria-hidden={!reveal}>
      {body}
    </span>
  );
}
