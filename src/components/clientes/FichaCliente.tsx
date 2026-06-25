import { useState } from 'react';
import { CheckCircle2, Save, Star, X } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { FUNIL_ETAPAS, FUNIL_LABELS, type Cliente } from '../../lib/funil.ts';
import { useAuth } from '../../auth/AuthContext.tsx';
import { pode, PERMISSIONS } from '../../lib/permissions.ts';
import { Overlay } from '../ui/overlay.tsx';
import { Input } from '../ui/input.tsx';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';

const CLASSE_CAMPO =
  'flex h-10 w-full rounded-lg border border-input bg-card/60 px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';
const CLASSE_TEXTAREA =
  'flex w-full rounded-lg border border-input bg-card/60 px-3.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

export function FichaCliente({
  cliente,
  onFechar,
  onAtualizado,
}: {
  cliente: Cliente;
  onFechar: () => void;
  onAtualizado: (cliente: Cliente) => void;
}) {
  const { user } = useAuth();
  const editavel = pode(user, PERMISSIONS.CLIENTES_EDIT);
  const [form, setForm] = useState<Cliente>({ ...cliente, tags: cliente.tags ?? [] });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  function set<K extends keyof Cliente>(campo: K, valor: Cliente[K]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setSalvo(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      const corpo = {
        nome: vazioParaNull(form.nome),
        cidade: vazioParaNull(form.cidade),
        estado: vazioParaNull(form.estado)?.toUpperCase(),
        email: vazioParaNull(form.email),
        cpf_cnpj: vazioParaNull(form.cpf_cnpj),
        data_nascimento: vazioParaNull(form.data_nascimento),
        estado_civil: vazioParaNull(form.estado_civil),
        profissao: vazioParaNull(form.profissao),
        renda_aproximada: numeroOuNull(form.renda_aproximada),
        recebe_bolsa_familia: form.recebe_bolsa_familia,
        entende_consorcio: form.entende_consorcio,
        origem: vazioParaNull(form.origem),
        melhor_horario_contato: vazioParaNull(form.melhor_horario_contato),
        etapa: form.etapa,
        tags: form.tags ?? [],
        vip: form.vip,
        pretensao_bem: vazioParaNull(form.pretensao_bem),
        tipo_bem: vazioParaNull(form.tipo_bem),
        credito_pretendido: numeroOuNull(form.credito_pretendido),
        urgencia: vazioParaNull(form.urgencia),
        valor_parcela_ideal: numeroOuNull(form.valor_parcela_ideal),
        forma_contemplacao: vazioParaNull(form.forma_contemplacao),
        interesse_lance: form.interesse_lance,
        valor_lance: numeroOuNull(form.valor_lance),
        prazo_desejado: numeroOuNull(form.prazo_desejado),
        observacoes: vazioParaNull(form.observacoes),
      };
      await api.patch(`/clientes/${form.id}`, corpo);
      const resposta = await api.get<{ cliente: Cliente }>(`/clientes/${form.id}`);
      setForm(resposta.cliente);
      onAtualizado(resposta.cliente);
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a ficha.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar} className="max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{form.nome || form.telefone}</h2>
            {form.vip && <Badge variant="gold"><Star className="h-3 w-3 fill-current" /> VIP</Badge>}
            {form.qualificacao_completa && <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Qualificado</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{form.telefone}</p>
        </div>
        <button onClick={onFechar} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Secao titulo="Dados pessoais e contato">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome completo"><Input disabled={!editavel} value={form.nome ?? ''} onChange={(e) => set('nome', e.target.value)} /></Campo>
            <Campo label="E-mail"><Input disabled={!editavel} type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Campo>
            <Campo label="Cidade"><Input disabled={!editavel} value={form.cidade ?? ''} onChange={(e) => set('cidade', e.target.value)} /></Campo>
            <Campo label="UF"><Input disabled={!editavel} maxLength={2} value={form.estado ?? ''} onChange={(e) => set('estado', e.target.value)} /></Campo>
            <Campo label="CPF/CNPJ"><Input disabled={!editavel} value={form.cpf_cnpj ?? ''} onChange={(e) => set('cpf_cnpj', e.target.value)} /></Campo>
            <Campo label="Data de nascimento"><Input disabled={!editavel} type="date" value={form.data_nascimento ?? ''} onChange={(e) => set('data_nascimento', e.target.value)} /></Campo>
            <Campo label="Estado civil"><Input disabled={!editavel} value={form.estado_civil ?? ''} onChange={(e) => set('estado_civil', e.target.value)} /></Campo>
            <Campo label="Melhor horário para contato"><Input disabled={!editavel} value={form.melhor_horario_contato ?? ''} onChange={(e) => set('melhor_horario_contato', e.target.value)} /></Campo>
          </div>
        </Secao>

        <Secao titulo="Perfil financeiro">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Profissão"><Input disabled={!editavel} value={form.profissao ?? ''} onChange={(e) => set('profissao', e.target.value)} /></Campo>
            <Campo label="Renda aproximada"><Input disabled={!editavel} type="number" min="0" value={form.renda_aproximada ?? ''} onChange={(e) => set('renda_aproximada', valorInputNumero(e.target.value))} /></Campo>
            <Campo label="Recebe Bolsa Família">
              <SelectBoolean disabled={!editavel} value={form.recebe_bolsa_familia} onChange={(v) => set('recebe_bolsa_familia', v)} />
            </Campo>
            <Campo label="Já entende consórcio">
              <SelectBoolean disabled={!editavel} value={form.entende_consorcio} onChange={(v) => set('entende_consorcio', v)} />
            </Campo>
          </div>
        </Secao>

        <Secao titulo="Interesse e simulação">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Bem pretendido">
              <select disabled={!editavel} value={form.pretensao_bem ?? ''} onChange={(e) => set('pretensao_bem', e.target.value)} className={CLASSE_CAMPO}>
                <option value="">Não informado</option><option value="carro">Automóvel</option><option value="imovel">Imóvel</option><option value="solar">Energia solar</option>
              </select>
            </Campo>
            <Campo label="Tipo, marca ou modelo"><Input disabled={!editavel} value={form.tipo_bem ?? ''} onChange={(e) => set('tipo_bem', e.target.value)} /></Campo>
            <Campo label="Crédito pretendido"><Input disabled={!editavel} type="number" min="0" value={form.credito_pretendido ?? ''} onChange={(e) => set('credito_pretendido', valorInputNumero(e.target.value))} /></Campo>
            <Campo label="Parcela ideal"><Input disabled={!editavel} type="number" min="0" value={form.valor_parcela_ideal ?? ''} onChange={(e) => set('valor_parcela_ideal', valorInputNumero(e.target.value))} /></Campo>
            <Campo label="Urgência">
              <select disabled={!editavel} value={form.urgencia ?? ''} onChange={(e) => set('urgencia', e.target.value)} className={CLASSE_CAMPO}>
                <option value="">Não informado</option><option value="imediato">Imediato</option><option value="programado">Programado</option>
              </select>
            </Campo>
            <Campo label="Forma de contemplação">
              <select disabled={!editavel} value={form.forma_contemplacao ?? ''} onChange={(e) => set('forma_contemplacao', e.target.value)} className={CLASSE_CAMPO}>
                <option value="">Não informado</option><option value="sorteio">Aguardar sorteio</option><option value="lance">Pretende ofertar lance</option><option value="indefinido">Ainda não decidiu</option>
              </select>
            </Campo>
            <Campo label="Tem interesse em lance">
              <SelectBoolean disabled={!editavel} value={form.interesse_lance} onChange={(v) => set('interesse_lance', v)} />
            </Campo>
            <Campo label="Valor disponível para lance"><Input disabled={!editavel} type="number" min="0" value={form.valor_lance ?? ''} onChange={(e) => set('valor_lance', valorInputNumero(e.target.value))} /></Campo>
            <Campo label="Prazo desejado (meses)"><Input disabled={!editavel} type="number" min="1" value={form.prazo_desejado ?? ''} onChange={(e) => set('prazo_desejado', valorInputNumero(e.target.value))} /></Campo>
          </div>
        </Secao>

        <Secao titulo="Gestão comercial">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Etapa do funil">
              <select disabled={!editavel} value={form.etapa} onChange={(e) => set('etapa', e.target.value)} className={CLASSE_CAMPO}>
                {FUNIL_ETAPAS.map((etapa) => <option key={etapa} value={etapa}>{FUNIL_LABELS[etapa]}</option>)}
              </select>
            </Campo>
            <Campo label="Origem"><Input disabled={!editavel} value={form.origem ?? ''} onChange={(e) => set('origem', e.target.value)} /></Campo>
            <Campo label="Etiquetas (separadas por vírgula)">
              <Input disabled={!editavel} value={(form.tags ?? []).join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
            </Campo>
            <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2.5 text-sm">
              <input disabled={!editavel} type="checkbox" checked={form.vip} onChange={(e) => set('vip', e.target.checked)} className="accent-primary" />
              Marcar como cliente VIP
            </label>
          </div>
        </Secao>
      </div>

      <div className="mt-5">
        <Campo label="Observações gerais">
          <textarea
            disabled={!editavel}
            rows={5}
            value={form.observacoes ?? ''}
            onChange={(e) => set('observacoes', e.target.value)}
            placeholder="Registre aqui qualquer informação relevante que não tenha um campo específico."
            className={CLASSE_TEXTAREA}
          />
        </Campo>
      </div>

      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
      <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">
        {salvo && <span className="mr-auto inline-flex items-center gap-1 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Ficha atualizada</span>}
        <Button variant="outline" onClick={onFechar}>Fechar</Button>
        {editavel && <Button onClick={salvar} disabled={salvando}><Save className="h-4 w-4" /> {salvando ? 'Salvando...' : 'Salvar ficha'}</Button>}
      </div>
    </Overlay>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-muted/20 p-4"><h3 className="mb-3 text-sm font-semibold">{titulo}</h3>{children}</section>;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function SelectBoolean({ value, onChange, disabled }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void; disabled: boolean }) {
  return (
    <select disabled={disabled} value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')} className={CLASSE_CAMPO}>
      <option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option>
    </select>
  );
}

function vazioParaNull(valor: string | null | undefined): string | null {
  const texto = String(valor ?? '').trim();
  return texto || null;
}

function valorInputNumero(valor: string): number | null {
  return valor === '' ? null : Number(valor);
}

function numeroOuNull(valor: number | null | undefined): number | null {
  return valor == null || Number.isNaN(Number(valor)) ? null : Number(valor);
}
