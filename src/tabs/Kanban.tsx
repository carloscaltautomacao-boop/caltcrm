import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../lib/api.ts';
import { FUNIL_ETAPAS, FUNIL_LABELS, type Cliente } from '../lib/funil.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import { pode, PERMISSIONS } from '../lib/permissions.ts';
import { cn } from '../lib/cn.ts';

const brl = (n?: number | null) => (n == null ? null : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

export function Kanban() {
  const { user } = useAuth();
  const podeMover = pode(user, PERMISSIONS.KANBAN_EDIT);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [arrastando, setArrastando] = useState<string | null>(null);

  function carregar() {
    api.get<{ clientes: Cliente[] }>('/clientes').then((r) => setClientes(r.clientes)).catch(() => {});
  }
  useEffect(carregar, []);

  async function soltar(etapa: string) {
    if (!arrastando || !podeMover) return;
    const id = arrastando;
    setArrastando(null);
    setClientes((cs) => cs.map((c) => (c.id === id ? { ...c, etapa } : c)));
    await api.patch(`/clientes/${id}/etapa`, { etapa }).catch(carregar);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="hidden lg:inline">Arraste os cards entre as etapas do funil.</span>
        <span className="lg:hidden">Deslize para ver as etapas do funil.</span>
      </p>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [-webkit-overflow-scrolling:touch] lg:snap-none">
        {FUNIL_ETAPAS.map((etapa) => {
          const doStage = clientes.filter((c) => c.etapa === etapa);
          return (
            <div
              key={etapa}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltar(etapa)}
              className="w-[78vw] max-w-xs shrink-0 snap-start rounded-xl border border-border bg-muted/40 p-2 sm:w-72 sm:max-w-none"
            >
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-medium">{FUNIL_LABELS[etapa]}</span>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{doStage.length}</span>
              </div>
              <div className="space-y-2">
                {doStage.map((c) => {
                  const valor = brl(c.credito_pretendido);
                  return (
                    <div
                      key={c.id}
                      draggable={podeMover}
                      onDragStart={() => setArrastando(c.id)}
                      className={cn(
                        'rounded-lg border border-border bg-card p-3 text-sm shadow-sm transition',
                        podeMover && 'cursor-grab hover:shadow-md active:cursor-grabbing',
                      )}
                    >
                      <div className="flex items-center gap-1 font-medium">
                        {c.nome || c.telefone}
                        {c.vip && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {c.cidade || '—'}{c.estado ? `/${c.estado}` : ''} · {rotulo(c.pretensao_bem)}
                      </div>
                      {valor && <div className="mt-1 text-xs font-medium text-primary">{valor}</div>}
                    </div>
                  );
                })}
                {doStage.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">vazio</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function rotulo(s?: string | null): string {
  if (!s) return '—';
  return { auto: 'Automóvel', carro: 'Automóvel', imovel: 'Imóvel', solar: 'Solar' }[s] ?? s;
}
