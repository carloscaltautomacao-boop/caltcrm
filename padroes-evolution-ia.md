# Evolution API + pipeline de IA (padrão replicável)

Como a mensagem entra, é processada e respondida. Vale pra qualquer nicho — só mudam intents, prompts e tools.

## Webhook do Evolution

- Endpoint único de entrada: `POST /api/webhook/evolution`.
- **Sem auth** no painel — o Evolution chama com `apikey` próprio.
- Configurar o webhook do Evolution para `${VITE_APP_URL}/api/webhook/evolution`. Reconfigurável pela aba
  Configurações do painel.
- Cuidado com `remoteJid`: contas Business às vezes trazem `@lid` no `remoteJid` e o número real num campo
  alternativo terminado em `@s.whatsapp.net` — prefira o alternativo quando existir.

## Tipos de mensagem suportados

| Tipo     | Como vem                                              | Processamento                               |
| -------- | ----------------------------------------------------- | ------------------------------------------- |
| Texto    | `msg.conversation` / `msg.extendedTextMessage.text`   | Vai direto pro extrator                     |
| Áudio    | `audioMessage` (base64)                               | Transcrição (Whisper) → texto → extrator    |
| Imagem   | `imageMessage` (base64)                               | Visão (GPT-4o) → texto estruturado → extrator |
| Planilha | `documentMessage` `.xlsx/.xls` (base64)               | lib `xlsx` → linhas → string                |
| CSV      | `documentMessage` (base64)                            | decode UTF-8 (limite ~4000 chars) → string  |
| PDF      | `documentMessage`                                     | declarar tipo; implementar extração conforme nicho |

Centralize a normalização de mídia em `api/services/media.ts`. Independente do tipo, o pipeline sempre
converte a entrada em **texto** antes do extrator.

## Padrão de duas chamadas de IA (determinismo + qualidade)

1. **Extrator** — chamada SEPARADA, em modo JSON estrito, `temperature: 0`. Devolve `intent` + termos/dados
   estruturados. Razão: determinismo e impedir que o modelo "responda como chatbot" na fase de
   interpretação. Modelo recomendado: bom em seguir schema (ex.: `gpt-4.1`).
2. **Agente final** — chamada COM tools (function calling) que executam as ações do domínio
   (criar/alterar registros, fechar venda/reserva, cadastrar cliente, etc.).

Toda chamada passa pelo wrapper `api/lib/ai.ts`, que registra custo em `ai_usage` (tokens, USD, calls, por
modelo e por origem).

### Modelos por uso (ajuste por custo/nicho)

| Uso                          | Modelo sugerido | Por quê                                  |
| ---------------------------- | --------------- | ---------------------------------------- |
| Extrator (intent + dados)    | `gpt-4.1`       | JSON strict + temp 0, contexto multi-msg |
| Resposta final (com tools)   | `gpt-4.1`       | Tool calling confiável                   |
| Visão (imagem)               | `gpt-4o`        | Multimodal                               |
| Transcrição de áudio         | `whisper-1`     | PT-BR                                    |

## Estado de conversa / ação pendente

- Modele **sessão** = ciclo de atendimento de um contato (1 ativa por contato), com timeout configurável.
- Guarde `acao_pendente` (JSONB) na sessão para confirmações em curso (ex.: "confirma fechar?", escolher
  entre múltiplos matches). É consumido na próxima mensagem do contato e limpo em seguida.
- **Onboarding**: se faltar dado obrigatório do contato (ex.: nome), a triagem fica bloqueada até obtê-lo,
  com parser estrito (rejeita números/frases longas onde se espera um nome).

## Busca fuzzy (quando o nicho tem catálogo)

- Use `pg_trgm` + `unaccent`. Combine estratégias (similaridade lexical + match por keywords AND) e fique
  com o maior score, para casar "creatina dux 300g" com "CREATINA DUX 300 GRAMAS".
- Defina um teto generoso de resultados por termo quando o usuário pede "todas as variações de X".

## Saídas para o WhatsApp

- Envio de texto, imagem inline e documento via serviço dedicado (`api/services/whatsapp.ts`:
  `sendWhatsAppDocument`, `sendWhatsAppImage`).
- Geração de **PDF** (PDFKit) e/ou **imagem PNG** (Satori + resvg) de documentos (orçamento/reserva/etc.)
  quando o nicho pedir, com paginação para listas longas.
- Comandos slash utilitários (`/ajuda`, `/status`) podem ser pré-handlers antes do extrator.
