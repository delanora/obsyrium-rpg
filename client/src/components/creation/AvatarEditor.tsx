import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fileToImagePayload, uploadAvatar } from '../../api';
import { Icon } from '../Icon';
import './avatar-editor.css';

const FRAMES = [{ id: 'ametista', name: 'Ametista' }, { id: 'esmeralda', name: 'Esmeralda' }, { id: 'rubi', name: 'Rubi' }];
type Draft = { source: string; frame: string; zoom: number; x: number; y: number; result: string; dirty?: boolean };
export interface AvatarEditorHandle { save: () => Promise<string> }
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Não foi possível carregar a imagem.')); image.src = src; });
}
/** O recorte e a moldura são exportados juntos, preservando transparência no token. */
export const AvatarEditor = forwardRef<AvatarEditorHandle, { value: string; userId: string; onBusy: (busy: boolean) => void; onError: (message: string) => void }>(function AvatarEditor({ value, userId, onBusy, onError }, ref) {
  const cacheKey = `obsyrium.avatar-editor.${userId}`;
  const [draft, setDraft] = useState<Draft>(() => {
    try { const saved = JSON.parse(localStorage.getItem(cacheKey) ?? 'null'); if (saved?.result === value && FRAMES.some(frame => frame.id === saved.frame) && typeof saved.source === 'string') return saved; } catch { /* Cache opcional. */ }
    const storedFrame = value.split('#obsyrium-frame=')[1];
    return { source: value, frame: FRAMES.some(frame => frame.id === storedFrame) ? storedFrame : 'ametista', zoom: 1, x: 0, y: 0, result: value, dirty: Boolean(value && !value.includes('#obsyrium-frame=')) };
  });
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const fileInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const baked = draft.source.includes('#obsyrium-frame=');
  useEffect(() => { let active = true; if (draft.source) loadImage(draft.source).then(image => { if (active) setDimensions({ width: image.width, height: image.height }); }).catch(error => onError(error.message)); return () => { active = false; }; }, [draft.source]);
  useEffect(() => { try { localStorage.setItem(cacheKey, JSON.stringify(draft)); } catch { /* A composição ainda pode ser salva sem cache local. */ } }, [cacheKey, draft]);
  const baseScale = Math.max(.8 / dimensions.width, .78 / dimensions.height);
  const width = dimensions.width * baseScale * draft.zoom;
  const height = dimensions.height * baseScale * draft.zoom;
  function update(values: Partial<Draft>) { setDraft(current => ({ ...current, ...values, dirty: true })); }
  function position(x: number, y: number) { update({ x: Math.max(-Math.max(0, (width - .8) / 2), Math.min(Math.max(0, (width - .8) / 2), x)), y: Math.max(-Math.max(0, (height - .78) / 2), Math.min(Math.max(0, (height - .78) / 2), y)) }); }
  async function upload(file?: File) {
    if (!file) return; onBusy(true);
    try { const payload = await fileToImagePayload(file); const stored = await uploadAvatar(payload.dataUrl, payload.name); update({ source: stored.url, zoom: 1, x: 0, y: 0 }); }
    catch (error) { onError(error instanceof Error ? error.message : 'Falha ao enviar imagem.'); } finally { onBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  useImperativeHandle(ref, () => ({ save: async () => {
    if (!draft.source || (!draft.dirty && draft.result)) return draft.result;
    if (baked) return draft.source;
    const [image, frame] = await Promise.all([loadImage(draft.source), loadImage(`/avatar-frames/${draft.frame}.png`)]);
    const exportScale = Math.max(.8 / image.width, .78 / image.height) * draft.zoom;
    const exportWidth = image.width * exportScale, exportHeight = image.height * exportScale;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1254;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar o avatar.');
    context.save(); context.beginPath(); context.ellipse(627, 571, 502, 489, 0, 0, Math.PI * 2); context.clip();
    context.drawImage(image, (0.5 + draft.x - exportWidth / 2) * 1254, (.455 + draft.y - exportHeight / 2) * 1254, exportWidth * 1254, exportHeight * 1254); context.restore();
    // A máscara altera somente o alfa; a textura vem sempre do PNG original.
    const layer = document.createElement('canvas'); layer.width = layer.height = 1254;
    const layerContext = layer.getContext('2d'); if (!layerContext) throw new Error('Não foi possível preparar a moldura.');
    layerContext.drawImage(frame, 0, 0, 1254, 1254);
    if (draft.frame !== 'rubi') {
      const mask = await loadImage(`/avatar-frames/${draft.frame}-recorte.png`);
      layerContext.globalCompositeOperation = 'destination-in'; layerContext.drawImage(mask, 0, 0, 1254, 1254);
    }
    context.drawImage(layer, 0, 0);
    const saved = await uploadAvatar(canvas.toDataURL('image/png'), 'avatar-com-moldura.png');
    const result = `${saved.url}#obsyrium-frame=${draft.frame}`;
    const next = { ...draft, result, dirty: false }; setDraft(next);
    try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Cache opcional. */ }
    return result;
  } }));
  return <div className="avatar-editor">
    <div className={`avatar-editor-stage${draft.source ? ' has-image' : ''}`} ref={stage}
      tabIndex={draft.source && !baked ? 0 : undefined} role="group" aria-label="Posicionar avatar: arraste ou use as setas"
      onKeyDown={event => { if (!draft.source || baked || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return; event.preventDefault(); position(draft.x + (event.key === 'ArrowLeft' ? -.01 : event.key === 'ArrowRight' ? .01 : 0), draft.y + (event.key === 'ArrowUp' ? -.01 : event.key === 'ArrowDown' ? .01 : 0)); }}
      onPointerDown={event => { if (!draft.source || baked) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, startX: draft.x, startY: draft.y }; }}
      onPointerMove={event => { if (!drag.current) return; const size = event.currentTarget.clientWidth; position(drag.current.startX + (event.clientX - drag.current.x) / size, drag.current.startY + (event.clientY - drag.current.y) / size); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {draft.source ? <>{baked ? <img className="avatar-editor-baked" src={draft.source} alt="Avatar do personagem" /> : <>
        <div className="avatar-editor-crop"><img src={draft.source} alt="Imagem do personagem" draggable={false} style={{ width: `${width * 100}%`, height: `${height * 100}%`, left: `${(0.5 + draft.x) * 100}%`, top: `${(.455 + draft.y) * 100}%` }} /></div>
        <img className="avatar-editor-frame" data-frame={draft.frame} src={`/avatar-frames/${draft.frame}.png`} alt="" draggable={false} />
      </>}</> : <button type="button" className="avatar-editor-add" onClick={() => fileInput.current?.click()} aria-label="Adicionar imagem do personagem"><Icon name="plus" size={56} /></button>}
    </div>
    <button type="button" className="btn" onClick={() => fileInput.current?.click()}>{draft.source ? 'Trocar imagem' : 'Adicionar imagem'}</button>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={event => void upload(event.target.files?.[0])} />
    {draft.source && !baked ? <><p className="section-note">Arraste a imagem para posicionar o rosto dentro da moldura.</p><label className="avatar-editor-zoom">Zoom <input type="range" min="1" max="3" step=".01" value={draft.zoom} onChange={event => update({ zoom: Number(event.target.value), x: 0, y: 0 })} /></label><button type="button" className="btn btn-small" onClick={() => update({ zoom: 1, x: 0, y: 0 })}>Centralizar imagem</button></> : null}
    <h3 className="wizard-selection-title">Escolher moldura</h3>
    <div className="avatar-editor-frames" role="group" aria-label="Moldura do avatar">{FRAMES.map(frame => <button type="button" key={frame.id} aria-pressed={draft.frame === frame.id} disabled={baked} onClick={() => update({ frame: frame.id })}><img data-frame={frame.id} src={`/avatar-frames/${frame.id}.png`} alt="" /><span>{frame.name}</span></button>)}</div>
  </div>;
});
