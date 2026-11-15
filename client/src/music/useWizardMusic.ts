import { useEffect } from 'react';
import { isMuted, subscribeMuted } from '../sound';
import { WizardMusicLoop } from './wizardMusic';

/** Uma única faixa durante todas as etapas; o navegador pode exigir o primeiro gesto. */
export function useWizardMusic() {
  useEffect(() => {
    let live = true, loading = false;
    let audio: AudioContext | null = null, loop: WizardMusicLoop | null = null;
    const controller = new AbortController();
    async function start() {
      if (!live || isMuted() || loading || loop) return;
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audio ??= new Ctor();
      // Chamado também dentro do gesto, antes de qualquer await, para liberar o áudio.
      void audio.resume().catch(() => {});
      loading = true;
      try {
        const response = await fetch('/creation/celebracao.mp3', { signal: controller.signal });
        if (!response.ok) throw new Error('Música indisponível.');
        const buffer = await audio.decodeAudioData(await response.arrayBuffer());
        if (live) loop = new WizardMusicLoop(audio, buffer, isMuted());
      } catch { /* A ambientação nunca bloqueia o assistente. */ }
      finally { loading = false; }
    }
    const gesture = () => {
      if (audio?.state === 'suspended' && !isMuted()) void audio.resume().catch(() => {});
      void start();
    };
    const unsubscribe = subscribeMuted(muted => { loop?.setMuted(muted); if (!muted) gesture(); });
    document.addEventListener('pointerdown', gesture);
    document.addEventListener('keydown', gesture);
    void start();
    return () => {
      live = false; controller.abort(); unsubscribe();
      document.removeEventListener('pointerdown', gesture); document.removeEventListener('keydown', gesture);
      if (loop) loop.stop(); else if (audio) void audio.close().catch(() => {});
    };
  }, []);
}
