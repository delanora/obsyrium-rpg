import { useAuth } from '../auth';
import { PageVolumeControl } from './PageVolumeControl';
import type { SessionUser } from '../types';
import type { ConnectionState } from '../useRealtime';
import './app-header-brand.css';

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: 'conectando...',
  online: 'tempo real ativo',
  offline: 'sem conexão em tempo real',
};

interface AppHeaderProps {
  connection: ConnectionState;
  lastEventAt: string | null;
  user: SessionUser;
}

/** Cabeçalho compartilhado: identidade Obsyrium, conexão, conta, volume local e saída. */
export function AppHeader({ connection, lastEventAt, user }: AppHeaderProps) {
  const { logout } = useAuth();

  return (
    <header className="app-header app-header-obsyrium">
      <div className="app-header-title">
        <h1>
          <img className="app-header-logo" src="/brand/obsyrium-nome.png" alt="Obsyrium" width={2172} height={724} decoding="async" />
        </h1>
      </div>

      <div className="app-header-meta">
        <span
          className={`connection ${connection}`}
          title={lastEventAt ? `Último evento: ${new Date(lastEventAt).toLocaleTimeString('pt-BR')}` : undefined}
        >
          ● {CONNECTION_LABELS[connection]}
        </span>

        <span className="user-chip">
          {user.displayName}
          <em className={`role role-${user.role.toLowerCase()}`}>
            {user.role === 'MASTER' ? 'Mestre' : 'Jogador'}
          </em>
        </span>

        <div className="header-actions">
          <PageVolumeControl />

          <button type="button" className="btn btn-small" onClick={logout}>
            sair
          </button>
        </div>
      </div>
    </header>
  );
}
