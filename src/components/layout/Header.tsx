import { useState } from 'react';
import { Landmark, Moon, Sun, LogOut, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { InstallButton } from './InstallButton.tsx';
import { cn } from '../../lib/cn.ts';

interface Props {
  titulo: string;
  email: string;
  tema: 'light' | 'dark';
  onAlternarTema: () => void;
  onLogout: () => void;
}

export function Header({ titulo, email, tema, onAlternarTema, onLogout }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const inicial = email.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 pt-safe backdrop-blur lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Marca compacta — só no mobile, já que a sidebar some */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
          <Landmark className="h-4 w-4" />
        </div>
        <h1 className="truncate text-base font-semibold lg:text-lg">{titulo}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <InstallButton />

        <Button variant="ghost" size="icon" onClick={onAlternarTema} aria-label="Alternar tema">
          {tema === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <div className="relative">
          <button
            onClick={() => setMenuAberto((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            aria-label="Conta"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {inicial}
            </span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </button>

          {menuAberto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
              <div className={cn(
                'absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
              )}>
                <div className="px-3 py-2 text-sm">
                  <div className="font-medium">Conta</div>
                  <div className="truncate text-xs text-muted-foreground">{email}</div>
                </div>
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
