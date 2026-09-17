# Manual de Indicadores e Gráficos

**Projeto:** Indicadores de Serviços  
**Versão do manual:** 3.1
**Atualizado em:** 15/09/2026
**Responsável:** Manus AI

## 1. Objetivo

Este manual documenta a origem dos dados, os campos do Google Sheets, os filtros e as regras utilizadas nos indicadores e gráficos do painel **Indicadores de Serviços**. O documento deve ser atualizado sempre que um gráfico, indicador, filtro ou regra de cálculo for criado ou alterado.

A fonte de dados é a planilha pública compartilhada pela equipe. A aplicação consulta as abas por meio do endpoint público do Google Visualization API, carrega os dados no navegador e recalcula os indicadores conforme os filtros selecionados.[1]

> **Regra de manutenção:** nenhum novo gráfico deve ser considerado concluído sem uma entrada correspondente neste manual. A entrada deve registrar a aba de origem, os campos utilizados, a granularidade da contagem, os filtros aplicáveis e a regra de cálculo.

## 2. Visão geral da arquitetura de dados

A aplicação carrega quatro abas da planilha em cada atualização. Os nomes abaixo são os nomes exatos utilizados no código e devem ser preservados para que a leitura automática funcione.

| Aba do Google Sheets | Finalidade no painel | Situação atual |
|---|---|---|
| `Fatos Movimentacao` | Eventos de contratação, aquisição, expansão e cancelamento. Alimenta listas, linha do tempo e Mix por Clube. | Utilizada nos gráficos de movimentação. |
| `Vigência CNPJ x Serviço` | Base de vigência dos serviços por cliente, CNPJ, marca, localização e situação. Alimenta carteira, serviços, LTV, mapa e tabela. | Principal fonte dos indicadores de carteira. |
| `Base Mensal` | Série mensal consolidada de clientes, serviços, entradas, saídas e churn. | Carregada e utilizada para descobrir anos e a data mais recente; os gráficos atuais recalculam as métricas diretamente das bases de fatos e vigência. |
| `posicao geografica` | Cadastro auxiliar de região geográfica, cidade e UF. | Carregada para disponibilidade futura; a métrica atual do mapa utiliza `Cidade` e `Estado` da aba `Vigência CNPJ x Serviço`. |

### 2.1 Campos identificados por aba

| Aba | Campos disponíveis |
|---|---|
| `Fatos Movimentacao` | `Data`, `Ano`, `Mês`, `Mês Nome`, `Ano-Mês`, `ID Registro`, `Cliente`, `Cód CP`, `Região`, `Clube`, `Serviço`, `Tipo Movimentação`, `Sinal`, `Evento Cliente`, `Serviços Após`, `Fonte`, `ID Card`, `Responsável` |
| `Vigência CNPJ x Serviço` | `CNPJ (dígitos)`, `CNPJ`, `Cliente`, `Marca`, `Serviço`, `Início`, `Fim`, `Dias`, `Situação`, `Card Contrato`, `Card Cancelamento`, `Cidade`, `Estado`, `Região`, `Tipo de Negócio`, `Volume Financeiro`, `Status Financeiro` |
| `Base Mensal` | `Ano-Mês`, `Ano`, `Mês`, `Mês Nome`, `Clientes Ativos (fim)`, `Serviços Ativos (fim)`, `Média Serviços/Cliente`, `Novos Clientes`, `Clientes Perdidos`, `Serviços Contratados`, `Serviços Cancelados`, `Saldo Líquido`, `Canc. Parciais`, `Canc. Totais`, `Churn Clientes %` |
| `posicao geografica` | `Região geográfica`, `Cidade`, `UF` |

## 3. Atualização e fluxo de leitura

O botão **Reconectar** consulta novamente as quatro abas públicas. A tela inicia com um snapshot local para aparecer imediatamente e, em seguida, substitui os dados pelo resultado mais recente da planilha quando a consulta termina.

Os dados são consultados sem credenciais privadas por meio do endereço público da planilha. Se a planilha deixar de estar publicada ou sofrer alteração de nome nas abas, a atualização poderá falhar.

A aplicação normaliza textos para comparação, removendo diferenças de acentuação, espaços repetidos e caixa alta ou baixa. Essa normalização é utilizada nos filtros e nas regras de classificação de eventos.

## 4. Filtros globais

Os filtros ficam no cabeçalho e afetam todos os indicadores e gráficos da página **Indicadores Gerais**. A página **Por Cliente** possui somente o seletor de cliente e mostra o histórico completo, sem aplicar os filtros globais.

| Filtro visual | Campo ou regra de origem | Comportamento |
|---|---|---|
| **Segmento** | `Região` nas abas `Fatos Movimentacao` e `Vigência CNPJ x Serviço` | Aceita uma ou mais regiões. |
| **Marca / Clube** | `Marca` ou `Clube` nas abas `Fatos Movimentacao` e `Vigência CNPJ x Serviço` | Um registro é mantido quando o valor selecionado corresponde à marca ou ao clube. |
| **Serviços** | `Serviço` nas abas `Fatos Movimentacao` e `Vigência CNPJ x Serviço` | Aceita um ou mais serviços. |
| **Ano** | Anos encontrados em `Data`, `Ano-Mês`, `Início` e `Fim` | Define o ano de referência. A opção padrão é todos os anos. |
| **Período** | Datas de cada registro | Refinamento posterior ao ano: Ano, últimos 6 meses, mês, 1º/2º semestre ou 1º/2º/3º/4º trimestre. |

O padrão inicial é **Últimos 6 meses**. Quando um ano é selecionado, a data de referência passa a ser a última data disponível naquele ano e o filtro de período é calculado dentro desse ano.
Quando o período é refinado para **Ano**, **Mês**, **1º/2º Semestre** ou **1º/2º/3º/4º Trimestre** dentro de um ano selecionado, o dashboard mantém o mês-calendário da referência global para o preset **Mês atual** e troca apenas o ano dos dados. Os semestres usam janeiro–junho e julho–dezembro; os trimestres usam janeiro–março, abril–junho, julho–setembro e outubro–dezembro. Por exemplo, se a referência global está em setembro, selecionar 2025 + Mês atual mostra setembro/2025; o comparativo usa setembro/2024.
Os meses sem registros continuam presentes na **Linha do Tempo** com zero contratações e zero cancelamentos. Isso preserva a sequência cronológica completa do intervalo filtrado.

## 5. Indicadores de destaque

### 5.1 Clientes ativos

| Item | Descrição |
|---|---|
| Aba principal | `Vigência CNPJ x Serviço` |
| Campos | `Cliente`, `Início`, `Fim`, `Situação`, `Região`, `Marca`, `Serviço` |
| Granularidade | Cliente único, deduplicado pelo campo `Cliente`. |
| Regra | Considera a carteira vigente na data final do período filtrado. Para um período futuro, sem dados próprios, usa a última data disponível da base como fotografia presente. |
| Comparativo | Só é exibido quando o filtro `Ano` está selecionado; compara o total com o mesmo recorte de período do ano anterior. |
| Exibição | Total de clientes. O percentual de variação anual aparece somente com ano de referência definido. Novos e cancelados aparecem exclusivamente nos painéis de movimentação, separados do estoque ativo. |
O cálculo não soma CNPJs. Um cliente com vários CNPJs ou serviços é contado uma única vez.
**Importante:** `Clientes ativos` é um estoque de clientes únicos vigentes na data de corte do recorte. `Clientes novos` e `Clientes cancelados` são fluxos de movimentação do período; portanto, seus totais não devem ser somados ao estoque ativo.

### 5.2 CNPJs em operação

| Item | Descrição |
|---|---|
| Aba | `Vigência CNPJ x Serviço` |
| Campos | `CNPJ`, `Cliente`, `Início`, `Fim`, `Situação` |
| Granularidade | CNPJ único. |
| Regra | Conta os CNPJs distintos nos registros de vigência que se sobrepõem ao período filtrado. |

### 5.3 LTV médio, ou tempo médio de retenção

| Item | Descrição |
|---|---|
| Aba | `Vigência CNPJ x Serviço` |
| Campos | `Cliente`, `Serviço`, `Início`, `Fim`, `Dias` |
| Granularidade | Par único `Cliente + Serviço`. |
| Regra | Para cada par, usa `Dias` quando disponível. Quando `Dias` não está preenchido, calcula a duração entre `Início` e `Fim`, limitada ao fim do período. Para cada par, conserva a maior duração encontrada. |
| Exibição | Média das durações convertida para anos. |

### 5.4 Universo O Boticário

| Item | Descrição |
|---|---|
| Aba | `Vigência CNPJ x Serviço` |
| Campos | `Cliente`, `Marca` |
| Granularidade | Cliente único. |
| Regra | Um cliente pertence ao universo O Boticário quando possui pelo menos um registro cuja `Marca` contém `O Boticário`. |
| Exibição | Percentual de clientes O Boticário sobre a base filtrada, total O Boticário e total de outras marcas. |

## 6. Catálogo de gráficos e listas

### 6.1 Clientes novos

| Item | Descrição |
|---|---|
| Aba principal | `Fatos Movimentacao` |
| Aba de fallback | `Vigência CNPJ x Serviço`, usada quando o App Script atualiza o contrato antes de criar o fato de movimentação. |
| Campos | `Cliente`, `Data`, `Evento Cliente`, `Tipo Movimentação`, `Serviço`, `Clube`, `Marca`, `Região`; no fallback, `Início` substitui `Data`. |
| Granularidade | Cliente único. |
| Regra de inclusão | Inclui registros com `Evento Cliente = NOVO CLIENTE`, `Tipo Movimentação = AQUISICAO` ou `Tipo Movimentação = EXPANSAO`. Também inclui contratos da vigência cujo `Início` está dentro do período quando o fato de movimentação ainda não chegou. |
| Data exibida | `Data` da movimentação; no fallback, `Início` do contrato. |
| Ordenação | Mais recente para mais antigo. |
| Detalhe | Combina `Clube` ou `Marca` disponível com `Serviço`. |
| Filtros | Segmento, marca/clube, serviço, ano e período. |

A lista mantém uma única entrada por cliente e conserva a contratação mais recente encontrada dentro do recorte. Se o mesmo cliente existir nas duas abas, a data mais recente entre `Data` e `Início` prevalece. Essa regra cobre o intervalo de sincronização em que uma contratação recém-assinada já está na vigência, mas ainda não foi registrada em `Fatos Movimentacao`.

### 6.2 Clientes cancelados

| Item | Descrição |
|---|---|
| Aba | `Fatos Movimentacao` |
| Campos | `Cliente`, `Data`, `Evento Cliente`, `Tipo Movimentação`, `Serviço`, `Clube`, `Região` |
| Granularidade | Cliente único. |
| Regra de inclusão | Inclui `Evento Cliente = CLIENTE PERDIDO` ou valores de `Tipo Movimentação` que contenham `CANCELAMENTO`. |
| Exceção | Registros do serviço `Operação Assistida` não são tratados como cancelamento, pois o serviço possui início e fim próprios. |
| Data exibida | `Data` da movimentação. |
| Ordenação | Mais recente para mais antigo. |
| Filtros | Segmento, marca/clube, serviço, ano e período. |

### 6.3 Linha do tempo de serviços contratados e cancelados

| Item | Descrição |
|---|---|
| Aba | `Fatos Movimentacao` |
| Campos | `Data`, `Evento Cliente`, `Tipo Movimentação`, `Serviço` |
| Granularidade | Serviço movimentado por mês. |
| Contratados | Soma registros com `NOVO CLIENTE`, `AQUISICAO` ou `EXPANSAO`. |
| Cancelados | Soma registros com `CLIENTE PERDIDO` ou `CANCELAMENTO`, exceto `Operação Assistida`. |
| Eixo temporal | Todos os meses entre o início e o fim do período filtrado, inclusive meses sem movimentação. |
| Interação | Ao passar o mouse, exibe mês, serviços contratados e serviços cancelados. |
| Visual | Duas curvas suavizadas: verde para contratados e coral/vermelha para cancelados. |

A linha do tempo mede **serviços movimentados**, e não clientes únicos. Por isso, um mesmo cliente pode gerar mais de uma ocorrência no mesmo mês se houver mais de um serviço movimentado.

### 6.4 Distribuição por serviço

| Item | Descrição |
|---|---|
| Aba | `Vigência CNPJ x Serviço` |
| Campos | `Cliente`, `Serviço`, `Início`, `Fim`, além dos campos utilizados pelos filtros |
| Granularidade | Par único `Cliente + Serviço`. |
| Regra | Deduplica CNPJs e linhas repetidas para contar cada serviço uma única vez por cliente. |
| Exibição | Barras coloridas com total, volume por serviço e percentual em relação ao total. |
| Filtros | Segmento, marca/clube, serviço, ano e período. |

O indicador não mede quantidade de CNPJs. Um cliente com vários CNPJs continua representando uma ocorrência daquele serviço.

### 6.5 Clientes × serviços

| Item | Descrição |
|---|---|
| Aba | `Vigência CNPJ x Serviço` |
| Campos | `Cliente`, `Serviço` |
| Granularidade | Cliente único agrupado pela quantidade de serviços únicos. |
| Regra | Para cada cliente, conta a quantidade distinta de valores em `Serviço`. Em seguida, agrupa os clientes em faixas de 1, 2, 3 serviços e assim por diante. |
| Exibição | Quantidade de clientes, percentual da base e total de serviços representados por cada faixa. |
| Filtros | Segmento, marca/clube, serviço, ano e período. |

### 6.6 Mix por clube

| Item | Descrição |
|---|---|
| Aba | `Fatos Movimentacao` |
| Campos | `Cliente`, `Clube` |
| Granularidade | Cliente único. |
| Regra | Ignora clubes vazios, `N/A`, `NÃO INFORMADO`, `NÃO CONSTA` e `SEM CLUBE`. Quando um cliente aparece com mais de um clube, utiliza o clube com maior frequência para representar o cliente. |
| Exibição | Gráfico de rosca com uma cor por clube, volume no centro e legenda com volume e percentual. |
| Filtros | Segmento, marca/clube, serviço, ano e período categórico. |

O denominador do percentual é o total de clientes com clube válido, não o total de clientes sem clube.

### 6.7 Mapa dos serviços oferecidos

| Item | Descrição |
|---|---|
| Fonte de métricas | `Vigência CNPJ x Serviço` |
| Campos de dados | `Cliente`, `Serviço`, `Cidade`, `Estado`, `Região`, `Início`, `Fim` |
| Geometria | Arquivo estático `client/src/data/brazil-state-paths.json`, utilizado para desenhar os limites reais dos estados. |
| Granularidade | Cliente único por estado. |
| Regra de contagem | Agrupa por `Estado` e deduplica pelo campo `Cliente`. |
| Cobertura geográfica | Divide registros com `Cidade` e `Estado` preenchidos pelo total de registros ativos filtrados. |
| Tooltip | Mostra nome completo do estado, UF, clientes ativos, percentual da carteira e os três principais clientes da UF. |
| Mini-ranking | Agrupa por `Estado + Cliente` e conta serviços distintos pelo campo `Serviço`. |
| Interação | Hover amplia o marcador e os textos. Clique seleciona o estado no mapa ou na legenda. |
| Modo alternativo | O modo Satélite / Vias utiliza o componente de mapa e marcadores gerados a partir das contagens estaduais. |
| Filtros | Segmento, marca/clube, serviço, ano e período. |

A aba `posicao geografica` possui `Região geográfica`, `Cidade` e `UF`, mas não participa da contagem atual do mapa. Ela permanece disponível para uma futura etapa de enriquecimento ou validação de endereços.

### 6.8 Clientes em foco

| Item | Descrição |
|---|---|
| Aba | `Vigência CNPJ x Serviço` |
| Campos | `Cliente`, `Serviço`, `CNPJ`, `Marca`, `Região`, `Cidade`, `Situação` |
| Granularidade | Cliente único. |
| Regras | Conta serviços distintos por cliente, CNPJs distintos por cliente e conserva os atributos descritivos do primeiro registro agrupado. |
| Exibição | Tabela ordenada pela quantidade de serviços, com cliente, serviços, CNPJs, marca, região e status. |
| Filtros | Segmento, marca/clube, serviço, ano e período. |
| Rolagem | A tabela possui rolagem para permitir a análise de todos os clientes. |

## 7. Página Por Cliente

A página **Por Cliente** possui um seletor próprio de cliente e apresenta o histórico completo desse cliente, sem aplicar os filtros globais da página **Indicadores Gerais**. Ao selecionar um cliente, a aplicação monta uma visão individual a partir da aba `Vigência CNPJ x Serviço` e complementa os eventos com a aba `Fatos Movimentacao`.

### 7.1 Seletor de cliente

| Item | Descrição |
|---|---|
| Fonte | `Vigência CNPJ x Serviço` e `Fatos Movimentacao` |
| Campo | `Cliente` |
| Regra | Lista nomes únicos, permite busca parcial e seleciona um cliente por vez. |
| Comportamento | Enquanto o usuário digita, a busca permanece estável no cabeçalho. A lista inclui clientes encontrados nas abas de vigência e fatos. Os indicadores só aparecem quando existe uma correspondência selecionada. |

### 7.2 Cards individuais

| Indicador | Aba | Campos | Regra |
|---|---|---|---|
| **Serviços ativos** | `Vigência CNPJ x Serviço` | `Cliente`, `Serviço`, `Início`, `Fim` | Conta serviços distintos cujo início já ocorreu e que não possuem `Fim` atingido na data de referência. Uma data fim igual ao dia de corte já deixa o ciclo encerrado. |
| **CNPJs vinculados** | `Vigência CNPJ x Serviço` | `Cliente`, `CNPJ` | Conta CNPJs distintos do cliente. |
| **Tempo médio** | `Vigência CNPJ x Serviço` | `Serviço`, `Início`, `Fim` | Calcula a duração média dos serviços históricos em dias. Serviços abertos usam a data de referência mais recente da base. |
| **Relacionamento** | `Vigência CNPJ x Serviço` | `Início` | Mede o período entre o primeiro início de serviço e a data final de referência, exibido em anos. |

O resumo lateral também apresenta serviços encerrados, primeiro serviço, última movimentação e quantidade de serviços no recorte. **Encerrados** conta ciclos distintos com campo `Fim` preenchido até a data de referência, inclusive ciclos de `Operação Assistida`; isso representa conclusão do período, não cancelamento.

Nos cards, **serviços no histórico** representa nomes de serviços únicos. No Gantt e na tabela, ciclos separados do mesmo serviço continuam visíveis quando possuem datas de início ou fim diferentes.

### 7.3 Histórico dos serviços — Gantt

| Item | Descrição |
|---|---|
| Aba | `Vigência CNPJ x Serviço` |
| Campos | `Cliente`, `Serviço`, `Início`, `Fim`, `Dias`, `CNPJ`, `Marca`, `Cidade`, `Estado`, `Região` |
| Granularidade | Ciclo de contrato identificado por `Serviço + Início + Fim`. Linhas repetidas de CNPJ no mesmo período são agrupadas, mas recontratações ou períodos separados permanecem como linhas distintas. |
| Paleta | Cada serviço usa a mesma paleta do gráfico `Distribuição por serviço`; ciclos do mesmo serviço mantêm a mesma cor. |
| Status | O status aparece abaixo do nome: `Ativo`, `Encerrado` ou `Operação Assistida`. |
| Datas | Exibe início e fim; serviços abertos mostram `Em aberto`. |
| Duração | Mostra dias para períodos curtos e anos fechados para contratos com pelo menos um ano. |
| Ordenação | Serviços ativos primeiro; depois serviços encerrados por início mais recente. |

O histórico considera todos os serviços iniciados até a data de referência mais recente da base, sem recorte de período ou filtros globais. Isso garante que a página represente o histórico integral do cliente.

### 7.4 Evolução mensal dos serviços ativos

| Item | Descrição |
|---|---|
| Aba | `Vigência CNPJ x Serviço` |
| Campos | `Cliente`, `Serviço`, `Início`, `Fim` |
| Granularidade | Mês e serviço distinto. |
| Regra | Para cada mês desde o primeiro serviço do cliente até a data de referência, conta serviços cujo início já ocorreu e cujo fim ainda não ocorreu no último dia do mês. |
| Exibição | Linha azul com a quantidade de serviços ativos por mês e rótulos espaçados para evitar sobreposição de meses e anos. |
| Observação | A série é calculada diretamente da vigência porque `Base Mensal` não possui o campo `Cliente`; o histórico completo é independente do período selecionado na página geral. |

### 7.5 Movimentações do cliente

| Item | Descrição |
|---|---|
| Aba | `Fatos Movimentacao` |
| Campos | `Cliente`, `Data`, `Serviço`, `Tipo Movimentação`, `Evento Cliente`, `Clube`, `Responsável` |
| Granularidade | Todos os eventos do cliente até a data de referência mais recente da base. |
| Exibição | Lista cronológica reversa com data, serviço, tipo de movimento, evento, clube e responsável. |
| Operação Assistida | Quando o movimento indica cancelamento, o texto é convertido para `Finalização do período` e `Serviço concluído`. Não é apresentado como cancelamento. |

### 7.6 Detalhamento dos serviços

| Coluna | Fonte ou regra |
|---|---|
| Serviço | `Vigência CNPJ x Serviço`.`Serviço` |
| Status | Calculado com `Início`, `Fim` e regra especial de `Operação Assistida`; sem `Fim` ou com término futuro é `Ativo`, com término atingido é `Encerrado`. |
| Início | `Início` |
| Fim | `Fim`; quando vazio, `Em aberto`. |
| Dias | `Dias` quando disponível; caso contrário, duração calculada entre início e fim ou data de referência. |
| CNPJs | Distintos por serviço pelo campo `CNPJ`. |
| Marca | `Marca` |
| Local | `Cidade` e `Estado` |

A tabela possui rolagem horizontal e vertical conforme o tamanho da carteira do cliente.

## 8. Regras de negócio importantes

### 8.1 Cliente não é CNPJ

Os indicadores de cliente utilizam o campo `Cliente` deduplicado. Os indicadores de CNPJ utilizam o campo `CNPJ` deduplicado. Essas duas grandezas não devem ser somadas ou tratadas como equivalentes.

### 8.2 Operação Assistida

O encerramento de `Operação Assistida` não representa cancelamento. Esse serviço possui duração própria e, por isso, é excluído da lista de cancelados e da série de cancelamentos da linha do tempo. Na visão individual, um ciclo com `Fim` preenchido é contado em **Encerrados**, enquanto um novo ciclo sem `Fim` permanece no histórico como `Operação Assistida` aberto.

### 8.3 Contratação, aquisição e expansão

A aplicação considera `NOVO CLIENTE`, `AQUISICAO` e `EXPANSAO` como entradas de serviço. Essa mesma regra é aplicada à lista de Clientes novos e à Linha do tempo para que os dois componentes permaneçam coerentes.

### 8.4 Filtros de período

O período padrão é de seis meses. Quando o usuário seleciona um ano, o recorte posterior é calculado dentro do ano selecionado. A série temporal sempre completa os meses do intervalo, mesmo quando não existem registros.

## 9. Procedimento obrigatório para criar um novo gráfico

Antes de implementar um novo gráfico, definir sua unidade de contagem. A unidade deve ser cliente, CNPJ, cliente-serviço, serviço movimentado, estado ou outra entidade explicitamente documentada.

Depois, registrar a origem no catálogo usando a tabela abaixo. A entrada deve ser preenchida antes da entrega final da alteração.

| Campo obrigatório | O que registrar |
|---|---|
| Nome do gráfico | Título exibido no painel. |
| Página | `Indicadores Gerais`, `Por Cliente` ou outra rota. |
| Tipo visual | Barras, linha, rosca, mapa, tabela, KPI ou lista. |
| Aba(s) | Nome exato de cada aba do Google Sheets. |
| Campos | Nomes exatos das colunas utilizadas. |
| Unidade de contagem | Cliente, CNPJ, cliente-serviço, evento, mês, estado etc. |
| Regra de cálculo | Fórmula, deduplicação, filtros e exceções. |
| Filtros | Filtros globais que alteram o gráfico. |
| Interações | Hover, clique, tooltip, seleção ou exportação. |
| Data de inclusão | Data em que o gráfico entrou no painel. |

### Modelo de registro

```markdown
### Nome do novo gráfico

| Item | Descrição |
|---|---|
| Página | Indicadores Gerais |
| Tipo visual | Barras horizontais |
| Aba(s) | `Nome exato da aba` |
| Campos | `Campo A`, `Campo B` |
| Unidade de contagem | Cliente único |
| Regra de cálculo | Descrever a fórmula e a deduplicação. |
| Filtros | Segmento, serviço e período |
| Interações | Hover com total e percentual |
| Data de inclusão | DD/MM/AAAA |
```



## 11. Autenticação, controle de acesso e painel administrativo

O painel é protegido por **Google SSO via OAuth do WebDev/Manus**. Antes de carregar os dados da planilha, a aplicação verifica a sessão atual; usuários não autenticados visualizam somente a tela **INDICADORES DE SERVIÇOS** com o botão **Entrar com Google SSO**.

Depois que a conta Google conclui o login, o callback OAuth normaliza o e-mail e consulta a tabela `allowed_users`. A sessão só é criada quando o e-mail está previamente cadastrado e com status **Ativo** (`isActive = 1`). Se o usuário estiver desativado ou não cadastrado, o login é bloqueado e a interface orienta a contatar o administrador.

### Acesso no Menu Lateral Esquerdo

Para administradores autenticados, o menu lateral esquerdo exibe o botão **Cadastro**, com o mesmo tratamento visual das demais páginas, permitindo abrir o painel diretamente pelo menu.

### Funcionalidades do Painel Administrativo

1. **Cadastrar e-mail**: Adiciona novo e-mail Google/corporativo, nome, perfil (`user` ou `admin`), foto opcional e serviços permitidos.
2. **Ativar / Desativar acesso**: Permite suspender temporariamente o login de qualquer usuário sem apagar o histórico do cadastro.
3. **Alternar perfil**: Alterna permissões entre Administrador e Usuário comum com proteção para impedir que o sistema fique sem nenhum administrador ativo.
4. **Editar conta**: Permite alterar nome e selecionar/remover serviços autorizados de uma conta existente.
5. **Revogar autorização**: Remove em definitivo o e-mail da lista de permissões.
6. **Consultar a lista**: Busca, filtro por perfil, ordenação por colunas, cópia rápida do e-mail e redimensionamento manual das colunas.

| Elemento | Implementação |
|---|---|
| Login | OAuth real com botão `Entrar com Google SSO` e nonce CSRF em cookie host-only. |
| Autorização | Tabela `allowed_users`, verificando e-mail normalizado e `isActive = 1`. |
| Atalho no menu | Página `Cadastro` na barra lateral esquerda visível exclusivamente para administradores. |
| Ações de status | Procedimentos server-side `accessControl.toggleStatus`, `updateRole`, `add` e `remove`, protegidos por `adminProcedure`. |
| Logout | Procedimento `auth.logout`, que limpa o cookie da sessão no rodapé do menu. |

## 12. Checklist de atualização do manual

| Verificação | Obrigatória |
|---|---:|
| O gráfico tem uma seção neste manual? | Sim |
| Os nomes das abas estão idênticos aos nomes da planilha? | Sim |
| Todos os campos utilizados estão documentados? | Sim |
| A unidade de contagem está explícita? | Sim |
| A regra de deduplicação está descrita? | Sim |
| Os filtros que afetam o gráfico estão listados? | Sim |
| As exceções de negócio estão registradas? | Sim |
| A tabela de campos disponíveis continua atualizada? | Sim |
| A data da alteração foi registrada? | Sim |
| O TypeScript e o build foram executados após a alteração? | Sim |

## 13. Histórico de versões

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | 09/09/2026 | Criação do manual com origem dos dados, campos, filtros, indicadores, gráficos, regras de negócio e procedimento para documentar novas visualizações. |
| 1.1 | 09/09/2026 | Inclusão da página Por Cliente com seletor, cards individuais, histórico Gantt, evolução mensal, movimentações e tabela de serviços. |
| 1.2 | 09/09/2026 | Lista completa de clientes, histórico individual sem filtros globais, card `Tempo médio`, paleta compartilhada no Gantt e eixos compactos para períodos longos. |
| 1.3 | 10/09/2026 | Auditoria /web-design-reviewer: gaveta lateral mobile funcional com overlay, cabeçalho responsivo, filtros em 2 colunas no celular, alvos touch mínimos de 40px/42px, rolagem horizontal isolada para o histórico Gantt e link de salto para acessibilidade via teclado. |
| 1.4 | 10/09/2026 | Correção da visão individual: `Encerrados` agora conta ciclos com `Fim` preenchido, inclusive Operação Assistida, sem classificar a finalização normal como cancelamento. |
| 1.5 | 10/09/2026 | Clientes novos passou a usar `Vigência CNPJ x Serviço` como fallback temporário quando o contrato já tem `Início`, mas o registro ainda não chegou a `Fatos Movimentacao`; filtros e deduplicação por cliente são preservados. |
| 1.6 | 10/09/2026 | Sincronização protegida contra respostas públicas parciais: o snapshot completo anterior é mantido quando uma aba perde a maior parte dos registros, com aviso no painel. |
| 1.7 | 10/09/2026 | Cabeçalho passou a exibir histórico de sincronização com horário, status e volumes por aba; durante `Reconectar`, uma camada de atualização bloqueia a navegação até a leitura terminar. |
| 1.8 | 10/09/2026 | KPI `Clientes ativos` separado dos fluxos de `Clientes novos` e `Clientes cancelados`; o cartão agora exibe somente o estoque ativo, enquanto as movimentações permanecem nos painéis próprios. |
| 1.9 | 10/09/2026 | Correção da comparação temporal ao combinar `Ano` e `Período`: o mesmo mês-calendário do ano anterior é usado como referência, evitando deslocamentos indevidos para dezembro. |
| 2.0 | 10/09/2026 | Filtro `Ano` ajustado para manter o mês de referência global ao consultar anos retroativos; por exemplo, setembro permanece setembro ao trocar 2026 por 2025. |
| 2.1 | 11/09/2026 | Filtro `Período` separado em `Últimos 6 meses`, `Mês atual`, `1º/2º Semestre` e `1º/2º/3º/4º Trimestre`, com cálculo de datas por janela de calendário e ordem operacional revisada. |
| 2.2 | 11/09/2026 | Reintrodução da opção `Ano` no menu `Período`, que estava ausente apesar de fazer parte da sequência solicitada. |
| 2.3 | 11/09/2026 | Correção do estoque de ativos em períodos futuros: no `4º Trimestre` sem movimentações ainda ocorridas, fluxos ficam em zero e a carteira ativa é calculada na última data disponível, mantendo coerência com o recorte `Ano`. |
| 2.4 | 11/09/2026 | Crescimento de `Clientes ativos` ocultado quando nenhum ano está selecionado; com ano definido, compara sempre o mesmo recorte de período do ano anterior. |
| 2.5 | 11/09/2026 | Calibração visual /web-design-engineer: números dos KPIs aumentados (32px–40px), padding lateral reduzido de 32px para 18px–20px aproximando o menu dos indicadores, e tipografia numérica ampliada nos gráficos, donut e tabelas. |
| 2.8 | 12/09/2026 | Adicionado botão `Gestão de Acessos` no menu lateral esquerdo para administradores, coluna de status ativo/desativado com toggle sem exclusão e bloqueio de usuários inativos no OAuth. |
| 2.7 | 11/09/2026 | Autenticação Google SSO real com whitelist de e-mails, proteção do carregamento dos indicadores, perfil no rodapé, logout e painel admin de gestão de acessos. |
| 2.6 | 11/09/2026 | Legibilidade dos gráficos: tooltip da `Linha do tempo` ampliado para exibir mês, contratados e cancelados com mais destaque; eixos, legendas, totais, percentuais, mapa e gráficos da visão por cliente receberam escala tipográfica revisada para desktop e mobile. |
| 3.0 | 15/09/2026 | Painel administrativo convertido em página `Cadastro`, com edição de nome e serviços, busca, filtro por perfil, ordenação, cópia de e-mail, rolagem interna e redimensionamento manual das colunas. |
| 3.1 | 15/09/2026 | Correção da regra da visão `Por Cliente`: serviços cuja data `Fim` foi atingida, inclusive no dia de referência, aparecem como `Encerrado`; `Operação Assistida` mantém seu status próprio e não vira cancelamento. |

## Referências

[1]: https://docs.google.com/spreadsheets/d/1BWWM39AJ88tj59EWN4qJCP5kVJAx16t7yVYuVw_QuIY/edit "Planilha pública de dados dos Indicadores de Serviços"
