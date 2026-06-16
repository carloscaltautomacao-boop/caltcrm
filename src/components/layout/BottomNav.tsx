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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 pb-safe backdrop-blur-xl lg:hidden"
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
                  'relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  selecionado ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {/* Indicador superior */}
                <span
                  className={cn(
                    'absolute top-0 h-0.5 w-8 rounded-full bg-primary transition-all duration-300',
                    selecionado ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-all duration-200',
                    selecionado && 'bg-primary/12',
                  )}
                >
                  <Icon className={cn('h-5 w-5 transition-transform', selecionado && 'scale-110')} />
                </span>
                <span className="leading-none">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
