import { useEffect, useState } from 'react';
import { Download, Share, X, Plus } from 'lucide-react';
import { Button } from '../ui/button.tsx';

/** Evento beforeinstallprompt (Android/desktop Chrome) — não tipado no lib.dom padrão. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function rodandoComoApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function ehIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

/**
 * Botão "Instalar app". No Android/desktop usa o prompt nativo do navegador.
 * No iOS (que não tem prompt) mostra as instruções de "Adicionar à Tela de Início".
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(rodandoComoApp);
  const [mostrarIos, setMostrarIos] = useState(false);
  const ios = ehIos();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalado(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Já instalado, ou nada a oferecer (sem prompt e não é iOS) → não mostra nada.
  if (instalado || (!prompt && !ios)) return null;

  async function instalar() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else if (ios) {
      setMostrarIos(true);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={instalar} className="gap-1.5">
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Instalar app</span>
        <span className="sm:hidden">Instalar</span>
      </Button>

      {mostrarIos && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setMostrarIos(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Instalar no iPhone/iPad</h2>
              <button onClick={() => setMostrarIos(false)} aria-label="Fechar" className="rounded-md p-1 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground">1</span>
                Toque no botão <Share className="mx-1 inline h-4 w-4" /> <span className="font-medium text-foreground">Compartilhar</span> na barra do Safari.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground">2</span>
                Escolha <Plus className="mx-1 inline h-4 w-4" /> <span className="font-medium text-foreground">Adicionar à Tela de Início</span>.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-foreground">3</span>
                Confirme em <span className="font-medium text-foreground">Adicionar</span>. Pronto!
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
