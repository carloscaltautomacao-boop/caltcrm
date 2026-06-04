import { useEffect, useState } from 'react';

type Tema = 'light' | 'dark';
const CHAVE = 'cc-tema';

function aplicar(tema: Tema): void {
  document.documentElement.classList.toggle('dark', tema === 'dark');
}

function inicial(): Tema {
  const salvo = localStorage.getItem(CHAVE) as Tema | null;
  if (salvo) return salvo;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [tema, setTema] = useState<Tema>(inicial);

  useEffect(() => {
    aplicar(tema);
    localStorage.setItem(CHAVE, tema);
  }, [tema]);

  return {
    tema,
    alternar: () => setTema((t) => (t === 'dark' ? 'light' : 'dark')),
  };
}
