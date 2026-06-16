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
    <aside className="hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      {/* Marca */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          <img src="/logo-calt.jpeg" alt="CALT" className="h-full w-full object-contain" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-lg font-semibold tracking-tight">CALT</div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">CRM Consórcio</div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">Operação</div>
        <ul className="space-y-1">
          {itens.map((item) => {
            const Icon = item.icon;
            const selecionado = item.id === ativo;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onSelecionar(item.id)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
                    selecionado
                      ? 'bg-primary/15 font-semibold text-white ring-1 ring-inset ring-primary/25'
                      : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  {/* Indicador coral à esquerda */}
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-200',
                      selecionado ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
                    )}
                  />
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      selecionado ? 'text-primary' : 'text-sidebar-muted group-hover:text-sidebar-accent-foreground',
                    )}
                  />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2 text-xs text-sidebar-muted">
          <span className="flex h-2 w-2 shrink-0">
            <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-success opacity-60" />
            <span className="-ml-2 inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          WhatsApp 86 99965-1602
        </div>
      </div>
    </aside>
  );
}
