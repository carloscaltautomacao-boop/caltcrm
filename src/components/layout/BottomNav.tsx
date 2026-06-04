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

/** Barra de navegação inferior — visível só no mobile (estilo app nativo). */
export function BottomNav({ itens, ativo, onSelecionar }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-safe backdrop-blur lg:hidden"
      aria-label="Navegação principal"
    >
      <ul className="flex items-stretch">
        {itens.map((item) => {
          const Icon = item.icon;
          const selecionado = item.id === ativo;
          return (
            <li key={item.id} className="flex-1">
              <button
                onClick={() => onSelecionar(item.id)}
                aria-current={selecionado ? 'page' : undefined}
                className={cn(
                  'flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  selecionado ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', selecionado && 'scale-110')} />
                <span className="leading-none">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
