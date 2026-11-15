import { useAuth } from '../auth';
import { PageVolumeControl } from './PageVolumeControl';
import type { SessionUser } from '../types';
import type { ConnectionState } from '../useRealtime';
import { Icon } from './Icon';

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

/**
 * Cabeçalho do app: a marca, o estado da conexão e as ações da sessão
 * (tema, som e saída).
 *
 * A barra é a mesma para todos e NÃO mostra mais quem é quem: saíram a foto e
 * o nome do personagem/jogador, o título/subtítulo da tela (que repetia o
 * painel ou as contagens da mesa) e a lista de quem está online. O conteúdo de
 * cada aba é que dá esse contexto.
 */
export function AppHeader({ connection, lastEventAt, user }: AppHeaderProps) {
  const { logout } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header-title">
        <h1>
          <Icon name="dragon" className="brand-mark" size={22} /> Codex do Aventureiro
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
