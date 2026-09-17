# Continuidade do projeto — Indicadores de Serviços

**Idioma principal:** português do Brasil  
**Data deste pacote:** 15/09/2026
**Último checkpoint WebDev:** `1bbd0df8`
**Projeto WebDev:** `EkyYHrheVWg3GvfeLRLoCK`
**Diretório original:** `/home/ubuntu/indicadores-servicos`

## 1. Objetivo

O projeto é o dashboard operacional **Indicadores de Serviços**, conectado a um Google Sheets público atualizado diariamente por Google Apps Script. A aplicação apresenta uma visão geral dos indicadores e uma visão histórica completa por cliente, com autenticação Google SSO, whitelist de e-mails, administração de acessos e permissões por serviço.

As áreas principais são:

- **Indicadores Gerais:** filtros globais no cabeçalho, KPIs, clientes novos e cancelados, linha do tempo, distribuição por serviço, clientes por quantidade de serviços, mix por clube, mapa real do Brasil e tabela de clientes.
- **Por Cliente:** seletor pesquisável de clientes, cards individuais, histórico de serviços em Gantt, resumo atual, evolução mensal, movimentações e detalhamento de vigências. Os filtros globais não são aplicados aqui: a página mostra o histórico integral do cliente selecionado.
- **Cadastro:** página administrativa no mesmo shell visual do dashboard. Permite cadastrar e-mails, editar nome, perfil, ativar/desativar acesso, editar serviços autorizados, buscar, filtrar por perfil, ordenar colunas, copiar e-mail e redimensionar colunas.

## 2. Stack e arquitetura atual

- React 19, TypeScript e Vite 7.
- Tailwind CSS 4, CSS customizado e Lucide React.
- Express + tRPC 11 + React Query.
- Drizzle ORM + MySQL/TiDB para usuários e whitelist.
- OAuth nativo WebDev/Manus, exibido na interface como **Google SSO**.
- Wouter para navegação client-side.
- Recharts e componentes SVG próprios para os gráficos e mapa.
- pnpm 10.

O projeto foi migrado de estático para fullstack para suportar autenticação e banco. O entrypoint de desenvolvimento é `server/_core/index.ts`; o build produz `dist/public` e `dist/index.js`.

Fluxo resumido:

```text
Google Sheets público → sincronização no browser → snapshot local + proteção contra resposta parcial
                                      ↓
                              agregações em dashboard.ts
                                      ↓
                     React / Indicadores Gerais / Por Cliente

OAuth WebDev/Manus → callback server/_core/oauth.ts → allowed_users → sessão segura
                                              ↓
                               tRPC auth e accessControl
```

## 3. Execução local

Requisitos: Node.js 22 e pnpm 10.

```bash
cd indicadores-servicos
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm dev
```

O servidor de desenvolvimento costuma usar `http://localhost:3000/`.

Build de produção:

```bash
pnpm check
pnpm test
pnpm build
NODE_ENV=production PORT=3000 node dist/index.js
```

Scripts principais em `package.json`:

| Script | Finalidade |
|---|---|
| `pnpm dev` | Inicia Vite + Express/tRPC em modo desenvolvimento. |
| `pnpm check` | Executa TypeScript sem emitir arquivos. |
| `pnpm test` | Executa testes Vitest. |
| `pnpm build` | Gera frontend e bundle do servidor. |
| `pnpm start` | Executa `dist/index.js` em produção. |
| `pnpm db:push` | Gera/aplica migrações Drizzle; revisar antes de usar fora do WebDev. |

Rotas client-side principais:

- `/` — Indicadores Gerais.
- `/clientes` — Visão Por Cliente.
- `/cadastro` — Cadastro administrativo, visível apenas para administradores.

## 4. Configuração e segredos

O pacote portátil **não inclui segredos**. Não copie `.project-config.json`, `.env` ou tokens do ambiente WebDev para o Claude, GitHub ou VPS.

No ambiente WebDev, as variáveis são fornecidas pela plataforma. Em uma hospedagem própria, será necessário configurar, conforme o uso desejado:

```text
DATABASE_URL
DRIZZLE_DATABASE_URL
JWT_SECRET
VITE_APP_ID
VITE_OAUTH_PORTAL_URL
OAUTH_SERVER_URL
OWNER_OPEN_ID
OWNER_NAME
BUILT_IN_FORGE_API_URL
BUILT_IN_FORGE_API_KEY
VITE_FRONTEND_FORGE_API_URL
VITE_FRONTEND_FORGE_API_KEY
```

A autenticação atual depende da infraestrutura OAuth WebDev/Manus. Ela não usa um client ID Google próprio. Ao migrar para outro host, será necessário manter o OAuth WebDev compatível ou substituir conscientemente o fluxo por Google OAuth próprio, atualizando callback, sessão, redirect URIs e variáveis.

## 5. Fonte de dados

Planilha pública:

<https://docs.google.com/spreadsheets/d/1BWWM39AJ88tj59EWN4qJCP5kVJAx16t7yVYuVw_QuIY/edit>

ID:

```text
1BWWM39AJ88tj59EWN4qJCP5kVJAx16t7yVYuVw_QuIY
```

Abas usadas:

- `Fatos Movimentacao` — eventos, aquisições, expansões e cancelamentos.
- `Vigência CNPJ x Serviço` — carteira, datas de início/fim, serviços, CNPJ, cliente, marca e local.
- `Base Mensal` — séries mensais e descoberta de anos/data mais recente.
- `posicao geografica` — cadastro auxiliar de cidade/UF/região.

A leitura é feita pelo endpoint público do Google Visualization API. O snapshot `client/src/initial-data.json` permite renderização inicial antes da sincronização. A função de merge evita substituir uma aba completa por uma resposta pública claramente parcial.

Se a planilha deixar de estar pública, não colocar credenciais Google no frontend. Usar uma API intermediária/backend com credenciais protegidas.

## 6. Regras de negócio atuais

- **Clientes ativos** é estoque de clientes únicos vigentes na data de corte; não deve ser somado a clientes novos/cancelados.
- **Clientes novos** e **cancelados** são fluxos do período e são deduplicados por cliente.
- Clientes novos usam `Fatos Movimentacao`, com fallback pela data `Início` da vigência quando o contrato chegou antes do fato.
- `Operação Assistida` não é cancelamento na visão geral nem na linha do tempo.
- Na visão individual, um ciclo com `Fim` preenchido é contado em **Encerrados**, inclusive Operação Assistida, pois ali se mostra histórico de vigências.
- Na visão individual, um serviço é **Ativo** apenas se não possui `Fim` ou se `Fim` é posterior à data de referência. Uma data fim igual ao dia de corte já é **Encerrado**.
- A visão Por Cliente ignora filtros globais e mostra todos os serviços históricos do cliente.
- O período padrão é Últimos 6 meses. As opções são Ano, Últimos 6 meses, Mês, 1º/2º Semestre e 1º/2º/3º/4º Trimestre.
- Um período histórico calcula o estoque até sua data final. Um período futuro usa a última data disponível para o estoque e zera movimentos que ainda não ocorreram.
- Crescimento anual só aparece quando Ano está selecionado e compara o mesmo recorte do ano anterior.
- A linha do tempo preserva meses sem movimento com valores zero.
- O Mix por Clube exclui valores sem clube válido e conta clientes únicos.
- Distribuição por serviço usa cliente + serviço, não CNPJ.
- Mapa conta clientes únicos por estado e não CNPJs.

## 7. Autenticação, whitelist e serviços permitidos

A tela inicial exige sessão e mostra **INDICADORES DE SERVIÇOS** com botão **Entrar com Google SSO**. O callback está em `server/_core/oauth.ts` e:

1. normaliza o e-mail retornado pelo OAuth;
2. consulta `allowed_users`;
3. bloqueia e-mails ausentes ou com `isActive !== 1`;
4. persiste nome, perfil, avatar/foto e cria a sessão segura.

O logout fica no rodapé da sidebar. Administradores veem o item **Cadastro** no menu esquerdo.

A tabela `allowed_users` possui, entre outros, `email`, `name`, `role`, `isActive`, `avatarUrl`, auditoria e `allowedServices`. O significado do campo é:

- `allowedServices = null`: acesso irrestrito, usado por administradores e registros antigos.
- `allowedServices = []`: usuário restrito sem nenhum serviço; não vê serviços na visão geral.
- `allowedServices = [..]`: vê somente os serviços selecionados.

A restrição é aplicada antes das agregações gerais, filtrando fatos, vigências e base mensal. A visão Por Cliente recebe a base completa para manter o histórico integral solicitado.

Administradores cadastrados originalmente:

```text
ederlei.pereira@vena.app.br
bobducs@hotmail.com
cancelamento@vena.app.br
```

Não inserir senhas, tokens ou URLs de conexão no código. Os dados efetivos da whitelist ficam no banco do ambiente WebDev e não são incluídos no ZIP portátil.

## 8. Arquivos que devem ser lidos primeiro

| Arquivo | Responsabilidade |
|---|---|
| `client/src/pages/Home.tsx` | Shell, sidebar, autenticação condicional, filtros, páginas Geral/Cliente/Cadastro e sincronização. |
| `client/src/lib/dashboard.ts` | Tipos, períodos, filtros, status, agregações e `deriveClientDetail`. |
| `client/src/lib/sheets.ts` | Leitura pública, snapshot e merge contra respostas parciais. |
| `client/src/components/UserManagementModal.tsx` | Formulário e tabela da página Cadastro. |
| `client/src/components/LoginOverlay.tsx` | Tela de autenticação e mensagens de acesso. |
| `client/src/components/BrazilMap.tsx` | Mapa coroplético real do Brasil. |
| `client/src/index.css` | Tokens e layout base. |
| `client/src/reference-adjustments.css` | Overrides visuais acumulados; ler com cuidado porque há regras finais no fim do arquivo. |
| `server/_core/oauth.ts` | Callback OAuth e validação da whitelist. |
| `server/routers.ts` | `auth`, `accessControl` e proteção admin. |
| `server/db.ts` | Helpers Drizzle/MySQL de usuários e whitelist. |
| `drizzle/schema.ts` | Schema `users` e `allowed_users`. |
| `drizzle/0000_bored_shadow_king.sql` a `0003_fine_meggan.sql` | Migrações existentes, incluindo status e serviços permitidos. |
| `server/auth.google.test.ts` | Testes de whitelist, roles, status e serviços permitidos. |
| `server/dashboard.client.test.ts` | Testes da regra de status na visão Por Cliente. |
| `MANUAL_INDICADORES.md` | Fonte documental das abas, campos, gráficos e regras. |
| `DEPLOY_VM.md` | Configuração do fluxo GitHub Actions → VM Oracle → systemd/ngrok. |

## 9. Cadastro administrativo atual

A antiga abertura em modal foi convertida em página interna `/cadastro`, mantendo o shell do dashboard. A página possui formulário acima da lista de e-mails cadastrados.

Recursos implementados:

- cadastrar novo e-mail, nome, perfil e foto opcional;
- selecionar/remover serviços permitidos;
- editar nome e serviços de conta existente;
- alternar perfil usuário/administrador;
- ativar/desativar usuário;
- revogar autorização;
- busca por nome/e-mail;
- filtro por perfil;
- ordenação por usuário, e-mail e status;
- copiar e-mail com um clique;
- tabela rolável com até 15 usuários visíveis por vez;
- cabeçalho fixo/rolagem interna conforme viewport;
- redimensionamento manual das colunas por arraste;
- botão **Restaurar colunas**;
- e-mails exibidos com largura mínima e leitura completa.

## 10. Identidade visual e migração de assets

O layout usa tema escuro premium, fonte Inter, sidebar responsiva, cards com bordas suaves, azul como ação principal, verde para estados ativos e coral para cancelamentos.

No WebDev, os ícones do menu usam caminhos gerenciados:

```text
/manus-storage/menu-expanded_4134ee4e.png
/manus-storage/menu-collapsed_962cea64.png
```

As cópias portáteis estão em:

```text
portable-assets/menu-expanded.png
portable-assets/menu-collapsed.png
```

Para host independente:

```bash
mkdir -p client/public/assets
cp portable-assets/menu-expanded.png client/public/assets/
cp portable-assets/menu-collapsed.png client/public/assets/
```

Depois, em `client/src/pages/Home.tsx`, trocar as constantes dos caminhos `/manus-storage/...` por `/assets/menu-expanded.png` e `/assets/menu-collapsed.png`.

O mapa SVG está em `client/src/data/brazil-state-paths.json` e não depende de proxy externo. O modo alternativo Google Maps depende da infraestrutura de mapas do WebDev.

## 11. Como continuar no Claude

Ao abrir o ZIP no Claude:

1. ler este arquivo inteiro;
2. ler `README.md`;
3. ler `MANUAL_INDICADORES.md` antes de alterar indicador, gráfico ou regra;
4. ler `client/src/lib/dashboard.ts` antes de alterar filtros/status/agregações;
5. ler `client/src/pages/Home.tsx` antes de alterar layout ou navegação;
6. ler `server/_core/oauth.ts`, `server/routers.ts`, `server/db.ts` e `drizzle/schema.ts` antes de alterar autenticação/Cadastro;
7. instalar dependências com `pnpm install --frozen-lockfile`;
8. executar `pnpm check`, `pnpm test` e `pnpm build` antes de entregar uma alteração;
9. atualizar `MANUAL_INDICADORES.md` quando criar ou alterar gráfico, campo, filtro ou regra;
10. nunca copiar `.project-config.json`, `.env`, tokens ou senhas do ambiente WebDev;
11. manter `allowedServices = null`, vazio e preenchido como contratos de permissão distintos;
12. preservar a exceção de Operação Assistida.

Para iniciar uma tarefa no Claude, forneça um pedido como:

> Leia `CONTINUAR_COM_OUTRA_IA.md`, `README.md` e os arquivos indicados. Antes de editar, explique o impacto da mudança nas regras de negócio. Faça a alteração, execute `pnpm check`, `pnpm test` e `pnpm build`, e atualize o manual se necessário.

## 12. Hospedagem fora do WebDev

Para VPS Ubuntu:

1. instalar Node.js 22 e pnpm 10;
2. copiar o projeto sem `node_modules`, `dist`, logs ou segredos;
3. configurar variáveis de ambiente e um banco MySQL/TiDB;
4. executar `pnpm install --frozen-lockfile`;
5. aplicar migrações revisadas com Drizzle;
6. adaptar os assets e, se necessário, o OAuth;
7. executar `pnpm check && pnpm test && pnpm build`;
8. iniciar `NODE_ENV=production PORT=3000 node dist/index.js`;
9. usar systemd/PM2 e Nginx com HTTPS.

O banco não é incluído no pacote portátil. Para preservar a whitelist, exportar a tabela `allowed_users` de forma segura no ambiente de origem e importar somente em um banco protegido da nova hospedagem.

## 13. Checklist de entrega

```bash
pnpm check
pnpm test
pnpm build
git diff --check
```

Antes de entregar uma alteração visual, validar desktop e mobile. Antes de entregar uma alteração de dados, conferir a unidade de contagem e atualizar o manual.

## 14. Estado salvo neste pacote

- Último checkpoint WebDev: `1bbd0df8`.
- Status da visão Por Cliente corrigido: data fim atingida resulta em `Encerrado`.
- Cadastro convertido em página interna `/cadastro`.
- Permissões por serviço e foto do OAuth implementadas.
- Tabela de Cadastro com busca, filtro, ordenação, cópia e redimensionamento manual.
- Testes atuais: 7 testes passando em 3 arquivos.
- TypeScript e build de produção validados antes do empacotamento.

O arquivo ZIP deve excluir `node_modules/`, `dist/`, `.git/`, logs, `.project-config.json`, `.env*` e qualquer token. O snapshot `client/src/initial-data.json`, as migrações e os assets portáteis devem ser preservados.
