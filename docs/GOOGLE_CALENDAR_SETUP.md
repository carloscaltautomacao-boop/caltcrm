# Configuração do Google Calendar

O Google Calendar é a agenda oficial da operação. O CRM sincroniza eventos nos dois sentidos e mantém
apenas um shadow/outbox local para vínculo com lead, handoff, status e mensagens agendadas do n8n.

## 1. Criar ou selecionar o projeto no Google Cloud

1. Acesse <https://console.cloud.google.com/>.
2. No seletor superior, crie um projeto ou selecione o projeto da CALT.
3. Em **APIs e serviços > Biblioteca**, procure **Google Calendar API**.
4. Abra a API e clique em **Ativar**.

## 2. Configurar o Google Auth Platform

1. Abra **Google Auth Platform > Branding** e clique em **Get Started**, se necessário.
2. Use:
   - Nome do app: `CALT CRM`
   - E-mail de suporte: o e-mail da operação
   - E-mail de contato do desenvolvedor: um e-mail monitorado
3. Em **Audience**:
   - Google Workspace próprio: prefira **Internal**, se todas as contas estiverem no mesmo domínio.
   - Gmail comum ou contas externas: use **External**.
4. Se estiver em **External / Testing**, adicione em **Test users** o e-mail que será conectado.
5. Em **Data Access**, adicione estes scopes:
   - `openid`
   - `.../auth/userinfo.email`
   - `https://www.googleapis.com/auth/calendar.events`

> Importante: em projeto External com status **Testing**, refresh tokens para escopos do Calendar expiram
> em 7 dias. Para operação permanente, publique o app em **Production** e conclua as verificações que o
> Google solicitar. Apps internos de um Google Workspace normalmente têm um caminho mais simples.

## 3. Criar o cliente OAuth

1. Abra **Google Auth Platform > Clients**.
2. Clique em **Create Client**.
3. Tipo: **Web application**.
4. Nome: `CALT CRM Web`.
5. Em **Authorized redirect URIs**, adicione exatamente:

   `https://SEU-DOMINIO.vercel.app/api/agenda/google/callback`

6. Para desenvolvimento local, opcionalmente adicione:

   `http://localhost:5173/api/agenda/google/callback`

7. Clique em **Create** e copie imediatamente o **Client ID** e o **Client Secret**.

O domínio, protocolo, porta, caminho e presença de barra final precisam coincidir exatamente. O projeto
usa a URL sem barra final.

## 4. Configurar a Vercel

Em **Project > Settings > Environment Variables**, adicione:

```env
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALENDAR_ID=primary
VITE_APP_URL=https://SEU-DOMINIO.vercel.app
```

- `primary` usa a agenda principal da conta conectada.
- Para usar uma agenda compartilhada, abra essa agenda no Google Calendar:
  **Configurações e compartilhamento > Integrar agenda > ID da agenda**. Cole esse ID em
  `GOOGLE_CALENDAR_ID` e dê à conta conectada permissão para alterar eventos.
- Não altere `JWT_SECRET` depois de conectar. Ele também protege a cifra do refresh token. Se precisar
  alterá-lo, desconecte e reconecte o Google Calendar.

Depois de salvar as variáveis, faça um novo deploy.

## 5. Conectar a conta

1. Entre no CRM como administrador.
2. Abra a aba **Agenda**.
3. Clique em **Conectar Google Calendar**.
4. Escolha a conta Google dona da agenda.
5. Autorize o acesso aos eventos.
6. Ao voltar ao CRM, confira o selo **Conectado** e o e-mail da conta.
7. Crie um evento de teste no CRM e confirme no Google Calendar.
8. Edite o mesmo evento diretamente no Google, volte ao CRM e clique em **Sincronizar**.

## 6. Comportamento esperado

- Evento criado/editado/excluído no CRM é refletido no Google.
- Evento criado ou alterado diretamente no Google aparece no CRM.
- Handoff cria automaticamente `Fechar com {lead}` no Google.
- Lembretes e compromissos vinculados ao chat continuam ligados ao lead.
- Mensagens agendadas continuam sendo enviadas pelo n8n; a tabela local permanece como fila técnica.
- Se o Google ficar indisponível, o evento fica no outbox e é reenviado na próxima sincronização.

## Problemas comuns

- `redirect_uri_mismatch`: a URI no cliente OAuth não é idêntica a
  `${VITE_APP_URL}/api/agenda/google/callback`.
- `access_denied`: a conta não está em **Test users**, ou uma política do Workspace bloqueou o app.
- Conecta e para após 7 dias: o app External ainda está em **Testing**.
- Não grava em agenda compartilhada: a conta conectada não tem permissão de edição ou o
  `GOOGLE_CALENDAR_ID` está incorreto.
- `invalid_grant`: o acesso foi revogado, o refresh token expirou ou a credencial OAuth mudou; desconecte
  e conecte novamente.
