# Indicadores de Serviços

Dashboard executivo em React/TypeScript conectado a uma planilha pública do Google Sheets, com indicadores gerais, visão histórica por cliente e administração de acessos via Google SSO.

## Início rápido

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm dev
```

Build de produção:

```bash
pnpm check
pnpm test
pnpm build
NODE_ENV=production PORT=3000 node dist/index.js
```

## Rotas

- `/` — **Indicadores Gerais**, com filtros globais, KPIs, gráficos e mapa.
- `/clientes` — **Por Cliente**, com histórico completo do cliente selecionado sem filtros globais.
- `/cadastro` — **Cadastro**, página administrativa visível somente para administradores.

## Autenticação e permissões

A aplicação usa OAuth nativo WebDev/Manus apresentado como **Google SSO**. O acesso só é liberado quando o e-mail está cadastrado e ativo na tabela `allowed_users`. Administradores podem cadastrar, editar, ativar/desativar e revogar e-mails pela página **Cadastro**.

Também é possível definir quais serviços cada usuário visualiza na área de indicadores gerais. Administradores mantêm acesso irrestrito; a visão **Por Cliente** continua exibindo o histórico completo do cliente selecionado.

## Fonte de dados

[Google Sheets — Indicadores de Serviços](https://docs.google.com/spreadsheets/d/1BWWM39AJ88tj59EWN4qJCP5kVJAx16t7yVYuVw_QuIY/edit)

Abas utilizadas:

- `Fatos Movimentacao`
- `Vigência CNPJ x Serviço`
- `Base Mensal`
- `posicao geografica`

## Documentação para continuar o desenvolvimento

Leia primeiro [`CONTINUAR_COM_OUTRA_IA.md`](CONTINUAR_COM_OUTRA_IA.md). Ele descreve a arquitetura fullstack atual, autenticação, permissões por serviço, regras de negócio, arquivos importantes, migração de assets, hospedagem e checklist de validação.

O manual dos indicadores, campos das abas e regras de cálculo está em [`MANUAL_INDICADORES.md`](MANUAL_INDICADORES.md).

O fluxo de publicação na VM Oracle, incluindo secrets do GitHub Actions, chave SSH, preservação do `.env` e reinício do systemd, está em [`DEPLOY_VM.md`](DEPLOY_VM.md).

## Estrutura principal

```text
client/src/pages/Home.tsx                 shell, navegação e telas principais
client/src/lib/dashboard.ts               filtros, períodos, agregações e status
client/src/lib/sheets.ts                  leitura pública e snapshot local
client/src/components/UserManagementModal.tsx  Cadastro e gestão de acessos
server/_core/oauth.ts                     callback OAuth e whitelist
server/routers.ts                          tRPC auth/accessControl
server/db.ts                               helpers Drizzle/MySQL
drizzle/schema.ts                          schema users/allowed_users
drizzle/*.sql                              migrações
portable-assets/                           ícones para migração fora do WebDev
```

## Validação atual

```text
pnpm test   → 7 testes passando em 3 arquivos
pnpm check  → sem erros TypeScript
pnpm build  → produção gerada com sucesso
```

O pacote portátil deve excluir `node_modules`, `dist`, `.git`, logs, `.project-config.json`, `.env*` e tokens. O snapshot `client/src/initial-data.json`, as migrações, a documentação e os assets portáteis devem ser preservados.
