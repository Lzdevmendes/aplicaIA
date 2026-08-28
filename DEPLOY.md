# Deploy — AplicaAI

Roteiro para colocar no ar e o estado atual. O código está pronto e verificado;
o que resta é configuração em painéis (Google, Supabase, Vercel) e o prazo da
verificação OAuth do Google.

## Coordenadas do projeto

| Recurso | Valor |
|---|---|
| Repositório | `github.com/Lzdevmendes/AplicaIA` |
| Deploy (produção) | `https://aplica-ia.vercel.app` (projeto Vercel `aplica-ia`) |
| Supabase | `aplicaai` = `plxzmbvoelasnwotozxi`, região `sa-east-1` |
| Google Cloud | projeto `AplicaIA`, cliente OAuth "AplicaAI Web" |
| `GOOGLE_CLIENT_ID` | `986438591485-56742mlivuuo3h5j2qgr8vr8sbnt3n2b.apps.googleusercontent.com` (público) |

## Estado atual (checklist mestre)

- [x] **Fase 1 — Deploy na Vercel** com as env vars e `TOKEN_ENCRYPTION_KEY` de produção
- [ ] **Fase 2 — OAuth de produção** (Site URL + Redirect no Supabase + templates de e-mail)
- [x] **Fase 3a — Página de privacidade** (`/privacidade`, com declaração de Uso Limitado do Google)
- [ ] **Fase 3b — Submeter a verificação OAuth do Google** (2 a 8 semanas)
- [x] **Fase 4 — Envio automático por usuário** (quem conecta o Gmail em `/perfil` já anexa o CV; sem env var)
- [ ] **Fase 5 — Observabilidade** (Sentry nas rotas `/api/*`)
- [ ] **Fase 6 — Antes de abrir ao público** (apagar dev user, Leaked Password Protection)

Login não depende mais só do Google: `/login` tem link mágico e e-mail+senha
nativos do Supabase, além do Google (agora só com escopo de perfil/e-mail —
sem pedir `gmail.send`). Conectar o Gmail para envio automático (com CV
anexado) é um passo à parte, em `/perfil` — quem não conecta continua no
rascunho manual do Gmail. Enquanto a verificação OAuth (Fase 3b) não sai,
quem conecta o Gmail vê a tela "app não verificado" do Google e segue em
"Avançado" — não bloqueia mais o login de ninguém.

---

## Fase 1 — Deploy na Vercel ✅ feito

Referência do que foi cadastrado (Project Settings > Environment Variables).
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_SECRET` e
`TOKEN_ENCRYPTION_KEY` **nunca** com prefixo `NEXT_PUBLIC_` — não podem vazar
para o browser.

```
NEXT_PUBLIC_SUPABASE_URL=https://plxzmbvoelasnwotozxi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...          # Supabase > Settings > API Keys > secret key
GEMINI_API_KEY=...                               # aistudio.google.com > Get API key (grátis)
GOOGLE_CLIENT_ID=986438591485-...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
TOKEN_ENCRYPTION_KEY=...                          # openssl rand -base64 32 (NOVA em prod, ≠ da dev)
```

> ⚠️ A `TOKEN_ENCRYPTION_KEY` de produção é **diferente** da de dev, de
> propósito. Se ela mudar depois que houver refresh tokens gravados, eles ficam
> ilegíveis e os usuários precisam reconectar o Google. Guarde-a como segredo.

**Modelo de IA:** `gemini-2.5-flash` (tier gratuito, lê PDF e imagem
nativamente). Limite de requisições por minuto/dia — suficiente para você e os
primeiros usuários. A IA está isolada em `src/lib/ai/gemini.ts` e nas 3 rotas,
então trocar de tier/modelo é local.

## Fase 2 — OAuth de produção ⬜ pendente

O login passa pela Supabase, então o essencial é configurar lá.

1. **Supabase > Authentication > URL Configuration**
   (`.../project/plxzmbvoelasnwotozxi/auth/url-configuration`):
   - **Site URL:** `https://aplica-ia.vercel.app`
   - **Redirect URLs:** adicionar `https://aplica-ia.vercel.app/auth/callback`
     e `https://aplica-ia.vercel.app/auth/confirm` (manter os equivalentes
     `http://localhost:3000/...` do dev).
2. **Supabase > Authentication > Email Templates**: os templates de "Magic
   Link", "Confirm signup" e "Reset Password" precisam apontar para
   `/auth/confirm` (não para o `{{ .ConfirmationURL }}` padrão, que usa o
   `/verify` hospedado da própria Supabase e não bate com a sessão via cookie
   deste app). Trocar o link de cada template para:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/nova`
   (o de recuperação de senha usa `next=/auth/reset-password`).
3. **Supabase > Authentication > Providers > Email**: confirmar que o
   provider "Email" está habilitado e decidir o toggle "Confirm email".
4. **Google Cloud Console > Credentials > cliente "AplicaAI Web" > Authorized
   redirect URIs**: além do callback da Supabase já cadastrado
   (`https://plxzmbvoelasnwotozxi.supabase.co/auth/v1/callback`, usado só
   pelo login com Google), adicionar os dois callbacks do fluxo "Conectar
   Gmail" (que não passa pela Supabase):
   `https://aplica-ia.vercel.app/api/google/connect/callback` e
   `http://localhost:3000/api/google/connect/callback`.
5. **Testar:** abrir `https://aplica-ia.vercel.app/login` e entrar com Google,
   com link mágico e com e-mail+senha. O login com Google não pede mais
   `gmail.send` — só confirma sessão. Para o envio automático, testar
   "Conectar Gmail" em `/perfil` e confirmar no banco que o refresh token foi
   gravado (cifrado) em `google_accounts`.

## Fase 3 — Verificação OAuth do Google (o gargalo de prazo)

O escopo `gmail.send` é **sensitive** (não restricted — não exige a auditoria
CASA). Sem a verificação, o Google limita a 100 usuários em "modo de teste" e
mostra a tela de "app não verificado" — mas isso só afeta quem clica em
"Conectar Gmail" em `/perfil`, não mais o login (o login com Google só pede
`email profile`, que nunca precisou de verificação).

- **3a ✅** Página de privacidade pública em `/privacidade` (pré-requisito da
  submissão), com a declaração de que o uso dos dados das APIs do Google segue a
  Política de Dados do Usuário, incluindo Uso Limitado. Linkada no rodapé do
  login.
- **3b ⬜** Google Cloud Console > **Tela de permissão OAuth** > **Publicar app**
  e submeter a verificação. O Google vai pedir: URL da home
  (`https://aplica-ia.vercel.app`), URL da política
  (`https://aplica-ia.vercel.app/privacidade`), domínio autorizado, justificativa
  do escopo `gmail.send` e um vídeo curto do fluxo. Leva de 2 a 8 semanas e
  **não bloqueia mais ninguém** — quem quiser conectar o Gmail antes da
  verificação sair só passa pela tela de aviso do Google.

## Fase 4 — Envio automático por usuário ✅ feito

Não depende mais de env var nem de deploy. Assim que alguém clica "Conectar
Gmail" em `/perfil` e autoriza o `gmail.send`, `/nova` passa a enviar
automático (com o CV atual anexado) só para aquele usuário — quem não
conecta continua no rascunho manual de sempre. `NEXT_PUBLIC_GMAIL_SEND_MODE`
foi removido; não existe mais nas env vars do projeto.

## Fase 5 — Observabilidade ⬜ pendente

Criar projeto no Sentry (ou similar), pegar o **DSN** e plugar nas rotas
`/api/*`. É código — pode ser feito a qualquer momento.

## Fase 6 — Antes de abrir ao público ⬜ pendente

- [ ] Apagar o usuário de dev e o seed:
      `delete from auth.users where id = '33333333-3333-3333-3333-333333333333';`
      (as tabelas por usuário caem em cascade).
- [ ] Supabase > Auth > Providers: habilitar **Leaked Password Protection**
      (toggle grátis — **agora relevante de verdade**, já que o login por
      e-mail+senha existe; não é mais "baixa relevância porque o login é só
      Google").
- [ ] Confirmar o Site URL de produção (Fase 2) e revisar os Redirect URLs
      (inclui `/auth/confirm` e os dois callbacks de `/api/google/connect`).

---

## Banco

Schema, RLS e otimizações já aplicados no projeto Supabase, e a RLS testada com
forja entre usuários. Para reaplicar as migrations num projeto novo:

```bash
supabase link --project-ref SEU_REF
supabase db push
```

Regenerar os tipos após qualquer mudança de schema: `npm run db:types`.

## Verificação local

```bash
npm run dev        # localhost:3000
npm run build      # tem que passar sem warning
npm run typecheck
npm run lint
npm test           # vitest — helpers puros (MIME, deep link, retry, schemas, datas, pdf-links)

# Testes de RLS (isolamento entre usuários) — precisam de conexão ao Postgres:
psql "$DATABASE_URL" -f supabase/tests/rls_isolation.test.sql
# (ou, com o stack local: supabase start && psql da porta local)
```
