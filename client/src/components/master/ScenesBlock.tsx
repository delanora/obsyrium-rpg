import { useEffect, useMemo, useState } from 'react';
import {
  createFreeScene,
  deleteScene,
  fetchAllScenes,
  fetchScene,
  subscribeSceneEvents,
  updateScene,
  type SceneEvent,
} from '../../scenesApi';
import { mutateSceneWall } from '../../sceneWallsApi';
import { formatSceneMeters, SCENE_CELL_FEET } from '../../sceneUnits';
import type { Locality, Region, Scene, ScenePatch } from '../../types';
import { Icon } from '../Icon';
import { Section } from '../Section';
import { MasterDetailModal } from './MasterDetailModal';
import { SceneEditor } from './SceneEditor';
import './scenes.css';
import './regions.css';

interface ScenesBlockProps {
  regions: Region[];
  localities: Locality[];
  /** Busca da aba: filtra os cards por nome. */
  query?: string;
}

const byName = (a: Scene, b: Scene): number => a.name.localeCompare(b.name);

/** Evento de outra aba, com guarda de VERSÃO (evento velho não vence). */
function applySceneEvent(scenes: Scene[], event: SceneEvent): Scene[] {
  if (event.type === 'deleted') return scenes.filter((scene) => scene.id !== event.sceneId);

  const index = scenes.findIndex((scene) => scene.id === event.scene.id);
  if (index === -1) return [...scenes, event.scene].sort(byName);
  if (event.scene.version < scenes[index].version) return scenes;

  const next = [...scenes];
  next[index] = event.scene;
  return next.sort(byName);
}

/**
 * Bloco **Cenas** da Geografia.
 *
 * A cena deixou de morar dentro da localidade: o bloco lista TODAS as cenas da
 * mesa e a criação pergunta, sem obrigar, a região e a localidade de destino.
 * Grid, paredes e imagem continuam sendo da cena (o `SceneEditor` é o mesmo).
 */
export function ScenesBlock({ regions, localities, query = '' }: ScenesBlockProps) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('Nova cena');
  const [regionId, setRegionId] = useState('');
  const [localityId, setLocalityId] = useState('');

  const selected = scenes.find((scene) => scene.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAllScenes()
      .then((list) => {
        if (!active) return;
        setScenes([...list].sort(byName));
        setError(null);
      })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value.message : 'Não foi possível carregar as cenas.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => subscribeSceneEvents((event) => setScenes((prev) => applySceneEvent(prev, event))), []);

  // Cena apagada em outra aba não deixa editor órfão.
  useEffect(() => {
    if (selectedId && !loading && !scenes.some((scene) => scene.id === selectedId)) {
      setSelectedId(null);
    }
  }, [scenes, selectedId, loading]);

  const visible = useMemo(
    () => scenes.filter((scene) => !query || scene.name.toLowerCase().includes(query.toLowerCase())),
    [scenes, query],
  );

  const regionName = (id: string | null): string | null =>
    id ? (regions.find((region) => region.id === id)?.name ?? null) : null;
  const localityName = (id: string | null): string | null =>
    id ? (localities.find((locality) => locality.id === id)?.name ?? null) : null;

  async function handleCreate(): Promise<void> {
    setCreating(true);
    setError(null);
    try {
      const scene = await createFreeScene({
        name: name.trim() || 'Nova cena',
        regionId: regionId || null,
        localityId: localityId || null,
      });
      setScenes((prev) => applySceneEvent(prev, { type: 'created', scene }));
      setSelectedId(scene.id);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Não foi possível criar a cena.');
    } finally {
      setCreating(false);
    }
  }

  function upsert(scene: Scene): void {
    setScenes((prev) => applySceneEvent(prev, { type: 'updated', scene }));
  }

  return (
    <>
      <Section
        title="Cenas"
        icon="book"
        subtitle="Cada cena tem grid, paredes e imagem próprios"
        actions={
          <span className="geo-tag">{scenes.length} cena(s)</span>
        }
      >
        {loading ? (
          <p className="empty-hint">Carregando as cenas...</p>
        ) : error && scenes.length === 0 ? (
          <p className="form-error">{error}</p>
        ) : visible.length === 0 ? (
          <p className="empty-hint">
            {scenes.length === 0
              ? 'Nenhuma cena ainda. Crie a primeira abaixo — a cena pode ficar solta, numa região ou numa localidade.'
              : 'Nenhuma cena corresponde à busca.'}
          </p>
        ) : (
          <ul className="geo-cards">
            {visible.map((scene) => {
              const region = regionName(scene.regionId);
              const locality = localityName(scene.localityId);
              return (
                <li key={scene.id}>
                  <button
                    type="button"
                    className="geo-card"
                    aria-label={`Abrir a cena ${scene.name}`}
                    onClick={() => setSelectedId(scene.id)}
                  >
                    <span className="geo-thumb">
                      {scene.backgroundImageUrl ? (
                        <img src={scene.backgroundImageUrl} alt="" loading="lazy" />
                      ) : (
                        <Icon name="book" size={20} />
                      )}
                    </span>
                    <span className="geo-info">
                      <span className="geo-name">{scene.name}</span>
                      <span className="geo-meta">
                        {formatSceneMeters(scene.spatialConfig.widthFeet)} ×{' '}
                        {formatSceneMeters(scene.spatialConfig.heightFeet)}
                        {scene.spatialConfig.mode === 'grid-2d'
                          ? ` · grade de ${formatSceneMeters(SCENE_CELL_FEET)}`
                          : ' · assistida'}
                      </span>
                      <span className="geo-tags">
                        {locality ? <span className="geo-tag">{locality}</span> : null}
                        {region ? <span className="geo-tag">{region}</span> : null}
                        {!locality && !region ? <span className="geo-tag">sem vínculo</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && scenes.length > 0 ? <p className="form-error">{error}</p> : null}

        <div className="geo-create">
          <label>
            Nome da cena
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
          </label>
          <label>
            Região (opcional)
            <select value={regionId} onChange={(event) => setRegionId(event.target.value)}>
              <option value="">sem região</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Localidade (opcional)
            <select value={localityId} onChange={(event) => setLocalityId(event.target.value)}>
              <option value="">sem localidade</option>
              {localities.map((locality) => (
                <option key={locality.id} value={locality.id}>
                  {locality.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            {creating ? 'criando...' : '+ nova cena'}
          </button>
        </div>
      </Section>

      {selected ? (
        <MasterDetailModal
          kind="Cena"
          title={selected.name}
          subtitle={`versão ${selected.version}`}
          onClose={() => setSelectedId(null)}
        >
          <SceneEditor
            key={selected.id}
            scene={selected}
            onWallMutation={async (mutation, expectedVersion, operationId) => {
              const updated = await mutateSceneWall(selected.id, mutation, expectedVersion, operationId);
              upsert(updated);
              return updated;
            }}
            onUpdate={async (patch: ScenePatch, expectedVersion, operationId) => {
              const updated = await updateScene(selected.id, {
                ...patch,
                expectedVersion,
                operationId,
              });
              upsert(updated);
              return updated;
            }}
            onDelete={async (expectedVersion) => {
              await deleteScene(selected.id, expectedVersion);
              setScenes((prev) => prev.filter((scene) => scene.id !== selected.id));
              setSelectedId(null);
            }}
            onReload={async () => {
              const fresh = await fetchScene(selected.id);
              upsert(fresh);
              return fresh;
            }}
          />
        </MasterDetailModal>
      ) : null}
    </>
  );
}
