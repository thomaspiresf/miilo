# miilo

E-commerce mobile-first de **roupas e brinquedos infantis**.
Next.js 16 (App Router) + TypeScript + Tailwind CSS · Supabase · Mercado Pago
(Checkout Bricks) · Melhor Envio.

## Rodando localmente

```bash
npm install
npm run dev
```

Sem nenhuma variável de ambiente, o app sobe em **modo demonstração**:

- catálogo de exemplo (`lib/data/seed.ts`)
- frete estimado por uma tabela fixa
- pagamento simulado (cartão = aprovado, Pix = pendente com botão "simular")
- `/admin` liberado, com dados em memória (somem ao reiniciar)

## Ligando as integrações reais

Copie `.env.local.example` para `.env.local` e preencha.

### 1. Supabase (banco, auth, imagens)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. `Project Settings → API Keys`: copie a `URL`, a chave **publishable**
   (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY` e a chave **secret**
   (`sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY`.
3. `SQL Editor → New query`: cole e rode `supabase/schema.sql` inteiro (cria
   tabelas, RLS, a função `approve_order` e o bucket de imagens).
4. **Catálogo de exemplo** (opcional): com o servidor rodando,
   `curl -X POST "http://localhost:3000/api/dev/seed?token=$SEED_TOKEN"`
   para inserir os produtos de demonstração. Depois edite/apague pelo `/admin`.
### Login e admin

Quem tem acesso ao painel `/admin` é definido por **`ADMIN_EMAILS`** no
`.env.local` (lista separada por vírgula). Não há mais "virar admin por SQL" —
basta o e-mail estar na lista e a pessoa fazer login.

1. `Authentication → URL Configuration → Redirect URLs`: adicione
   `http://localhost:3000/**` (e a URL de produção com `/**`).
2. **Google** (1 clique, sem e-mail):
   - Google Cloud → *APIs & Services → Credentials → OAuth client ID → Web*
   - Authorized redirect URI: `https://<PROJETO>.supabase.co/auth/v1/callback`
   - Copie Client ID + Secret → Supabase `Authentication → Providers → Google`.
3. **E-mail + senha / link mágico** — já funcionam no código
   (`/conta/login` tem abas Entrar / Criar conta, "esqueci a senha" e link
   mágico). Só depende do envio de e-mail:
   - **Confirmação de e-mail** (`Authentication → Providers → Email → Confirm
     email`): se ligada, criar conta e redefinir senha exigem clicar num link
     no e-mail. O serviço embutido do Supabase é limitado (~2/hora) — configure
     um **SMTP** (ex.: Resend) em `Authentication → Emails` para funcionar de
     verdade. Para começar rápido você pode desligar a confirmação (menos
     seguro para clientes públicos).
   - **Entrar com senha** numa conta já confirmada não precisa de e-mail.
4. No `.env.local`, quando o login já funcionar, troque
   `ADMIN_DEV_BYPASS=true` por `false`. Aí `/admin` passa a exigir login com um
   e-mail de `ADMIN_EMAILS`.

> **Atalho de desenvolvimento:** com `ADMIN_DEV_BYPASS=true` o `/admin` abre sem
> login (só fora de produção). A chave `sb_secret_…` em
> `SUPABASE_SERVICE_ROLE_KEY` continua sendo necessária para gravar produtos e
> fazer upload de imagens.

### Cadastrar produtos

`/admin/produtos → Novo produto`: dados + variações (tamanho, cor, hex, preço,
estoque, peso). Salve, e na tela de edição adicione as **fotos** — o upload vai
direto para o bucket `product-images` do Supabase. Também dá para colar uma URL
externa.

### 2. Mercado Pago (pagamento)

1. [Painel de desenvolvedores](https://www.mercadopago.com.br/developers) → crie
   uma aplicação do tipo *Pagamentos online → CheckoutAPI/Bricks*.
2. Copie **Public Key** → `NEXT_PUBLIC_MP_PUBLIC_KEY` e **Access Token** →
   `MP_ACCESS_TOKEN` (use as credenciais de teste primeiro).
3. `MOCK_PAYMENTS=false`.
4. Configure o **Webhook**: URL `https://SEU_DOMINIO/api/webhooks/mercadopago`,
   evento `Pagamentos`. Copie a *assinatura secreta* → `MP_WEBHOOK_SECRET`.
5. O checkout transparente já habilita Pix, cartão de crédito e cartão de débito
   (ver `components/checkout/payment-brick.tsx`).

### 3. Melhor Envio (frete)

1. Conta em [melhorenvio.com.br](https://melhorenvio.com.br) (use
   `sandbox.melhorenvio.com.br` para testes).
2. `Configurações → Tokens` → gere um token → `MELHOR_ENVIO_TOKEN`.
3. `MELHOR_ENVIO_SANDBOX=true` enquanto testa, `MOCK_SHIPPING=false`.
4. Ajuste `STORE_ORIGIN_CEP` para o CEP de despacho da loja.

O MVP só **cota** o frete. A compra da etiqueta é um próximo passo.

## Estrutura

| Caminho | O quê |
|---|---|
| `app/(loja)/` | Loja: home, `/c/[slug]`, `/p/[slug]`, `/busca`, `/carrinho`, `/checkout`, `/pedido/[id]`, `/conta/*` |
| `app/admin/` | Painel: produtos, categorias, pedidos (protegido por `role = 'admin'`) |
| `app/api/` | `shipping/quote`, `checkout/create`, `payments/process`, `webhooks/mercadopago` |
| `lib/data/` | Camada de dados — usa Supabase quando configurado, senão o mock |
| `lib/mercadopago.ts` / `lib/melhorenvio.ts` | Clientes das integrações + fallback |
| `supabase/schema.sql` | Tabelas, RLS, função `approve_order`, bucket de imagens |

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Adicione todas as variáveis do `.env.local` no projeto.
3. Ajuste `NEXT_PUBLIC_SITE_URL` para o domínio de produção e atualize a URL do
   webhook no Mercado Pago e os Redirect URLs no Supabase.

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` — build de produção (roda o TypeScript)
- `npm run start` — servidor de produção
- `npm run lint` — ESLint
