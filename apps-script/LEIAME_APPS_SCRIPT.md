# Indicadores de Serviços no Google Apps Script — passo a passo

O painel passa a rodar como **Web App do Apps Script**: sem VM, sem banco de dados, sem ngrok, sem GitHub Actions.
O Google faz o login; o `Code.gs` confere se o e-mail está na aba **Acessos** e entrega os dados.

| Arquivo | O que é |
|---|---|
| `Code.gs` | O "servidor": login por domínio, aba Acessos, leitura da planilha do Painel, carteira de colaboradores, fotos |
| `Index.html` | O "site": o React atual compilado em **um único arquivo** (736 KB) |
| `appsscript.json` | Configuração do projeto (permissões e tipo de implantação) |

## Parte 1 — Criar o projeto (conta @vena.app.br, a mesma que vai ser a "dona" do Web App)

1. Abra <https://script.google.com> com a sua conta **vena.app.br** → **Novo projeto**. Dê o nome **Indicadores de Serviços (Web App)**.
   > Tem que ser um projeto **novo e separado** do `integracao_cadastro_clientes`: cada projeto só pode ter um `doGet`, e aquele já usa o dele.
2. Em **Configurações do projeto** (engrenagem) marque **Mostrar arquivo de manifesto "appsscript.json" no editor**.
3. Volte ao editor e coloque os três arquivos:
   - `Code.gs` → apague o conteúdo padrão e cole o conteúdo do arquivo `Code.gs`.
   - `appsscript.json` → substitua pelo conteúdo do arquivo `appsscript.json`.
   - `Index.html` → **+ (Arquivos) > HTML**, nome exatamente **Index**, e cole o conteúdo de `Index.html`.
     O arquivo é grande (736 KB): o editor pode demorar alguns segundos para colar. Se travar, use a **Opção B (clasp)** abaixo.

### Opção B — enviar pelo Cloud Shell com `clasp` (use se a colagem do Index.html travar)
Antes, em <https://script.google.com/home/usersettings> ligue **API Google Apps Script**.
```bash
# no Cloud Shell: descompacte o zip e entre na pasta com Code.gs, Index.html e appsscript.json
npm install -g @google/clasp
clasp login --no-localhost        # abra o link, entre com a conta vena.app.br e cole o código de volta
mkdir ~/gas-indicadores && cd ~/gas-indicadores
clasp create --type standalone --title "Indicadores de Serviços (Web App)"
cp /caminho/da/pasta/do/zip/{Code.gs,Index.html,appsscript.json} .   # sobrescreve o appsscript.json padrão
clasp push --force
```
(Os códigos de login são digitados por você, no seu navegador. Depois do `push`, siga a Parte 2 no editor web.)

## Parte 2 — Preparar (uma vez)

1. No editor, escolha a função **`setupInicial`** e clique em **Executar**.
2. O Google pede autorização (planilhas, Drive e e-mail). Clique em **Revisar permissões**, escolha a conta vena.app.br e, na tela
   "O Google não verificou este app", **Avançado > Acessar Indicadores de Serviços (não seguro)**. É normal para scripts próprios.
3. Abra **Execuções / Registro de execução** e confira o diagnóstico:
   - `Planilha de controle: https://docs.google.com/...` → foi criada automaticamente (abas **Acessos** e **Fotos**).
   - `Administradores ativos: ederlei.pereira@vena.app.br, cancelamento@vena.app.br`.
   - `OK` em cada aba de indicadores e em `Colaboradores` / `Carteira Colaborador`. Se aparecer **FALTA** em alguma, rode `colabAtualizarPlanilha` no projeto `integracao_cadastro_clientes`.
   - `Pasta de fotos OK`. Se aparecer FALTA, a conta dona do script precisa ter permissão de **editor** na pasta de imagens públicas do Drive.

## Parte 3 — Publicar

1. **Implantar > Nova implantação** → engrenagem > **App da Web**.
2. **Executar como: Eu (sua conta).** **Quem pode acessar: Qualquer pessoa na organização Vena** (a opção do domínio).
3. **Implantar** → copie a **URL do app da Web** (`https://script.google.com/a/macros/vena.app.br/s/.../exec`). Esse é o novo endereço do painel.
4. Abra a URL e confira: indicadores, Por Cliente, Por Colaborador e **Cadastro** (cadastre os demais usuários por ali).
5. Teste a foto: Por Colaborador > clique no colaborador > clique na foto > escolha uma imagem > **Salvar foto**. Ela vai para a sua pasta pública do Drive.

**Para atualizar depois:** Implantar > **Gerenciar implantações** > lápis > **Versão: Nova versão** > Implantar. A URL não muda.

## Parte 4 — Tornar a planilha do Painel privada (resolve a pendência de segurança)

Como o painel agora lê a planilha pelo Apps Script, ela **não precisa mais ser pública**.

1. Antes, confira se **mais alguém/algum sistema** lê essa planilha pelo link público (outros painéis, Looker, outros scripts que usam `gviz`). Scripts que a abrem pelo ID com a sua conta continuam funcionando.
2. Compartilhar > Acesso geral > **Restrito** (e deixe com acesso só quem precisa editar).
3. Depois que a planilha estiver privada, no `colaboradores_api.gs` você pode trocar `INCLUIR_TELEFONE_NA_PLANILHA` para `true` e rodar `colabAtualizarPlanilha`: o painel passa a mostrar o telefone **somente para administradores**.
4. O projeto `integracao_cadastro_clientes` e o `colaboradores_api.gs` **continuam iguais**; a chave `COLABORADORES_API_KEY` e a Web App antiga deixam de ser usadas por este painel.

## O que muda em relação ao site antigo

- **Login:** é o do próprio Google (conta vena.app.br). Não existe mais botão "Entrar com Google SSO" nem "Sair". Quem não está na aba Acessos vê "Acesso não liberado" com os canais de contato.
- **Acessos e fotos antigos não foram migrados** (estavam no banco da VM perdida): os administradores foram recadastrados automaticamente; os demais entram pela tela **Cadastro**. As fotos precisam ser reenviadas. A foto da conta Google deixou de aparecer (o Apps Script só informa o e-mail); valem a foto enviada, a do Pipefy ou as iniciais.
- **Aba Acessos** (planilha de controle): pode ser editada à mão. Colunas: `id` (único), `email`, `name`, `role` (`user`, `admin`, `super_admin`), `isActive` (1/0), `allowedServices` (vazio = todos; ou lista JSON, ex.: `["BPO Gerencial"]`), `avatarUrl`, `addedBy`, `createdAt`, `updatedAt`.
- **Restrição por serviço** (usuário com serviços limitados) continua sendo aplicada na tela, como antes. A carteira de colaboradores é filtrada no servidor.
- **Primeira abertura** pode levar alguns segundos (o Apps Script lê ~7 mil linhas). Depois fica em cache por 10 minutos; o botão **Reconectar** ignora o cache.
- Se abrir com mais de uma conta Google logada e aparecer "Acesso não liberado", abra o link numa janela anônima ou adicione `/u/1` conforme a conta vena.app.br.
- Os botões "Copiar" podem ser bloqueados pelo navegador dentro da página do Apps Script; o texto continua podendo ser selecionado.
- O link do Web App é único por implantação. Se criar uma **nova implantação** (em vez de editar a existente), o link muda.

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| Tela "Este painel precisa ser aberto pelo link do Web App" | Abriu o `Index.html` solto, e não a URL `/exec` |
| "Acesso não autorizado" mesmo sendo administrador | E-mail diferente na aba Acessos, ou conta errada no navegador |
| Indicadores não carregam / erro "aba não foi encontrada" | Nome da aba mudou na planilha do Painel (veja o diagnóstico) |
| "Você não tem permissão para acessar a pasta" ao salvar foto | A conta dona do script não é editora da pasta de imagens |
| Quer recomeçar o controle | Rode `reiniciarControle` e depois `setupInicial` (cria planilha de controle nova; a antiga não é apagada) |
