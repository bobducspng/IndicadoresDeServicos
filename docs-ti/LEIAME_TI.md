# Indicadores de Serviços — guia para a TI (publicação no Google Cloud Run)

Este pacote contém o código-fonte completo do site **Indicadores de Serviços** (Vena), pronto para ser
publicado no Google Cloud Run, mais este guia. Hoje o site roda em uma VM Oracle com túnel ngrok; a VM foi
perdida (fim do período de teste da Oracle), por isso a migração.

> O que foi validado antes do envio: `pnpm check` (tipos), `pnpm test` (54 testes) e `pnpm build` passam; o
> servidor sobe e responde com **somente** as dependências de produção; as migrações rodam num banco MySQL/MariaDB
> **vazio** usando conexão por socket Unix (o mesmo formato do Cloud SQL); o cadastro inicial de administradores
> funciona. **Não foi possível construir a imagem Docker nem publicar no Google Cloud a partir do ambiente onde o
> pacote foi preparado** — o `Dockerfile` e o fluxo de deploy seguem o que foi testado passo a passo, mas o primeiro
> build/deploy deve ser acompanhado.

## 1. Visão geral

| Item | Descrição |
|---|---|
| Tipo | Aplicação web única (site + API no mesmo processo Node), 1 container |
| Front-end | React 19 + Vite 7 + Tailwind 4 (SPA); build em `dist/public` |
| Back-end | Node 22 + Express 4 + tRPC 11; build em `dist/index.js` (esbuild) |
| Banco | MySQL 8 via Drizzle ORM (driver mysql2) |
| Login | Google OAuth 2.0 (PKCE) + lista de e-mails autorizados na tabela `allowed_users`; sessão em cookie JWT (sem estado no servidor) |
| Porta | Lê a variável `PORT` (Cloud Run injeta 8080) |
| Gerenciador de pacotes | pnpm 10.4.1 (via corepack); Node 22 |

O servidor é **sem estado** (sessão no cookie assinado, dados no banco). Pode rodar em várias instâncias do Cloud Run
sem afinidade de sessão, desde que todas usem o mesmo `SESSION_SECRET`.

### Como o painel obtém os dados (importante)
- **Indicadores (clientes, serviços, vigências):** o **navegador do usuário** lê abas de uma planilha Google
  (Painel de Indicadores) diretamente. A planilha é alimentada por Apps Script que sincroniza o Pipefy. Nada disso
  passa pelo servidor nem depende de onde o site está hospedado.
- **Colaboradores x clientes ("Por Colaborador"):** o **servidor** chama um Web App do Apps Script
  (`COLABORADORES_API_URL`, protegido por chave `COLABORADORES_API_KEY`) com cache de 5 minutos. O servidor precisa de
  saída HTTPS para `script.google.com` / `script.googleusercontent.com`. Sem essas variáveis o site mostra dados de exemplo.
- **Pipefy:** o site **não** fala com o Pipefy. Quem fala é o Apps Script (projeto "integracao_cadastro_clientes", que
  guarda o token do Pipefy e os gatilhos de sincronização). **Esse Apps Script não muda com a migração.**

## 2. Estrutura do repositório

```
client/            Front-end React (src/pages: Home, ColaboradorPage; src/lib: regras de dados)
server/            API (tRPC em routers.ts), autenticação Google (_core/oauth.ts), banco (db.ts),
                   colaboradores (colaboradores.ts) e fotos (colaboradoresFotos*.ts), testes *.test.ts
shared/            Código compartilhado (contrato de colaboradores)
drizzle/           Esquema (schema.ts) e migrações SQL (0000…0005) + meta/_journal.json
scripts/           run-production-migrations.mjs, ensure-role-enum.mjs
Dockerfile         Imagem do site (stage "runtime") e do Job de migrações (stage "migrate")
.github/workflows/ deploy-cloud-run.yml (novo, push no main) e deploy-vm.yml (antigo, só manual)
docs-ti/           Este guia e o SQL de cadastro inicial de administradores
MANUAL_INDICADORES.md  Manual funcional completo do painel (telas, regras)
DEPLOY_VM.md, CONTINUAR_COM_OUTRA_IA.md, PORTABLE_PACKAGE_MANIFEST.md  Material do ambiente antigo (Oracle/ngrok): só referência histórica
```

## 3. Variáveis de ambiente e segredos

| Nome | Tipo | Observação |
|---|---|---|
| `NODE_ENV` | variável | `production` |
| `PORT` | automática | Cloud Run define (8080) |
| `DATABASE_URL` | **segredo** | ver seção 4 (formato com socket do Cloud SQL) |
| `SESSION_SECRET` | **segredo** | texto aleatório longo (ex.: `openssl rand -base64 48`). Trocar desloga todos |
| `GOOGLE_CLIENT_ID` | variável | do cliente OAuth (seção 6) |
| `GOOGLE_CLIENT_SECRET` | **segredo** | do cliente OAuth |
| `GOOGLE_REDIRECT_URI` | variável | `https://URL-DO-SERVICO/api/auth/google/callback` |
| `GOOGLE_EXTRA_REDIRECT_URIS` | variável | mesma URL acima (lista separada por vírgula; só aceita `https://…/api/auth/google/callback`). **Necessária**: o código só aceita callbacks de uma lista permitida |
| `COLABORADORES_API_URL` | variável | URL do Web App do Apps Script (`…/exec`) |
| `COLABORADORES_API_KEY` | **segredo** | chave definida no Apps Script (propriedade `COLABORADORES_API_KEY`) |

Segredos vão no **Secret Manager** (nomes usados pelo workflow: `database-url`, `session-secret`,
`google-client-secret`, `colaboradores-api-key`). Existem outras variáveis opcionais no código herdadas de uma
plataforma anterior (`BUILT_IN_FORGE_*`, `OWNER_OPEN_ID`, `GOOGLE_AUTH_URI`, `GOOGLE_TOKEN_URI`): **não são necessárias**.

Os valores de `COLABORADORES_API_URL` e `COLABORADORES_API_KEY` atuais estão no `.env` do servidor antigo (perdido
com a VM). A chave pode ser **gerada de novo** no Apps Script (função `gerarChaveApi`) e a URL do Web App fica em
Implantar > Gerenciar implantações do projeto "integracao_cadastro_clientes" — quem mantém o Apps Script (Ederlei
Pereira) fornece os dois.

## 4. Banco de dados — recomendações

**Modelo (pequeno):** 3 tabelas.
- `users`: quem já fez login (id, openId, nome, e-mail, URL da foto do Google, perfil, datas).
- `allowed_users`: **lista de e-mails autorizados** a entrar, com perfil (`user`/`admin`/`super_admin`), ativo/inativo e
  serviços permitidos. É a regra de acesso do site.
- `collaborator_photos`: fotos de colaboradores enviadas por administradores (imagem reduzida, ~20 KB, em base64).

Volume esperado: dezenas de usuários, menos de ~50 MB. Carga baixíssima.

**Recomendação: Cloud SQL for MySQL 8.0**, mesma região do Cloud Run (sugestão **`southamerica-east1`**, São Paulo; o
dashboard atual está em `us-west1`, mas aqui a latência importa mais do que ficar junto).
- Edição Enterprise, instância pequena de núcleo compartilhado (`db-f1-micro` ou `db-g1-small`; confirmar o que a
  região oferece), SSD de 10 GB com aumento automático. Alta disponibilidade **não** é necessária.
- **Backups automáticos diários** (retenção 7 dias) e, se a política da Vena exigir, recuperação pontual (PITR).
  **Proteção contra exclusão ligada.**
- Charset `utf8mb4`; fuso UTC (padrão).
- Um usuário de aplicação dedicado (não `root`), com todos os privilégios **apenas** no banco `indicadores_servicos`
  (as migrações precisam de `CREATE/ALTER`). Se quiserem separar, é possível ter um usuário só para migrações; o
  usuário do site precisaria apenas de SELECT/INSERT/UPDATE/DELETE.
- **Conexão:** pela integração nativa Cloud Run ↔ Cloud SQL (socket Unix, sem expor IP). O `DATABASE_URL` fica:
  ```
  mysql://indicadores_app:SENHA_URL_ENCODED@localhost/indicadores_servicos?socketPath=/cloudsql/PROJETO:REGIAO:INSTANCIA
  ```
  (caracteres especiais da senha devem ir codificados na URL, ex.: `@` → `%40`). Foi testado com socket Unix local.
  Se a TI preferir **IP privado** (VPC), basta usar `mysql://usuario:senha@IP-PRIVADO/indicadores_servicos`.
- Conexões: cada instância do site abre até 10 conexões (padrão do driver). Com `--max-instances 3`, no máximo 30 —
  confortável para a instância pequena.
- **Alternativa aceitável:** qualquer MySQL 8 gerenciado (ex.: TiDB Cloud Serverless, que já foi usado no início do
  projeto). Não usar Firestore/Postgres: o código usa MySQL/Drizzle.

**Migrações:** ficam em `drizzle/`. O Job `indicadores-migrate` (imagem do stage `migrate`) roda
`run-production-migrations.mjs` (cria/atualiza tabelas) e depois `ensure-role-enum.mjs` (garante os perfis
`user/admin/super_admin`), **antes de cada deploy**. São idempotentes: podem rodar repetidas vezes.

**Dados:** o banco do ambiente antigo não será migrado (a VM foi perdida). O que se perde é pequeno: a lista de
e-mails autorizados (refazer com `docs-ti/seed-administradores.sql` + tela "Cadastro" do site), as contas de usuário
(recriadas automaticamente no primeiro login) e as fotos de colaboradores enviadas (poucas). Os indicadores não são
afetados, pois vêm da planilha/Pipefy.

## 5. Passo a passo de implantação

Substitua `PROJETO`, `PROJETO_NUMERO`, `REGIAO` (sugestão `southamerica-east1`). Comandos `gcloud` (podem ser feitos
também pelo console).

```bash
# 0) APIs
gcloud services enable run.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com --project PROJETO

# 1) Repositório de imagens
gcloud artifacts repositories create indicadores --repository-format=docker --location=REGIAO --project PROJETO

# 2) Contas de serviço
gcloud iam service-accounts create indicadores-run    --display-name="Indicadores (execução)" --project PROJETO
gcloud iam service-accounts create indicadores-deploy --display-name="Indicadores (deploy GitHub)" --project PROJETO
RUN_SA=indicadores-run@PROJETO.iam.gserviceaccount.com
DEPLOY_SA=indicadores-deploy@PROJETO.iam.gserviceaccount.com
gcloud projects add-iam-policy-binding PROJETO --member=serviceAccount:$RUN_SA --role=roles/cloudsql.client
gcloud projects add-iam-policy-binding PROJETO --member=serviceAccount:$DEPLOY_SA --role=roles/run.admin
gcloud projects add-iam-policy-binding PROJETO --member=serviceAccount:$DEPLOY_SA --role=roles/artifactregistry.writer
gcloud iam service-accounts add-iam-policy-binding $RUN_SA --member=serviceAccount:$DEPLOY_SA --role=roles/iam.serviceAccountUser

# 3) Cloud SQL (MySQL 8) — veja seção 4 para as recomendações
gcloud sql instances create indicadores-db --database-version=MYSQL_8_0 --edition=ENTERPRISE \
  --tier=db-f1-micro --region=REGIAO --storage-type=SSD --storage-size=10 --storage-auto-increase \
  --availability-type=zonal --backup-start-time=03:00 --retained-backups-count=7 --deletion-protection --project PROJETO
gcloud sql databases create indicadores_servicos --instance=indicadores-db --charset=utf8mb4 --project PROJETO
gcloud sql users create indicadores_app --instance=indicadores-db --password='SENHA-FORTE' --project PROJETO

# 4) Segredos (Secret Manager)
printf '%s' 'mysql://indicadores_app:SENHA_URL_ENCODED@localhost/indicadores_servicos?socketPath=/cloudsql/PROJETO:REGIAO:indicadores-db' \
  | gcloud secrets create database-url --data-file=- --project PROJETO
openssl rand -base64 48 | tr -d '\n' | gcloud secrets create session-secret --data-file=- --project PROJETO
printf '%s' 'SEGREDO-DO-CLIENTE-OAUTH' | gcloud secrets create google-client-secret --data-file=- --project PROJETO
printf '%s' 'CHAVE-DO-APPS-SCRIPT'     | gcloud secrets create colaboradores-api-key --data-file=- --project PROJETO
for s in database-url session-secret google-client-secret colaboradores-api-key; do
  gcloud secrets add-iam-policy-binding $s --member=serviceAccount:$RUN_SA --role=roles/secretmanager.secretAccessor --project PROJETO
done
```

**5) Autenticação do GitHub sem chave (Workload Identity Federation)** — para o `deploy-cloud-run.yml`:
```bash
gcloud iam workload-identity-pools create github --location=global --project PROJETO
gcloud iam workload-identity-pools providers create-oidc github-repo --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='bobducspng/IndicadoresDeServicos'" --project PROJETO
gcloud iam service-accounts add-iam-policy-binding $DEPLOY_SA --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/PROJETO_NUMERO/locations/global/workloadIdentityPools/github/attribute.repository/bobducspng/IndicadoresDeServicos"
```
(Se a Vena mover o repositório para uma organização GitHub própria, troque `bobducspng/IndicadoresDeServicos` nos três lugares.)

**6) Variáveis do repositório GitHub** (Settings > Secrets and variables > Actions > *Variables*):
`GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WIF_PROVIDER` (= `projects/PROJETO_NUMERO/locations/global/workloadIdentityPools/github/providers/github-repo`),
`GCP_DEPLOY_SA`, `GCP_RUNTIME_SA`, `AR_REPOSITORY` (= `indicadores`), `CLOUD_SQL_INSTANCE` (= `PROJETO:REGIAO:indicadores-db`),
`APP_URL` (= `https://indicadores-servicos-PROJETO_NUMERO.REGIAO.run.app`, **sem barra no final**; ou o domínio próprio, se já definido),
`GOOGLE_CLIENT_ID`, `COLABORADORES_API_URL`.

**7) Cliente OAuth do Google** (seção 6): cadastrar `APP_URL/api/auth/google/callback` como URI de redirecionamento.

**8) Primeiro deploy:** faça push no `main` (ou rode o workflow manualmente em Actions > "Deploy no Google Cloud Run").
Ele roda tipos/testes, constrói as duas imagens, aplica as migrações (Job) e publica o serviço. Se preferirem
publicar manualmente: `docker build --target runtime -t REGIAO-docker.pkg.dev/PROJETO/indicadores/app:v1 .`, `docker push`,
e `gcloud run deploy indicadores-servicos --image ... ` com os mesmos parâmetros do workflow.

**9) Administradores iniciais** (uma vez, com o banco já migrado):
```bash
gcloud sql connect indicadores-db --user=indicadores_app --database=indicadores_servicos --project PROJETO < docs-ti/seed-administradores.sql
```
Ajuste e-mails/perfis no arquivo antes. Depois os demais usuários são cadastrados pela tela **Cadastro** do site.

**10) Domínio próprio (opcional):** mapear um domínio (ex.: `indicadores.vena.app.br`) ao serviço (mapeamento de domínio do Cloud Run ou balanceador HTTPS, conforme a política da TI). Se usar, atualizar `APP_URL`, o URI no cliente OAuth e repetir o deploy.

## 6. Login Google (OAuth) — recomendação

O cliente OAuth atual foi criado em um projeto Google Cloud **pessoal** (conta `bobducs@hotmail.com`), com a tela de
consentimento em modo "Testing" (só testadores cadastrados entram). Recomendações:
1. Criar um **novo cliente OAuth (tipo "Aplicativo da Web") no projeto Google Cloud da Vena** e deixar o público da
   tela de consentimento como **Interno** (só contas do Google Workspace `vena.app.br`). Dispensa lista de testadores.
2. URI de redirecionamento autorizado: `APP_URL/api/auth/google/callback` (e o do domínio próprio, se houver).
3. Escopos: apenas perfil básico e e-mail (`openid email profile`) — não exigem verificação do Google.
4. O acesso ao site continua controlado pela tabela `allowed_users` (e-mail precisa estar cadastrado e ativo), mesmo
   para contas do domínio. Com público "Interno", contas externas (ex.: Hotmail) não entram.

## 7. Segurança e pendências conhecidas

- **Planilha do Painel é pública** (qualquer pessoa com o link lê as abas) e o navegador a consulta diretamente. A
  correção planejada (planilha privada + leitura pelo servidor com conta de serviço) **não faz parte deste pacote** e
  deve ser tratada depois da migração.
- **Credenciais antigas** (do pacote original do projeto, de um banco TiDB Cloud e um segredo JWT antigo) **não** estão
  neste pacote, mas devem ser revogadas na origem. Não reutilize o `JWT_SECRET` antigo.
- O serviço é publicado com `--allow-unauthenticated` porque o próprio site faz o login Google e checa `allowed_users`.
  Se a Vena preferir uma camada extra (ex.: IAP/Workspace na frente), é compatível, mas exige ajustes no cadastro do OAuth.
- Segredos nunca devem ir para o repositório nem para o `.env` em imagem; usar o Secret Manager (como no workflow).
- Cookies de sessão são `HttpOnly`, `SameSite=Lax` e `Secure` quando a requisição chega por HTTPS (Cloud Run envia
  `X-Forwarded-Proto: https`).

## 8. Operação

- **Logs:** Cloud Logging (`gcloud run services logs read indicadores-servicos --region REGIAO`).
- **Rollback:** `gcloud run services update-traffic indicadores-servicos --to-revisions=REVISAO-ANTERIOR=100 --region REGIAO`.
- **Escala/custo:** `--min-instances 0` (o primeiro acesso após ociosidade leva alguns segundos; use `1` para evitar, com
  custo contínuo), `--max-instances 3`. Para este volume, o Cloud Run tende a ficar na camada gratuita e a maior parte do
  custo é o Cloud SQL; confirmar na calculadora de preços do Google para a região escolhida.
- **Backups:** automáticos do Cloud SQL; restauração pelo console. Teste uma restauração após a implantação.
- **Atualizar o site:** push no `main` aciona o fluxo (verifica, migra, publica). O `deploy-vm.yml` antigo só roda manualmente.
- **Desenvolvimento local:** `pnpm install`, `pnpm dev` (precisa de `DATABASE_URL` e `SESSION_SECRET`), `pnpm check`,
  `pnpm test`, `pnpm build`.

## 9. Verificação após o deploy

1. `https://APP_URL/` abre a tela de login do painel.
2. Login com uma conta cadastrada (seed) funciona e abre os Indicadores Gerais.
3. Aba **Por Colaborador** lista colaboradores (se mostrar "dados de exemplo", conferir `COLABORADORES_API_URL/KEY`).
4. Com perfil admin: tela **Cadastro** abre e consegue incluir um e-mail; em Por Colaborador, enviar uma foto funciona.
5. Logs sem erros de conexão com o banco; um redeploy mantém a sessão (mesmo `SESSION_SECRET`).

Dúvidas sobre regras de negócio, planilha ou Apps Script: Ederlei Pereira (ederlei.pereira@vena.app.br).
