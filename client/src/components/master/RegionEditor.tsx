import { useMemo, useState } from 'react';
import { fileToImagePayload, uploadImage } from '../../api';
import type { Creature, CreaturePatch, Region, RegionPatch } from '../../types';
import { Icon } from '../Icon';
import { InlineField } from '../InlineField';
import { Section } from '../Section';
import { ImageGallery } from './ImageGallery';
import './regions.css';

interface RegionEditorProps {
  region: Region;
  /** Bestiário inteiro: a região ANEXA criaturas que já existem, nunca cria. */
  creatures: Creature[];
  onPatch: (patch: RegionPatch) => void;
  onDelete: () => void;
  /** Vincula/desvincula uma criatura do bestiário a esta região. */
  onPatchCreature: (id: string, patch: CreaturePatch) => void;
  onOpenCreature: (creature: Creature) => void;
  embedded?: boolean;
}

/**
 * Editor da REGIÃO, aberto pelo card do bloco "Regiões".
 *
 * A região é identidade (nome, descrição, anotações, imagens) e um agregado:
 * ela ANEXA criaturas que já existem no bestiário. Criar criatura aqui dentro
 * não existe mais — quem cria é o Bestiário, e o vínculo pode nascer lá (campo
 * "Região") ou aqui (este seletor).
 */
export function RegionEditor({
  region,
  creatures,
  onPatch,
  onDelete,
  onPatchCreature,
  onOpenCreature,
  embedded = false,
}: RegionEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState('');

  const linked = useMemo(
    () =>
      creatures
        .filter((creature) => creature.regionId === region.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [creatures, region.id],
  );

  const available = useMemo(
    () =>
      creatures
        .filter((creature) => creature.regionId !== region.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [creatures, region.id],
  );

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const images = [...region.images];
      for (const file of Array.from(files)) {
        const payload = await fileToImagePayload(file);
        images.push(await uploadImage(payload.dataUrl, payload.name, 'localities'));
      }
      onPatch({ images });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar a imagem.');
    } finally {
      setUploading(false);
    }
  }

  function attach(): void {
    if (!pick) return;
    onPatchCreature(pick, { regionId: region.id });
    setPick('');
  }

  return (
    <div className="creature-editor">
      {embedded ? null : (
        <div className="detail-head">
          <h2>
            <Icon name="scroll" size={22} /> {region.name}
          </h2>
          <button type="button" className="btn btn-danger btn-small" onClick={onDelete}>
            remover região
          </button>
        </div>
      )}

      <Section title="Região" icon="scroll">
        <label className="field">
          <span>Nome</span>
          <InlineField
            value={region.name}
            ariaLabel="Nome da região"
            onCommit={(value) => {
              const name = value.trim();
              if (name) onPatch({ name });
            }}
          />
        </label>

        <h3 className="subsection-title">Descrição</h3>
        <InlineField
          value={region.description}
          mode="textarea"
          ariaLabel="Descrição da região"
          placeholder="Descreva o clima, a cultura, os perigos da região..."
          onCommit={(value) => onPatch({ description: value })}
        />
      </Section>

      <Section title="Anotações" icon="quill" subtitle="Só o mestre vê">
        <InlineField
          value={region.notes}
          mode="textarea"
          ariaLabel="Anotações da região"
          placeholder="Ganchos de aventura, segredos, o que está por vir..."
          onCommit={(value) => onPatch({ notes: value })}
        />
      </Section>

      <Section title="Imagens" icon="star" subtitle="PNG, JPEG, WEBP ou GIF · até 5 MB cada">
        <ImageGallery
          images={region.images}
          addLabel="+ adicionar imagens"
          uploading={uploading}
          error={error}
          altFallback={region.name}
          onAdd={(files) => void handleFiles(files)}
          onRemove={(url) => onPatch({ images: region.images.filter((image) => image.url !== url) })}
        />
      </Section>

      <Section
        title="Criaturas da região"
        icon="flame"
        subtitle="Anexa criaturas e NPCs que já existem no bestiário"
      >
        {linked.length === 0 ? (
          <p className="empty-hint">
            Nenhuma criatura anexada. Escolha abaixo uma do bestiário — o cadastro dela continua
            sendo feito na aba Bestiário.
          </p>
        ) : (
          <ul className="geo-creature-list">
            {linked.map((creature) => (
              <li key={creature.id} className="geo-creature-row">
                <span className="geo-creature-name">
                  {creature.name}
                  <span className="geo-meta">
                    {' '}
                    · {creature.kind === 'NPC' ? 'NPC' : 'criatura'}
                    {creature.challengeRating ? ` · ND ${creature.challengeRating}` : ''}
                  </span>
                </span>
                <span className="geo-creature-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => onOpenCreature(creature)}
                  >
                    abrir ficha
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => onPatchCreature(creature.id, { regionId: null })}
                  >
                    desvincular
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="geo-create">
          <label>
            Anexar do bestiário
            <select value={pick} onChange={(event) => setPick(event.target.value)}>
              <option value="">
                {available.length === 0 ? 'todas já estão nesta região' : 'escolha uma criatura'}
              </option>
              {available.map((creature) => (
                <option key={creature.id} value={creature.id}>
                  {creature.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={attach}
            disabled={!pick}
          >
            anexar à região
          </button>
        </div>
      </Section>
    </div>
  );
}
