import { useState, type ReactNode } from 'react';
import { LayoutDashboard, Columns3, Users, MessageSquare, CalendarDays, Settings, ClipboardList } from 'lucide-react';
import { useAuth } from './auth/AuthContext.tsx';
import { LoginScreen } from './auth/LoginScreen.tsx';
import { useTheme } from './lib/theme.ts';
import { pode, PERMISSIONS, type Permission } from './lib/permissions.ts';
import { AppSidebar, type NavItem } from './components/layout/AppSidebar.tsx';
import { BottomNav } from './components/layout/BottomNav.tsx';
import { Header } from './components/layout/Header.tsx';
import { Dashboard } from './tabs/Dashboard.tsx';
import { Kanban } from './tabs/Kanban.tsx';
import { Clientes } from './tabs/Clientes.tsx';
import { ControleClientes } from './tabs/ControleClientes.tsx';
import { Chat } from './tabs/Chat.tsx';
import { Calendario } from './tabs/Calendario.tsx';
import { Configuracoes } from './tabs/Configuracoes.tsx';

interface Aba extends NavItem {
  perm: Permission;
  titulo: string;
  render: () => ReactNode;
}

const ABAS: Aba[] = [
  { id: 'dashboard', label: 'Dashboard', titulo: 'Dashboard', icon: LayoutDashboard, perm: PERMISSIONS.DASHBOARD_VIEW, render: () => <Dashboard /> },
  { id: 'kanban', label: 'Funil', titulo: 'Funil de leads', icon: Columns3, perm: PERMISSIONS.CLIENTES_VIEW, render: () => <Kanban /> },
  { id: 'controle-clientes', label: 'Controle', titulo: 'Controle de clientes', icon: ClipboardList, perm: PERMISSIONS.CLIENTES_VIEW, render: () => <ControleClientes /> },
  { id: 'clientes', label: 'Clientes', titulo: 'Clientes', icon: Users, perm: PERMISSIONS.CLIENTES_VIEW, render: () => <Clientes /> },
  { id: 'agenda', label: 'Agenda', titulo: 'Calendário e tarefas', icon: CalendarDays, perm: PERMISSIONS.AGENDA_VIEW, render: () => <Calendario /> },
  { id: 'chat', label: 'Chat', titulo: 'Chat', icon: MessageSquare, perm: PERMISSIONS.CHAT_VIEW, render: () => <Chat /> },
  { id: 'config', label: 'Configurações', titulo: 'Configurações', icon: Settings, perm: PERMISSIONS.CONFIG_VIEW, render: () => <Configuracoes /> },
];

export function App() {
  const { user, carregando, logout } = useAuth();
  const { tema, alternar } = useTheme();
  const [ativa, setAtiva] = useState(() =>
    new URLSearchParams(window.location.search).has('google_calendar') ? 'agenda' : 'dashboard',
  );

  if (carregando) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-16 w-16 animate-rise items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
          <img src="/logo-calt.jpeg" alt="CALT" className="h-full w-full object-contain" />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
        </div>
      </div>
    );
  }
  if (!user) return <LoginScreen />;

  const abasVisiveis = ABAS.filter((a) => pode(user, a.perm));
  const abaAtual = abasVisiveis.find((a) => a.id === ativa) ?? abasVisiveis[0];

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <AppSidebar itens={abasVisiveis} ativo={abaAtual?.id ?? ''} onSelecionar={setAtiva} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          titulo={abaAtual?.titulo ?? ''}
          email={user.email}
          tema={tema}
          onAlternarTema={alternar}
          onLogout={logout}
        />
        {/* pb extra no mobile para não ficar sob a BottomNav */}
        <main className="flex-1 overflow-auto p-4 pb-24 lg:p-6 lg:pb-6">{abaAtual?.render()}</main>
      </div>

      <BottomNav itens={abasVisiveis} ativo={abaAtual?.id ?? ''} onSelecionar={setAtiva} />
    </div>
  );
}
