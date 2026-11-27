import { useMemo, useState } from 'react';
import type {
  Creature,
  CreaturePatch,
  Locality,
  LocalityPatch,
  Region,
  RegionPatch,
} from '../../types';
import { Icon } from '../Icon';
import { Section } from '../Section';
import { LocalityEditor } from './LocalityEditor';
import { MasterDetailModal } from './MasterDetailModal';
import { RegionEditor } from './RegionEditor';
import { ScenesBlock } from './ScenesBlock';
import { SearchField } from './SearchField';
import { matchesSearch } from './search';
import './regions.css';

interface RegionsTabProps {
  regions: Region[];
  /** Todas as localidades da mesa; o bloco mostra as que têm (ou não) região. */
  localities: Locality[];
  /** Bestiário inteiro: a região anexa criaturas que já existem. */
  creatures: Creature[];
  onCreate: () => Promise<Region>;
  onPatch: (id: string, patch: RegionPatch) => void;
  onDelete: (id: string) => void;
  /** Cria uma localidade solta; o vínculo com a região é editado no card. */
  onCreateLocality: () => Promise<Locality>;
  onPatchLocality: (id: string, patch: LocalityPatch) => void;
  onDeleteLocality: (id: string) => void;
  /** Anexa/desanexa uma criatura do bestiário a uma região. */
  onPatchCreature: (id: string, patch: CreaturePatch) => void;
  /** Abre a ficha da criatura no bestiário (troca de aba do painel). */
  onOpenCreature: (creature: Creature) => void;
}

/**
 * Aba **Geografia** — três blocos empilhados, cada um com os próprios cards:
 *
 * 1. **Regiões** — identidade, imagens e as criaturas anexadas.
 * 2. **Localidades** — lugares, com vínculo OPCIONAL com uma região.
 * 3. **Cenas** — grid/paredes, com vínculo OPCIONAL com região/localidade.
 *
 * O assistente numerado antigo (Região → Localidade → Cenas → Habitantes) foi
 * removido: nada é obrigatório para existir, então não há ordem a seguir. Quem
 * cria é o bloco, e o card abre o editor daquela entidade.
 */
export function RegionsTab({
  regions,
  localities,
  creatures,
  onCreate,
  onPatch,
  onDelete,
  onCreateLocality,
  onPatchLocality,
  onDeleteLocality,
  onPatchCreature,
  onOpenCreature,
}: RegionsTabProps) {
  const [regionId, setRegionId] = useState<string | null>(null);
  const [localityId, setLocalityId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creatingRegion, setCreatingRegion] = useState(false);
  const [creatingLocality, setCreatingLocality] = useState(false);

  const region = regions.find((item) => item.id === regionId) ?? null;
  const locality = localities.find((item) => item.id === localityId) ?? null;

  const visibleRegions = useMemo(
    () => regions.filter((item) => matchesSearch(query, item.name, item.description)),
    [regions, query],
  );
  const visibleLocalities = useMemo(
    () => localities.filter((item) => matchesSearch(query, item.name, item.description)),
    [localities, query],
  );

  const regionName = (id: string | null): string | null =>
    id ? (regions.find((item) => item.id === id)?.name ?? null) : null;

  async function handleCreateRegion(): Promise<void> {
    setCreatingRegion(true);
    try {
      const created = await onCreate();
      setRegionId(created.id);
    } finally {
      setCreatingRegion(false);
    }
  }

  async function handleCreateLocality(): Promise<void> {
    setCreatingLocality(true);
    try {
      const created = await onCreateLocality();
      setLocalityId(created.id);
    } finally {
      setCreatingLocality(false);
    }
  }

  return (
    <div className="master-catalog">
      <header className="items-head">
        <div className="items-toolbar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Buscar região ou localidade"
            label="Buscar na geografia"
          />
        </div>
      </header>

      <Section
        title="Regiões"
        icon="earth"
        subtitle="Onde a campanha acontece — imagens, história e criaturas da região"
        actions={
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => void handleCreateRegion()}
            disabled={creatingRegion}
          >
            {creatingRegion ? 'criando...' : '+ nova região'}
          </button>
        }
      >
        {visibleRegions.length === 0 ? (
          <p className="empty-hint">
            {regions.length === 0
              ? 'Nenhuma região ainda. Crie a primeira para agrupar localidades, cenas e criaturas.'
              : 'Nenhuma região corresponde à busca.'}
          </p>
        ) : (
          <ul className="geo-cards">
            {visibleRegions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="geo-card"
                  aria-label={`Abrir a região ${item.name}`}
                  onClick={() => setRegionId(item.id)}
                >
                  <span className="geo-thumb">
                    {item.images[0] ? (
                      <img src={item.images[0].url} alt="" loading="lazy" />
                    ) : (
                      <Icon name="earth" size={20} />
                    )}
                  </span>
                  <span className="geo-info">
                    <span className="geo-name">{item.name}</span>
                    <span className="geo-meta">
                      {item.localityCount} localidade(s) · {item.creatureCount} criatura(s)
                    </span>
                    {item.description ? (
                      <span className="geo-meta">{item.description}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Localidades"
        icon="home"
        subtitle="Cidades, masmorras, tavernas — com região ou soltas"
        actions={
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => void handleCreateLocality()}
            disabled={creatingLocality}
          >
            {creatingLocality ? 'criando...' : '+ nova localidade'}
          </button>
        }
      >
        {visibleLocalities.length === 0 ? (
          <p className="empty-hint">
            {localities.length === 0
              ? 'Nenhuma localidade ainda. Crie a primeira — ela pode ficar sem região.'
              : 'Nenhuma localidade corresponde à busca.'}
          </p>
        ) : (
          <ul className="geo-cards">
            {visibleLocalities.map((item) => {
              const owner = regionName(item.regionId);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="geo-card"
                    aria-label={`Abrir a localidade ${item.name}`}
                    onClick={() => setLocalityId(item.id)}
                  >
                    <span className="geo-thumb">
                      {item.images[0] ? (
                        <img src={item.images[0].url} alt="" loading="lazy" />
                      ) : (
                        <Icon name="home" size={20} />
                      )}
                    </span>
                    <span className="geo-info">
                      <span className="geo-name">{item.name}</span>
                      <span className="geo-meta">
                        {item.creatureCount} habitante(s)
                      </span>
                      <span className="geo-tags">
                        <span className="geo-tag">{owner ?? 'sem região'}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <ScenesBlock regions={regions} localities={localities} query={query} />

      {region ? (
        <MasterDetailModal
          kind="Região"
          title={region.name}
          subtitle={
            <>
              {region.localityCount} localidade{region.localityCount === 1 ? '' : 's'} ·{' '}
              {region.creatureCount} criatura{region.creatureCount === 1 ? '' : 's'}
            </>
          }
          onClose={() => setRegionId(null)}
          actions={
            <button
              type="button"
              className="btn btn-danger btn-small"
              onClick={() => {
                onDelete(region.id);
                setRegionId(null);
              }}
            >
              <Icon name="trash" size={14} /> remover região
            </button>
          }
        >
          <RegionEditor
            embedded
            region={region}
            creatures={creatures}
            onPatch={(patch) => onPatch(region.id, patch)}
            onDelete={() => {
              onDelete(region.id);
              setRegionId(null);
            }}
            onPatchCreature={onPatchCreature}
            onOpenCreature={onOpenCreature}
          />
        </MasterDetailModal>
      ) : null}

      {locality ? (
        <MasterDetailModal
          kind="Localidade"
          title={locality.name}
          subtitle={regionName(locality.regionId) ?? 'sem região'}
          onClose={() => setLocalityId(null)}
          actions={
            <button
              type="button"
              className="btn btn-danger btn-small"
              onClick={() => {
                onDeleteLocality(locality.id);
                setLocalityId(null);
              }}
            >
              <Icon name="trash" size={14} /> remover localidade
            </button>
          }
        >
          <LocalityEditor
            locality={locality}
            regions={regions}
            onPatch={(patch) => onPatchLocality(locality.id, patch)}
            onDelete={() => {
              onDeleteLocality(locality.id);
              setLocalityId(null);
            }}
          />
        </MasterDetailModal>
      ) : null}
    </div>
  );
}
