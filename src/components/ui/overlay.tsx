import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

// Modal/overlay simples (sem dependência externa). Bottom-sheet no mobile, centralizado no desktop.
// Clique no fundo fecha; clique no conteúdo não propaga.
export function Overlay({ children, onFechar, className }: { children: ReactNode; onFechar: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onFechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'max-h-[90dvh] w-full overflow-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl',
          className ?? 'max-w-lg',
        )}
      >
        {children}
      </div>
    </div>
  );
}
