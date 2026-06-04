import { useEffect, useState } from 'react';
import { Send, MessageSquare, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.ts';
import type { Cliente } from '../lib/funil.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import { pode, PERMISSIONS } from '../lib/permissions.ts';
import { Card } from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { Button } from '../components/ui/button.tsx';
import { cn } from '../lib/cn.ts';

interface Mensagem { direcao: string; conteudo: string | null }

export function Chat() {
  const { user } = useAuth();
  const podeEnviar = pode(user, PERMISSIONS.CHAT_SEND);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');

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
