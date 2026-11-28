import { useEffect, useState } from 'react';
import { ApiError } from '../../api';
import { fetchBreathOptions, type BreathOptions } from './breathWeaponApi';

/** Só apresenta a definição derivada pelo servidor para o próprio personagem. */
export function DragonbornBreathControl({ combatId, combatVersion, disabled, onPrepare, onError }: {
  combatId: string; combatVersion: number; disabled: boolean;
  onPrepare: (options: BreathOptions) => void; onError: (message: string) => void;
}) {
  const [options, setOptions] = useState<BreathOptions | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    setOptions(null);
    fetchBreathOptions(combatId).then(value => { if (current) setOptions(value); }).catch(error => {
      if (current && !(error instanceof ApiError && [403, 404, 409].includes(error.status))) onError('Não foi possível consultar a Arma de Sopro.');
    });
    return () => { current = false; };
  }, [combatId, combatVersion, onError]);
  if (!options) return null;
  return <button type="button" className="btn btn-small grid-breath-control"
    onPointerDown={event => event.stopPropagation()}
    disabled={disabled || busy || !options.canUse} title="Preparar a área da Arma de Sopro no grid"
    onClick={async () => {
      setBusy(true);
      try { const fresh = await fetchBreathOptions(combatId); setOptions(fresh); if (fresh.canUse) onPrepare(fresh); }
      catch (error) { onError(error instanceof Error ? error.message : 'Não foi possível preparar o Sopro.'); }
      finally { setBusy(false); }
    }}>Arma de Sopro · {options.remaining}/1</button>;
}
