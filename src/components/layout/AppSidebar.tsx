import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn.ts';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface Props {
  itens: NavItem[];
  ativo: string;
  onSelecionar: (id: string) => void;
}

/** Sidebar fixa — só no desktop (lg+). No mobile a navegação é a BottomNav. */
export function AppSidebar({ itens, ativo, onSelecionar }: Props) {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      {/* Marca */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-sidebar-border">
          <img src="/logo-calt.jpeg" alt="CALT" className="h-full w-full object-contain" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">CALT</div>
          <div className="text-xs text-muted-foreground">CRM Consórcio</div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Geral</div>
        <ul className="space-y-1">
          {itens.map((item) => {
            const Icon = item.icon;
            const selecionado = item.id === ativo;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSelecionar(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    selecionado
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3 text-xs text-muted-foreground">
        WhatsApp 86 99965-1602
      </div>
    </aside>
  );
}
