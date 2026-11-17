import { Icon } from '../Icon';

/** Os nomes e benefícios continuam no catálogo; apenas a arte é associada ao id. */
export const BACKGROUND_EMBLEMS: Readonly<Record<string, string>> = {
  acolyte: 'acolyte', 'guild-artisan': 'guild-artisan', entertainer: 'entertainer',
  criminal: 'criminal', hermit: 'hermit', 'folk-hero': 'folk-hero', noble: 'noble',
  urchin: 'urchin', sage: 'sage', sailor: 'sailor', soldier: 'soldier',
  outlander: 'outlander', charlatan: 'charlatan',
};

export function BackgroundEmblem({ backgroundKey }: { backgroundKey: string }) {
  const asset = BACKGROUND_EMBLEMS[backgroundKey];
  return asset ? <img className="class-emblem-art" src={`/background-icons/${asset}.webp`}
    alt="" aria-hidden="true" draggable={false} decoding="async" /> : <Icon name="scroll" size={64} />;
}
