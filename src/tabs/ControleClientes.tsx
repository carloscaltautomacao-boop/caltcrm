import { useEffect, useMemo, useState } from 'react';
import { Pencil, Search, Upload, UserPlus, X } from 'lucide-react';
import { api } from '../lib/api.ts';
import { FUNIL_ETAPAS, FUNIL_LABELS } from '../lib/funil.ts';
import { Card } from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { Button } from '../components/ui/button.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Overlay } from '../components/ui/overlay.tsx';

type ControleMensal = Record<string, string>;

interface ControleCliente {
  id: string;
  nome: string | null;
  telefone: string;
  cpf_cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  etapa: string;
  origem_venda: string | null;
  vendedor_responsavel: string | null;
  grupo_cota: string | null;
  credito_vendido: number | null;
  credito_pretendido?: number | null;
  data_venda: string | null;
  controle_mensal: ControleMensal;
  criado_em: string;
}

type LinhaImportacao = {
  origem_venda?: string;
  vendedor_responsavel?: string;
  nome?: string;
  cpf_cnpj?: string;
  grupo_cota?: string;
  telefone?: string;
  credito_vendido?: string;
  cidade?: string;
  estado?: string;
  etapa?: string;
  data_venda?: string;
  controle_mensal?: ControleMensal;
};

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const brl = (n?: number | null) => (
  n == null ? '-' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
);

const dataBR = (valor?: string | null) => {
  if (!valor) return '-';
  const [ano, mes, dia] = valor.slice(0, 10).split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
};

const vazio = (valor?: string | null) => valor || '-';

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function campoPorCabecalho(cabecalho: string): keyof LinhaImportacao | 'qtd' | string | null {
  const h = normalizar(cabecalho);
  if (!h) return null;
  if (h === 'qtd') return 'qtd';
  if (h.includes('origem') || h.includes('oriegem')) return 'origem_venda';
  if (h === 'vend' || h.includes('vendedor') || h.includes('responsavel')) return 'vendedor_responsavel';
  if (h.includes('cliente') || h.includes('nome')) return 'nome';
  if (h.includes('cpf') || h.includes('cnpj')) return 'cpf_cnpj';
  if (h.includes('grupo') || h.includes('cota')) return 'grupo_cota';
  if (h.includes('telefone') || h.includes('contato')) return 'telefone';
  if (h.includes('credito')) return 'credito_vendido';
  if (h.includes('cidade')) return 'cidade';
  if (h === 'uf' || h.includes('estado')) return 'estado';
  if (h.includes('fase') || h.includes('status')) return 'etapa';
  if (h.includes('data') || h.includes('cadastro') || h.includes('venda')) return 'data_venda';
  if (MESES.includes(h)) return h;
  return null;
}

function separarLinha(linha: string) {
  if (linha.includes('\t')) return linha.split('\t');
  if (linha.includes(';')) return linha.split(';');
  return linha.split(',');
}

function limpar(valor?: string) {
  return (valor ?? '').trim();
}

function parseImportacao(texto: string): LinhaImportacao[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return [];
  const matriz = linhas.map(separarLinha);
  const primeira = matriz[0] ?? [];
  const temCabecalho = primeira.some((c) => ['cliente', 'telefone', 'cpf', 'credito', 'cidade'].includes(normalizar(c)));
  const cabecalhos = temCabecalho ? primeira.map(campoPorCabecalho) : [];
  const dados = temCabecalho ? matriz.slice(1) : matriz;

  return dados.map((cols) => {
    const linha: LinhaImportacao = {};
    const mensal: ControleMensal = {};
    if (temCabecalho) {
      cols.forEach((valor, idx) => {
        const campo = cabecalhos[idx];
        const limpo = limpar(valor);
        if (!campo || campo === 'qtd' || !limpo) return;
        if (MESES.includes(campo)) mensal[campo] = limpo.toUpperCase();
        else (linha as Record<string, string>)[campo] = limpo;
      });
    } else {
      const offset = /^\d+$/.test(limpar(cols[0])) ? 1 : 0;
      linha.origem_venda = limpar(cols[offset]);
      linha.vendedor_responsavel = limpar(cols[offset + 1]);
      linha.nome = limpar(cols[offset + 2]);
      linha.cpf_cnpj = limpar(cols[offset + 3]);
      linha.grupo_cota = limpar(cols[offset + 4]);
      linha.telefone = limpar(cols[offset + 5]);
      linha.credito_vendido = limpar(cols[offset + 6]);
      linha.cidade = limpar(cols[offset + 7]);
      linha.estado = limpar(cols[offset + 8]);
      MESES.forEach((mes, i) => {
        const status = limpar(cols[offset + 9 + i]).toUpperCase();
        if (status) mensal[mes] = status;
      });
    }
    if (Object.keys(mensal).length) linha.controle_mensal = mensal;
    return linha;
  }).filter((linha) => Object.values(linha).some((v) => v && (typeof v !== 'object' || Object.keys(v).length)));
}

function statusMensal(controle: ControleMensal) {
  return MESES.map((mes) => controle?.[mes]).filter(Boolean).slice(-3);
}

function ModalCliente({
  cliente,
  onFechar,
  onSalvar,
}: {
  cliente?: ControleCliente | null;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const [form, setForm] = useState({
    nome: cliente?.nome ?? '',
    telefone: cliente?.telefone ?? '',
    cpf_cnpj: cliente?.cpf_cnpj ?? '',
    cidade: cliente?.cidade ?? '',
    estado: cliente?.estado ?? '',
    origem_venda: cliente?.origem_venda ?? '',
    vendedor_responsavel: cliente?.vendedor_responsavel ?? '',
    grupo_cota: cliente?.grupo_cota ?? '',
    credito_vendido: cliente?.credito_vendido ? String(cliente.credito_vendido) : '',
    etapa: cliente?.etapa ?? 'cliente_parceiro',
    data_venda: cliente?.data_venda?.slice(0, 10) ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function setCampo(campo: keyof typeof form, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      await api.post('/clientes/controle', form);
      onSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar cliente');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar} className="max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{cliente ? 'Editar cliente' : 'Cadastrar cliente'}</h2>
          <p className="text-sm text-muted-foreground">Preencha apenas o que estiver confirmado.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input value={form.nome} onChange={(e) => setCampo('nome', e.target.value)} placeholder="Cliente" />
        <Input value={form.telefone} onChange={(e) => setCampo('telefone', e.target.value)} placeholder="Telefone" disabled={!!cliente} />
        <Input value={form.cpf_cnpj} onChange={(e) => setCampo('cpf_cnpj', e.target.value)} placeholder="CPF / CNPJ" />
        <Input value={form.grupo_cota} onChange={(e) => setCampo('grupo_cota', e.target.value)} placeholder="Grupo / cota" />
        <Input value={form.cidade} onChange={(e) => setCampo('cidade', e.target.value)} placeholder="Cidade" />
        <Input value={form.estado} onChange={(e) => setCampo('estado', e.target.value)} placeholder="UF" maxLength={2} />
        <Input value={form.vendedor_responsavel} onChange={(e) => setCampo('vendedor_responsavel', e.target.value)} placeholder="Vendedor responsavel" />
        <Input value={form.origem_venda} onChange={(e) => setCampo('origem_venda', e.target.value)} placeholder="Origem da venda" />
        <Input value={form.credito_vendido} onChange={(e) => setCampo('credito_vendido', e.target.value)} placeholder="Credito vendido" inputMode="decimal" />
        <Input value={form.data_venda} onChange={(e) => setCampo('data_venda', e.target.value)} type="date" />
        <select
          value={form.etapa}
          onChange={(e) => setCampo('etapa', e.target.value)}
          className="h-10 rounded-lg border border-input bg-card/60 px-3 text-sm"
        >
          {FUNIL_ETAPAS.map((etapa) => <option key={etapa} value={etapa}>{FUNIL_LABELS[etapa]}</option>)}
        </select>
      </div>
      {erro && <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onFechar}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </Overlay>
  );
}

function ModalImportacao({ onFechar, onImportou }: { onFechar: () => void; onImportou: () => void }) {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const linhas = useMemo(() => parseImportacao(texto), [texto]);

  async function importar() {
    setImportando(true);
    setResultado(null);
    try {
      const resp = await api.post<{ resultado: { inseridos: number; atualizados: number; ignorados: { linha: number; motivo: string }[] } }>(
        '/clientes/controle/importar',
        { linhas },
      );
      const ignorados = resp.resultado.ignorados.length;
      setResultado(`${resp.resultado.inseridos} inserido(s), ${resp.resultado.atualizados} atualizado(s), ${ignorados} ignorado(s).`);
      onImportou();
    } catch (e) {
      setResultado(e instanceof Error ? e.message : 'Erro ao importar');
    } finally {
      setImportando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar} className="max-w-4xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Importar da planilha</h2>
          <p className="text-sm text-muted-foreground">Copie as linhas do Excel e cole aqui. Linhas sem telefone serao ignoradas.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar"><X className="h-4 w-4" /></Button>
      </div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="min-h-64 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary/40 focus:ring-2 focus:ring-ring/30"
        placeholder="QTD    ORIEGEM DA VENDA    VEND    CLIENTE    CPF    GRUPO-COTA    TELEFONE    CREDITO    CIDADE    UF"
      />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">{linhas.length} linha(s) reconhecida(s).</div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
          <Button onClick={importar} disabled={!linhas.length || importando}>
            {importando ? 'Importando...' : 'Importar'}
          </Button>
        </div>
      </div>
      {resultado && <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{resultado}</div>}
    </Overlay>
  );
}

export function ControleClientes() {
  const [clientes, setClientes] = useState<ControleCliente[]>([]);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [cidade, setCidade] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [modalCliente, setModalCliente] = useState<ControleCliente | null | undefined>();
  const [modalImportacao, setModalImportacao] = useState(false);

  function carregar() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (busca) params.set('q', busca);
    if (status) params.set('status', status);
    if (cidade) params.set('cidade', cidade);
    if (vendedor) params.set('vendedor', vendedor);
    if (inicio) params.set('inicio', inicio);
    if (fim) params.set('fim', fim);
    api.get<{ clientes: ControleCliente[] }>(`/clientes/controle?${params.toString()}`)
      .then((r) => setClientes(r.clientes))
      .catch(() => setClientes([]))
      .finally(() => setCarregando(false));
  }

  useEffect(() => carregar(), []);

  const cidades = useMemo(() => Array.from(new Set(clientes.map((c) => c.cidade).filter(Boolean) as string[])).sort(), [clientes]);
  const vendedores = useMemo(() => Array.from(new Set(clientes.map((c) => c.vendedor_responsavel).filter(Boolean) as string[])).sort(), [clientes]);
  const totalCredito = clientes.reduce((soma, c) => soma + (c.credito_vendido ?? c.credito_pretendido ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Gestao Central de Clientes</h1>
          <p className="text-sm text-muted-foreground">Consulte, adicione, edite informacoes e filtre dados comerciais.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setModalImportacao(true)}><Upload className="h-4 w-4" /> Importar</Button>
          <Button onClick={() => setModalCliente(null)}><UserPlus className="h-4 w-4" /> Cadastrar cliente</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Status do lead</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
              <option value="">Qualquer status</option>
              {FUNIL_ETAPAS.map((etapa) => <option key={etapa} value={etapa}>{FUNIL_LABELS[etapa]}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Cidade</span>
            <select value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
              <option value="">Qualquer cidade</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Vendedor responsavel</span>
            <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
              <option value="">Qualquer vendedor</option>
              {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Periodo venda inicio</span>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Periodo venda fim</span>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
          <div className="flex items-end gap-2">
            <Button className="flex-1" onClick={carregar}><Search className="h-4 w-4" /> Filtrar</Button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && carregar()} placeholder="Buscar cliente, telefone, CPF ou grupo..." />
          </div>
          <div className="text-sm text-muted-foreground">
            {clientes.length} cliente(s) · {brl(totalCredito)} em credito
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">CPF / contato</th>
                <th className="px-4 py-3 font-medium">Cidade / estado</th>
                <th className="px-4 py-3 font-medium">Grupo / cota</th>
                <th className="px-4 py-3 font-medium">Responsavel</th>
                <th className="px-4 py-3 font-medium">Credito vendido</th>
                <th className="px-4 py-3 font-medium">Fase do funil</th>
                <th className="px-4 py-3 font-medium">Cadastro</th>
                <th className="px-4 py-3 font-medium">Mensal</th>
                <th className="px-4 py-3 text-right font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="border-b border-border last:border-0 hover:bg-muted/35">
                  <td className="px-4 py-3">
                    <div className="font-medium">{vazio(cliente.nome)}</div>
                    <div className="text-xs text-muted-foreground">{vazio(cliente.origem_venda)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{vazio(cliente.cpf_cnpj)}</div>
                    <div className="text-xs text-muted-foreground">{cliente.telefone}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{vazio(cliente.cidade)}{cliente.estado ? `/${cliente.estado}` : ''}</td>
                  <td className="px-4 py-3">{vazio(cliente.grupo_cota)}</td>
                  <td className="px-4 py-3">{vazio(cliente.vendedor_responsavel)}</td>
                  <td className="px-4 py-3 font-medium">{brl(cliente.credito_vendido ?? cliente.credito_pretendido)}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{FUNIL_LABELS[cliente.etapa] ?? cliente.etapa}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{dataBR(cliente.data_venda ?? cliente.criado_em)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {statusMensal(cliente.controle_mensal).map((s, i) => (
                        <Badge key={`${s}-${i}`} variant={s === 'P' ? 'success' : s === 'C' ? 'destructive' : 'warning'}>{s}</Badge>
                      ))}
                      {!statusMensal(cliente.controle_mensal).length && <span className="text-muted-foreground">-</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => setModalCliente(cliente)} aria-label="Editar cliente">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!clientes.length && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    {carregando ? 'Carregando clientes...' : 'Nenhum cliente encontrado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalCliente !== undefined && (
        <ModalCliente
          cliente={modalCliente}
          onFechar={() => setModalCliente(undefined)}
          onSalvar={() => {
            setModalCliente(undefined);
            carregar();
          }}
        />
      )}
      {modalImportacao && (
        <ModalImportacao
          onFechar={() => setModalImportacao(false)}
          onImportou={carregar}
        />
      )}
    </div>
  );
}
