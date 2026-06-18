import { useEffect, useRef, useState } from 'react';
import {
  Send, MessageSquare, ArrowLeft, Paperclip, FileText, Image, Camera, Mic, QrCode, Zap, X, Plus, Trash2,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import type { Cliente } from '../lib/funil.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import { pode, PERMISSIONS } from '../lib/permissions.ts';
import { Card } from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { Button } from '../components/ui/button.tsx';
import { AcoesLead } from '../components/chat/AcoesLead.tsx';
import { cn } from '../lib/cn.ts';
import { Overlay } from '../components/ui/overlay.tsx';

interface Mensagem { direcao: string; conteudo: string | null }
interface RespostaRapida { id: string; titulo: string; texto: string }

const CLASSE_TEXTAREA =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function Chat() {
  const { user } = useAuth();
  const podeEnviar = pode(user, PERMISSIONS.CHAT_SEND);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [enviandoExtra, setEnviandoExtra] = useState(false);

  useEffect(() => {
    api.get<{ clientes: Cliente[] }>('/clientes').then((r) => setClientes(r.clientes)).catch(() => {});
  }, []);

  function abrir(id: string) {
    setSelecionado(id);
    api.get<{ mensagens: Mensagem[] }>(`/clientes/${id}`).then((r) => setMensagens(r.mensagens)).catch(() => setMensagens([]));
  }

  async function enviar() {
    if (!texto.trim() || !selecionado) return;
    const t = texto;
    setTexto('');
    setMensagens((m) => [...m, { direcao: 'out', conteudo: t }]);
    await api.post(`/clientes/${selecionado}/mensagem`, { texto: t }).catch(() => {});
  }

  async function enviarTextoRapido(t: string) {
    if (!t.trim() || !selecionado) return;
    setMensagens((m) => [...m, { direcao: 'out', conteudo: t }]);
    await api.post(`/clientes/${selecionado}/mensagem`, { texto: t });
  }

  async function enviarArquivo(file: File, tipo: string, caption = '') {
    if (!selecionado) return;
    setEnviandoExtra(true);
    try {
      const mediaBase64 = await arquivoParaBase64(file);
      await api.post(`/clientes/${selecionado}/midia`, {
        mediaBase64,
        mimetype: file.type || 'application/octet-stream',
        fileName: file.name || `arquivo-${Date.now()}`,
        caption,
        tipo,
      });
      setMensagens((m) => [...m, { direcao: 'out', conteudo: caption || file.name || 'Arquivo enviado' }]);
    } finally {
      setEnviandoExtra(false);
    }
  }

  const contato = clientes.find((c) => c.id === selecionado);

  return (
    <div className="flex h-[calc(100dvh-11rem)] gap-4 lg:h-[calc(100dvh-7rem)]">
      {/* Lista de conversas — full no mobile; some quando abre um contato */}
      <Card
        className={cn(
          'w-full flex-col overflow-hidden lg:flex lg:w-72 lg:shrink-0',
          selecionado ? 'hidden lg:flex' : 'flex',
        )}
      >
        <div className="border-b border-border px-4 py-3 text-sm font-medium">Conversas</div>
        <div className="flex-1 overflow-y-auto">
          {clientes.map((c) => (
            <button
              key={c.id} onClick={() => abrir(c.id)}
              className={cn(
                'flex w-full flex-col items-start border-b border-border px-4 py-3 text-left text-sm transition-colors hover:bg-accent',
                selecionado === c.id && 'bg-accent',
              )}
            >
              <span className="font-medium">{c.nome || c.telefone}</span>
              <span className="text-xs text-muted-foreground">{c.cidade || '—'}</span>
            </button>
          ))}
          {clientes.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sem conversas.</div>}
        </div>
      </Card>

      {/* Thread — full no mobile quando há contato; sempre visível no desktop */}
      <Card
        className={cn(
          'flex-1 flex-col overflow-hidden lg:flex',
          selecionado ? 'flex' : 'hidden lg:flex',
        )}
      >
        {!selecionado ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <span className="text-sm">Selecione um contato</span>
          </div>
        ) : (
          <>
            {/* Cabeçalho do thread com botão voltar (só mobile) */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <button
                onClick={() => setSelecionado(null)}
                className="rounded-md p-1.5 hover:bg-accent lg:hidden"
                aria-label="Voltar para conversas"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{contato?.nome || contato?.telefone}</div>
                <div className="truncate text-xs text-muted-foreground">{contato?.cidade || '—'}</div>
              </div>
              <div className="ml-auto shrink-0">
                <AcoesLead clienteId={selecionado} nome={contato?.nome || contato?.telefone || 'lead'} />
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {mensagens.map((m, i) => (
                <div key={i} className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm sm:max-w-[70%]',
                  m.direcao === 'in'
                    ? 'bg-muted text-foreground'
                    : 'ml-auto bg-primary text-primary-foreground',
                )}>
                  {m.conteudo}
                </div>
              ))}
              {mensagens.length === 0 && <div className="text-center text-sm text-muted-foreground">Sem mensagens ainda.</div>}
            </div>
            {podeEnviar && (
              <div className="flex gap-2 border-t border-border p-3">
                <MenuAnexos
                  disabled={enviandoExtra}
                  onArquivo={enviarArquivo}
                  onPix={enviarTextoRapido}
                  onResposta={(t) => setTexto((atual) => atual ? `${atual}\n${t}` : t)}
                />
                <Input
                  value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()}
                  placeholder="Assumir o atendimento e responder..."
                />
                <Button size="icon" onClick={enviar} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

function MenuAnexos({
  disabled, onArquivo, onPix, onResposta,
}: {
  disabled: boolean;
  onArquivo: (file: File, tipo: string, caption?: string) => Promise<void>;
  onPix: (texto: string) => Promise<void>;
  onResposta: (texto: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [modal, setModal] = useState<null | 'pix' | 'audio' | 'respostas'>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>, tipo: string) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setAberto(false);
    if (file) await onArquivo(file, tipo);
  }

  const itens = [
    { label: 'Documento', Icon: FileText, cor: 'text-violet-500', onClick: () => docRef.current?.click() },
    { label: 'Fotos e videos', Icon: Image, cor: 'text-blue-500', onClick: () => mediaRef.current?.click() },
    { label: 'Camera', Icon: Camera, cor: 'text-pink-500', onClick: () => cameraRef.current?.click() },
    { label: 'Audio', Icon: Mic, cor: 'text-orange-500', onClick: () => setModal('audio') },
    { label: 'Pix', Icon: QrCode, cor: 'text-emerald-500', onClick: () => setModal('pix') },
    { label: 'Resposta rapida', Icon: Zap, cor: 'text-amber-500', onClick: () => setModal('respostas') },
  ];

  return (
    <div className="relative">
      <input ref={docRef} type="file" className="hidden" onChange={(e) => escolher(e, 'documento')} />
      <input ref={mediaRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => escolher(e, 'midia')} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => escolher(e, 'camera')} />
      <Button
        type="button" variant="outline" size="icon" disabled={disabled}
        onClick={() => setAberto((v) => !v)} aria-label="Anexar"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setAberto(false)} />
          <div className="absolute bottom-12 left-0 z-30 w-56 rounded-lg border border-border bg-card p-1.5 shadow-xl">
            {itens.map(({ label, Icon, cor, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={() => { setAberto(false); onClick(); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <Icon className={cn('h-4 w-4', cor)} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {modal === 'pix' && <ModalPix onFechar={() => setModal(null)} onEnviar={onPix} />}
      {modal === 'audio' && <ModalAudio onFechar={() => setModal(null)} onEnviar={(f) => onArquivo(f, 'audio')} />}
      {modal === 'respostas' && <ModalRespostas onFechar={() => setModal(null)} onUsar={onResposta} />}
    </div>
  );
}

function CabecalhoModal({ titulo, onFechar }: { titulo: string; onFechar: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold">{titulo}</h3>
      <button onClick={onFechar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
    </div>
  );
}

function ModalPix({ onFechar, onEnviar }: { onFechar: () => void; onEnviar: (texto: string) => Promise<void> }) {
  const [pix, setPix] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get<{ pix_texto: string }>('/clientes/pix').then((r) => setPix(r.pix_texto || '')).catch(() => {});
  }, []);

  async function salvar() {
    setSalvando(true);
    setErro('');
    try {
      await api.put('/clientes/pix', { pix_texto: pix.trim() });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar PIX.');
    } finally {
      setSalvando(false);
    }
  }

  async function enviar() {
    if (!pix.trim()) { setErro('Cadastre o texto do PIX.'); return; }
    await salvar();
    await onEnviar(pix.trim());
    onFechar();
  }

  return (
    <Overlay onFechar={onFechar}>
      <CabecalhoModal titulo="Pix" onFechar={onFechar} />
      <div className="mt-3 space-y-3">
        <textarea
          value={pix} onChange={(e) => setPix(e.target.value)} rows={5}
          placeholder="Cole aqui a chave PIX ou o copia e cola que sera enviado ao lead." className={CLASSE_TEXTAREA}
        />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
          <Button onClick={enviar} disabled={!pix.trim() || salvando}>Enviar PIX</Button>
        </div>
      </div>
    </Overlay>
  );
}

function ModalAudio({ onFechar, onEnviar }: { onFechar: () => void; onEnviar: (file: File) => Promise<void> }) {
  const [gravando, setGravando] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [erro, setErro] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function iniciar() {
    setErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        setAudio(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setGravando(true);
    } catch {
      setErro('Nao foi possivel acessar o microfone. Voce tambem pode anexar um audio pronto.');
    }
  }

  function parar() {
    recorderRef.current?.stop();
    setGravando(false);
  }

  async function enviarGravacao() {
    if (!audio) return;
    const file = new File([audio], `audio-${Date.now()}.webm`, { type: audio.type || 'audio/webm' });
    await onEnviar(file);
    onFechar();
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      await onEnviar(file);
      onFechar();
    }
  }

  return (
    <Overlay onFechar={onFechar}>
      <CabecalhoModal titulo="Audio" onFechar={onFechar} />
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={escolher} />
      <div className="mt-3 space-y-3">
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Grave um audio pelo navegador ou envie um arquivo de audio salvo no aparelho.
        </div>
        {audio && <audio controls src={URL.createObjectURL(audio)} className="w-full" />}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>Anexar audio</Button>
          {!gravando ? (
            <Button onClick={iniciar}>Gravar</Button>
          ) : (
            <Button variant="outline" onClick={parar}>Parar</Button>
          )}
          <Button onClick={enviarGravacao} disabled={!audio || gravando}>Enviar</Button>
        </div>
      </div>
    </Overlay>
  );
}

function ModalRespostas({ onFechar, onUsar }: { onFechar: () => void; onUsar: (texto: string) => void }) {
  const [respostas, setRespostas] = useState<RespostaRapida[]>([]);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');

  function carregar() {
    api.get<{ respostas: RespostaRapida[] }>('/clientes/respostas-rapidas')
      .then((r) => setRespostas(r.respostas))
      .catch(() => {});
  }
  useEffect(carregar, []);

  async function criar() {
    if (!titulo.trim() || !texto.trim()) { setErro('Informe titulo e texto.'); return; }
    setErro('');
    await api.post('/clientes/respostas-rapidas', { titulo: titulo.trim(), texto: texto.trim() });
    setTitulo('');
    setTexto('');
    carregar();
  }

  async function excluir(id: string) {
    await api.del(`/clientes/respostas-rapidas/${id}`).catch(() => {});
    carregar();
  }

  return (
    <Overlay onFechar={onFechar}>
      <CabecalhoModal titulo="Respostas rapidas" onFechar={onFechar} />
      <div className="mt-3 space-y-3">
        <div className="space-y-2">
          {respostas.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">Nenhuma resposta salva.</p>}
          {respostas.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => { onUsar(r.texto); onFechar(); }}
                >
                  <div className="truncate text-sm font-medium">{r.titulo}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.texto}</div>
                </button>
                <button onClick={() => excluir(r.id)} className="text-muted-foreground hover:text-destructive" aria-label="Excluir">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-sm font-medium">Criar nova</div>
          <div className="space-y-2">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Titulo curto" />
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} className={CLASSE_TEXTAREA} placeholder="Texto da resposta..." />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <div className="flex justify-end">
              <Button onClick={criar}><Plus className="h-4 w-4" /> Salvar resposta</Button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
