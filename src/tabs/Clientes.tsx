import { useEffect, useState } from 'react';
import { Search, Star, CheckCircle2, Banknote, BriefcaseBusiness, Clock3, WalletCards } from 'lucide-react';
import { api } from '../lib/api.ts';
import { FUNIL_LABELS, type Cliente } from '../lib/funil.ts';
import { Card } from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { FichaCliente } from '../components/clientes/FichaCliente.tsx';

const brl = (n?: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));
const rotulo = (s?: string | null) => (!s ? '—' : ({ auto: 'Automóvel', carro: 'Automóvel', imovel: 'Imóvel', solar: 'Solar' }[s] ?? s));

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<Cliente | null>(null);

  function carregar(q = '') {
    api.get<{ clientes: Cliente[] }>(`/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then((r) => setClientes(r.clientes)).catch(() => {});
  }
  useEffect(() => carregar(), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{clientes.length} contato(s).</p>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 pl-9 sm:h-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && carregar(busca)}
            placeholder="Buscar por nome ou telefone..."
          />
        </div>
      </div>

      {/* Mobile: lista de cards */}
      <div className="space-y-2 md:hidden">
        {clientes.map((c) => (
          <Card key={c.id} className="cursor-pointer p-3 transition-colors hover:border-primary/30" onClick={() => setSelecionado(c)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1 font-medium">
                  <span className="truncate">{c.nome || c.telefone}</span>
                  {c.vip && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {c.cidade || '—'}{c.estado ? `/${c.estado}` : ''} · {rotulo(c.pretensao_bem)}
                </div>
              </div>
              {c.qualificacao_completa && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Badge variant="secondary">{FUNIL_LABELS[c.etapa] ?? c.etapa}</Badge>
              <span className="text-sm font-medium text-primary">{brl(c.credito_pretendido)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><BriefcaseBusiness className="h-3 w-3" /> {c.profissao || 'Profissão pendente'}</span>
              <span className="flex items-center gap-1"><WalletCards className="h-3 w-3" /> Parcela {brl(c.valor_parcela_ideal)}</span>
              <span className="flex items-center gap-1"><Banknote className="h-3 w-3" /> Renda {brl(c.renda_aproximada)}</span>
              <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {c.urgencia === 'imediato' ? 'Imediato' : c.urgencia === 'programado' ? 'Programado' : 'Urgência pendente'}</span>
            </div>
          </Card>
        ))}
        {clientes.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente ainda.</Card>
        )}
      </div>

      {/* Desktop: tabela */}
      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Cidade/UF</th>
                <th className="px-4 py-3 font-medium">Bem</th>
                <th className="px-4 py-3 font-medium">Crédito</th>
                <th className="px-4 py-3 font-medium">Etapa</th>
                <th className="px-4 py-3 font-medium">Qualificado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} onClick={() => setSelecionado(c)} className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-1">
                      {c.nome || c.telefone}
                      {c.vip && <Star className="h-3.5 w-3.5 fill-warning text-warning" />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.cidade || '—'}{c.estado ? `/${c.estado}` : ''}</td>
                  <td className="px-4 py-3">{rotulo(c.pretensao_bem)}</td>
                  <td className="px-4 py-3">{brl(c.credito_pretendido)}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{FUNIL_LABELS[c.etapa] ?? c.etapa}</Badge></td>
                  <td className="px-4 py-3">
                    {c.qualificacao_completa
                      ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> Sim</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
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
