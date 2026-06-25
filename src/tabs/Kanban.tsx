import { useEffect, useState } from 'react';
import { Star, Car, Home, Sun, Package, MapPin, WalletCards, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api.ts';
import { FUNIL_ETAPAS, FUNIL_LABELS, type Cliente } from '../lib/funil.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import { pode, PERMISSIONS } from '../lib/permissions.ts';
import { cn } from '../lib/cn.ts';
import { FichaCliente } from '../components/clientes/FichaCliente.tsx';

const brl = (n?: number | null) => (n == null ? null : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

export function Kanban() {
  const { user } = useAuth();
  const podeMover = pode(user, PERMISSIONS.KANBAN_EDIT);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Cliente | null>(null);

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
              className="flex w-[80vw] max-w-xs shrink-0 snap-start flex-col rounded-2xl border border-border bg-muted/40 p-2.5 sm:w-72 sm:max-w-none"
            >
              <div className="mb-1 flex items-center justify-between px-1.5 py-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{FUNIL_LABELS[etapa]}</span>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular text-muted-foreground shadow-xs">{doStage.length}</span>
              </div>
              <div className="space-y-2">
                {doStage.map((c) => {
                  const valor = brl(c.credito_pretendido);
                  const Icon = iconeSegmento(c.pretensao_bem);
                  return (
                    <div
                      key={c.id}
                      draggable={podeMover}
                      onDragStart={() => setArrastando(c.id)}
                      onClick={() => {
                        if (!arrastando) setSelecionado(c);
                      }}
                      className={cn(
                        'group rounded-xl border border-border bg-card p-3 text-sm shadow-sm transition-all duration-200',
                        podeMover && 'cursor-grab hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:cursor-grabbing',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5 font-medium">
                          <span className="truncate">{c.nome || c.telefone}</span>
                          {c.vip && <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" />}
                        </div>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {c.cidade || '—'}{c.estado ? `/${c.estado}` : ''} · {rotulo(c.pretensao_bem)}
                      </div>
                      {valor && (
                        <div className="mt-2 inline-flex items-center rounded-md bg-gold/12 px-2 py-0.5 text-xs font-semibold tabular text-gold">
                          {valor}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{c.tipo_bem || c.profissao || 'Dados em coleta'}</span>
                        {c.valor_parcela_ideal != null && (
                          <span className="inline-flex shrink-0 items-center gap-1"><WalletCards className="h-3 w-3" /> {brl(c.valor_parcela_ideal)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {doStage.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">vazio</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selecionado && (
        <FichaCliente
          cliente={selecionado}
          onFechar={() => setSelecionado(null)}
          onAtualizado={(atualizado) => {
            setClientes((lista) => lista.map((c) => c.id === atualizado.id ? atualizado : c));
            setSelecionado(atualizado);
          }}
        />
      )}
    </div>
  );
}

function rotulo(s?: string | null): string {
  if (!s) return '—';
  return { auto: 'Automóvel', carro: 'Automóvel', imovel: 'Imóvel', solar: 'Solar' }[s] ?? s;
}

function iconeSegmento(s?: string | null): LucideIcon {
  if (!s) return Package;
  return ({ auto: Car, carro: Car, imovel: Home, solar: Sun } as Record<string, LucideIcon>)[s] ?? Package;
}
