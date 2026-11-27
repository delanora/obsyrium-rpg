import { useState } from 'react';
import { fileToImagePayload, uploadImage } from '../../api';
import type { Locality, LocalityPatch, Region } from '../../types';
import { ImageGallery } from './ImageGallery';
import { InlineField } from '../InlineField';
import { Section } from '../Section';

interface LocalityEditorProps {
  locality: Locality;
  /** Regiões da mesa: a localidade pode ficar solta (sem região). */
  regions: Region[];
  onPatch: (patch: LocalityPatch) => void;
  onDelete: () => void;
}

/**
 * Detalhes da localidade, abertos pelo card do bloco "Localidades".
 *
 * Cuida só da identidade do lugar (nome, região, descrição e imagens). Cenas e
 * criaturas vivem nos próprios blocos da Geografia — não aqui.
 */
export function LocalityEditor({ locality, regions, onPatch, onDelete }: LocalityEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const images = [...locality.images];
      for (const file of Array.from(files)) {
        const payload = await fileToImagePayload(file);
        images.push(await uploadImage(payload.dataUrl, payload.name));
      }
      onPatch({ images });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar a imagem.');
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string): void {
    onPatch({ images: locality.images.filter((image) => image.url !== url) });
  }

  return (
    <div className="creature-editor">
      <Section
        title="Localidade"
        icon="home"
        actions={
          <button type="button" className="btn btn-danger btn-small" onClick={onDelete}>
            remover
          </button>
        }
      >
        <label className="field">
          <span>Nome</span>
          <InlineField
            value={locality.name}
            ariaLabel="Nome da localidade"
            onCommit={(value) => {
              const name = value.trim();
              if (name) onPatch({ name });
            }}
          />
        </label>

        <label className="field">
          <span>Região</span>
          <select
            value={locality.regionId ?? ''}
            onChange={(event) => onPatch({ regionId: event.target.value || null })}
          >
            <option value="">Sem região</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>

        <h3 className="subsection-title">Descrição</h3>
        <InlineField
          value={locality.description}
          mode="textarea"
          ariaLabel="Descrição da localidade"
          placeholder="Descreva o lugar, seus moradores e perigos..."
          onCommit={(value) => onPatch({ description: value })}
        />
      </Section>

      <Section title="Imagens" icon="star" subtitle="PNG, JPEG, WEBP ou GIF · até 5 MB cada">
        <ImageGallery
          images={locality.images}
          addLabel="+ adicionar imagens"
          uploading={uploading}
          error={error}
          altFallback={locality.name}
          onAdd={(files) => void handleFiles(files)}
          onRemove={removeImage}
        />
      </Section>
    </div>
  );
}
