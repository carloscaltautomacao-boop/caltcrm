import { useState } from 'react';
import { Moon, Sun, LogOut } from 'lucide-react';
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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/70 px-4 pt-safe backdrop-blur-xl lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Marca compacta — só no mobile, já que a sidebar some */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 lg:hidden">
          <img src="/logo-calt.jpeg" alt="CALT" className="h-full w-full object-contain" />
        </div>
        <h1 className="truncate font-display text-lg font-semibold tracking-tight lg:text-xl">{titulo}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <InstallButton />

        <Button variant="ghost" size="icon" onClick={onAlternarTema} aria-label="Alternar tema">
          {tema === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <div className="relative">
          <button
            onClick={() => setMenuAberto((v) => !v)}
            className="flex items-center gap-2 rounded-full p-0.5 transition-transform hover:scale-105"
            aria-label="Conta"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-primary-foreground shadow-sm ring-2 ring-background">
              {inicial}
            </span>
          </button>

          {menuAberto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
              <div className={cn(
                'absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg',
              )}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-primary-foreground">
                    {inicial}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Minha conta</div>
                    <div className="truncate text-xs text-muted-foreground">{email}</div>
                  </div>
                </div>
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
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
