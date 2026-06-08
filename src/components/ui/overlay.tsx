import type { ReactNode } from 'react';

// Modal/overlay simples (sem dependência externa). Bottom-sheet no mobile, centralizado no desktop.
// Clique no fundo fecha; clique no conteúdo não propaga.
export function Overlay({ children, onFechar }: { children: ReactNode; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onFechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}
