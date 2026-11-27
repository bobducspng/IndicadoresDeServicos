/**
 * Glossário dos indicadores do painel. Texto escrito a partir do MANUAL_INDICADORES.md (v4.1).
 * Ao criar ou alterar um indicador, atualize o manual E este arquivo.
 */
export const TELAS_GLOSSARIO = ["Indicadores Gerais", "Por Cliente", "Por Colaborador", "Conceitos e regras"] as const;
export type TelaGlossario = (typeof TELAS_GLOSSARIO)[number];

export interface TermoGlossario {
  id: string;
  termo: string;
  tela: TelaGlossario;
  /** O que o indicador mede, em uma frase. */
  resumo: string;
  /** Como é calculado. */
  calculo: string;
  /** De onde vêm os dados. */
  fonte: string;
  /** Cuidado de leitura (opcional). */
  observacao?: string;
  /** Outras palavras que as pessoas usam para procurar o termo. */
  busca?: string[];
}

export const GLOSSARIO: TermoGlossario[] = [
  // ------------------------------------------------------------------ Indicadores Gerais
  {
    id: "clientes-ativos",
    termo: "Clientes ativos",
    tela: "Indicadores Gerais",
    resumo: "Quantos clientes diferentes têm pelo menos um serviço em vigor no fim do período escolhido nos filtros.",
    calculo:
      "Conta cada cliente uma única vez, mesmo que ele tenha vários CNPJs ou serviços. Considera a vigência (início e fim do serviço) na data final do período; se o período é futuro, usa a data de corte. Com um ano selecionado, o cartão mostra também a variação em relação ao mesmo recorte do ano anterior. O botão “Ver lista” abre os clientes que formam o número.",
    fonte: "Aba Vigência CNPJ x Serviço (campos Cliente, Início, Fim, Situação).",
    observacao: "É um estoque, uma fotografia da carteira. Não some com Entradas ou Saídas, que são movimentações do período.",
    busca: ["carteira", "base ativa", "kpi"],
  },
  {
    id: "cnpjs-em-operacao",
    termo: "CNPJs em operação",
    tela: "Indicadores Gerais",
    resumo: "Quantos CNPJs diferentes estão com serviço em vigor no período.",
    calculo:
      "Conta cada CNPJ uma única vez entre os registros de vigência que se sobrepõem ao período filtrado. O botão “Ver lista” mostra uma linha por CNPJ, com cliente, serviços, início mais antigo, fim mais recente e localidade.",
    fonte: "Aba Vigência CNPJ x Serviço (campos CNPJ, Cliente, Início, Fim, Situação).",
    observacao: "Cliente e CNPJ são medidas diferentes: um cliente pode ter vários CNPJs.",
    busca: ["cnpj", "kpi"],
  },
  {
    id: "ltv-medio",
    termo: "LTV médio (tempo médio de retenção)",
    tela: "Indicadores Gerais",
    resumo: "Por quanto tempo, em média, um cliente permanece com um serviço contratado.",
    calculo:
      "Para cada par Cliente + Serviço usa a coluna Dias; se ela estiver vazia, calcula a duração entre Início e Fim (limitada ao fim do período). Se o mesmo par aparece mais de uma vez, fica a maior duração. O resultado é a média dessas durações, mostrada em anos.",
    fonte: "Aba Vigência CNPJ x Serviço (campos Cliente, Serviço, Início, Fim, Dias).",
    busca: ["ltv", "retenção", "retencao", "permanência", "duração média", "tempo de casa"],
  },
  {
    id: "universo-boticario",
    termo: "Universo O Boticário",
    tela: "Indicadores Gerais",
    resumo: "Participação dos clientes da rede O Boticário na base filtrada.",
    calculo:
      "Um cliente entra no universo quando tem pelo menos um registro cuja marca contém “O Boticário”. O painel mostra o percentual sobre a base filtrada, o total O Boticário e o total das outras marcas.",
    fonte: "Aba Vigência CNPJ x Serviço (campos Cliente, Marca).",
    busca: ["boticario", "marca", "rede"],
  },
  {
    id: "entradas-no-periodo",
    termo: "Entradas no período",
    tela: "Indicadores Gerais",
    resumo: "Clientes que entraram na carteira ou ampliaram o que contratam dentro do período.",
    calculo:
      "Uma linha por cliente, com duas etiquetas: Novo cliente (evento NOVO CLIENTE) e Expansão (cliente que já existia e contratou um serviço adicional). Se o mesmo cliente tem as duas no período, vale Novo cliente; dentro da etiqueta, vale a movimentação mais recente. Os chips acima da lista (Todos, Novo cliente, Expansão) mostram a contagem de cada etiqueta e filtram a lista. Enquanto o fato de movimentação ainda não chegou, um contrato recém-iniciado na vigência entra como Novo cliente, desde que o primeiro serviço do cliente tenha começado no período.",
    fonte: "Aba Fatos Movimentacao (Cliente, Data, Evento Cliente, Tipo Movimentação, Serviço, Clube) e, como complemento, Vigência CNPJ x Serviço.",
    observacao:
      "Expansão não é cliente novo. Serviços extras contratados junto com um cliente novo não geram linha própria aqui; aparecem só na Linha do tempo.",
    busca: ["clientes novos", "novo cliente", "expansão", "expansao", "contratação", "aquisição"],
  },
  {
    id: "saidas-no-periodo",
    termo: "Saídas no período",
    tela: "Indicadores Gerais",
    resumo: "Clientes que saíram da carteira ou cancelaram parte dos serviços dentro do período.",
    calculo:
      "Uma linha por cliente, com duas etiquetas: Cancelamento total (o cliente saiu da carteira, evento CLIENTE PERDIDO) e Cancelamento parcial (cancelou alguns serviços e continua com outros). Se o mesmo cliente tem as duas no período, vale o total. Os chips acima da lista (Todos, Cancelamento total, Cancelamento parcial) filtram e mostram a contagem. Finalizações de Operação Assistida e Spot F360 não entram.",
    fonte: "Aba Fatos Movimentacao (Cliente, Data, Evento Cliente, Tipo Movimentação, Serviço, Clube).",
    observacao: "Só o cancelamento total reduz Clientes ativos. O parcial reduz serviços de um cliente que continua ativo.",
    busca: ["cancelamento", "cancelados", "churn", "perdidos", "clientes cancelados"],
  },
  {
    id: "linha-do-tempo",
    termo: "Linha do tempo de serviços movimentados",
    tela: "Indicadores Gerais",
    resumo: "Mês a mês, quantos serviços foram contratados, ampliados ou cancelados.",
    calculo:
      "Quatro séries: serviços contratados (clientes novos), expansões de serviço, cancelamentos totais e cancelamentos parciais. Todos os meses do período aparecem, mesmo sem movimentação (valor zero). A legenda é clicável para ocultar ou mostrar cada série; ao passar o mouse, o balão mostra o mês e os quatro valores.",
    fonte: "Aba Fatos Movimentacao (Data, Evento Cliente, Tipo Movimentação, Serviço).",
    observacao:
      "Conta serviços, não clientes: um mesmo cliente pode gerar mais de uma ocorrência no mês. Por isso os totais não coincidem com os das listas de Entradas e Saídas.",
    busca: ["gráfico de linha", "série", "evolução", "mensal"],
  },
  {
    id: "distribuicao-por-servico",
    termo: "Distribuição por serviço",
    tela: "Indicadores Gerais",
    resumo: "Quantos clientes têm cada serviço e quanto cada serviço representa do total.",
    calculo:
      "Conta cada serviço uma única vez por cliente (par Cliente + Serviço), sem repetir por CNPJ. Mostra o volume e o percentual de cada serviço, em barras coloridas.",
    fonte: "Aba Vigência CNPJ x Serviço (Cliente, Serviço, Início, Fim).",
    observacao: "Não mede CNPJs: um cliente com vários CNPJs continua sendo uma ocorrência do serviço.",
    busca: ["barras", "serviços", "mix de serviços"],
  },
  {
    id: "clientes-x-servicos",
    termo: "Clientes × serviços",
    tela: "Indicadores Gerais",
    resumo: "Quantos clientes têm 1, 2, 3 ou mais serviços diferentes.",
    calculo:
      "Para cada cliente, conta os serviços distintos e agrupa os clientes por essa quantidade. Mostra, em cada faixa, o número de clientes, o percentual da base e o total de serviços representados.",
    fonte: "Aba Vigência CNPJ x Serviço (Cliente, Serviço).",
    busca: ["cross sell", "venda cruzada", "faixas", "quantidade de serviços"],
  },
  {
    id: "mix-por-clube",
    termo: "Mix por clube",
    tela: "Indicadores Gerais",
    resumo: "Como os clientes se dividem entre os clubes (redes).",
    calculo:
      "Cada cliente conta uma vez, no clube em que mais aparece. Clubes vazios, N/A, NÃO INFORMADO, NÃO CONSTA e SEM CLUBE são ignorados. O gráfico de rosca mostra o volume no centro e, na legenda, volume e percentual de cada clube.",
    fonte: "Aba Fatos Movimentacao (Cliente, Clube).",
    observacao: "O percentual é calculado sobre os clientes com clube válido, não sobre o total de clientes.",
    busca: ["rosca", "pizza", "rede", "clube"],
  },
  {
    id: "mapa-servicos",
    termo: "Mapa dos serviços oferecidos",
    tela: "Indicadores Gerais",
    resumo: "Onde estão os clientes ativos, por estado.",
    calculo:
      "Agrupa por Estado e conta cada cliente uma única vez. O balão mostra o nome do estado, a UF, os clientes ativos, o percentual da carteira e os três clientes com mais serviços naquela UF. Passar o mouse destaca o estado e clicar o seleciona, no mapa ou na legenda. Há também o modo Satélite / Vias.",
    fonte: "Aba Vigência CNPJ x Serviço (Cliente, Serviço, Cidade, Estado, Região, Início, Fim).",
    busca: ["mapa", "uf", "estado", "geografia", "região"],
  },
  {
    id: "clientes-em-foco",
    termo: "Clientes em foco",
    tela: "Indicadores Gerais",
    resumo: "Ranking dos clientes por quantidade de serviços.",
    calculo:
      "Para cada cliente, conta os serviços distintos e os CNPJs distintos. A tabela é ordenada pela quantidade de serviços e mostra cliente, serviços, CNPJs, marca, região e status. Tem rolagem para consultar todos os clientes.",
    fonte: "Aba Vigência CNPJ x Serviço (Cliente, Serviço, CNPJ, Marca, Região, Cidade, Situação).",
    busca: ["ranking", "tabela", "maiores clientes"],
  },
  {
    id: "filtros-globais",
    termo: "Filtros globais (Segmento, Marca / Clube, Serviços, Ano e Período)",
    tela: "Indicadores Gerais",
    resumo: "Recortes que alteram todos os indicadores e gráficos de Indicadores Gerais.",
    calculo:
      "Segmento filtra por região; Marca / Clube e Serviços aceitam uma ou mais opções. Ano define o ano de referência (o padrão é todos). Período refina dentro do ano: últimos 6 meses (padrão), mês atual, mês anterior, 1º e 2º semestre e 1º a 4º trimestre. Com um ano selecionado, o mês atual e o mês anterior são os da referência global, só com o ano trocado, e o comparativo usa o mesmo recorte do ano anterior.",
    fonte: "Campos Região, Marca, Clube, Serviço e as datas (Data, Início, Fim) das abas Fatos Movimentacao e Vigência CNPJ x Serviço.",
    observacao:
      "A página Por Cliente não usa esses filtros. Usuários com serviços restritos veem apenas os serviços autorizados em todas as listas e indicadores.",
    busca: ["filtro", "período", "periodo", "ano", "trimestre", "semestre", "segmento"],
  },

  // ------------------------------------------------------------------ Por Cliente
  {
    id: "seletor-de-cliente",
    termo: "Seletor de cliente",
    tela: "Por Cliente",
    resumo: "Escolhe o cliente cujo histórico será exibido.",
    calculo:
      "Lista os nomes únicos de cliente, com busca parcial, um cliente por vez. Por padrão mostra só os clientes com serviço ativo (mesmo critério de Clientes ativos); “Mostrar encerrados” inclui os demais, marcados como encerrado. Os indicadores só aparecem depois que um cliente é selecionado.",
    fonte: "Abas Vigência CNPJ x Serviço, Histórico de Serviços e Fatos Movimentacao (campo Cliente).",
  },
  {
    id: "servicos-ativos-cliente",
    termo: "Serviços ativos (por cliente)",
    tela: "Por Cliente",
    resumo: "Quantos serviços diferentes o cliente selecionado tem em vigor.",
    calculo:
      "Conta os serviços distintos que já começaram e ainda não atingiram a data de Fim na data de referência. O histórico reconstrói ciclos antigos que não aparecem mais na vigência atual.",
    fonte: "Abas Vigência CNPJ x Serviço e Histórico de Serviços.",
  },
  {
    id: "cnpjs-vinculados",
    termo: "CNPJs vinculados",
    tela: "Por Cliente",
    resumo: "Quantos CNPJs o cliente selecionado tem.",
    calculo: "Conta os CNPJs distintos do cliente na carteira de vigência.",
    fonte: "Aba Vigência CNPJ x Serviço (Cliente, CNPJ).",
  },
  {
    id: "tempo-medio-cliente",
    termo: "Tempo médio (por cliente)",
    tela: "Por Cliente",
    resumo: "Duração média, em dias, dos ciclos de serviço do cliente.",
    calculo:
      "Média das durações dos ciclos do histórico (do Início ao Fim). Serviços ainda abertos usam a data de referência mais recente da base como fim.",
    fonte: "Abas Vigência CNPJ x Serviço e Histórico de Serviços.",
  },
  {
    id: "relacionamento",
    termo: "Relacionamento",
    tela: "Por Cliente",
    resumo: "Há quanto tempo o cliente está conosco.",
    calculo: "Período entre o primeiro início de serviço do cliente e a data final de referência, exibido em anos.",
    fonte: "Abas Vigência CNPJ x Serviço e Histórico de Serviços (Início, Data Ativação).",
    busca: ["tempo de relacionamento", "antiguidade"],
  },
  {
    id: "encerrados",
    termo: "Encerrados",
    tela: "Por Cliente",
    resumo: "Quantos ciclos de serviço do cliente já terminaram.",
    calculo:
      "Conta os ciclos distintos com Fim preenchido até a data de referência, inclusive os ciclos concluídos de Operação Assistida e Spot F360.",
    fonte: "Abas Vigência CNPJ x Serviço e Histórico de Serviços (Fim, Data Desativação).",
    observacao: "Encerrado não significa cancelado. Operação Assistida e Spot F360 terminam por conclusão do período contratado.",
  },
  {
    id: "historico-gantt",
    termo: "Histórico dos serviços (Gantt)",
    tela: "Por Cliente",
    resumo: "Linha do tempo visual de todos os ciclos de serviço do cliente.",
    calculo:
      "Uma barra por ciclo (Serviço + Início + Fim). Linhas repetidas de CNPJ no mesmo período são agrupadas; recontratações viram barras separadas. Cada serviço mantém a mesma cor da Distribuição por serviço. Abaixo do nome aparece o status: Ativo, Encerrado ou Operação Assistida. Serviços abertos mostram “Em aberto”. A ordem é: ativos primeiro; depois os encerrados, do início mais recente ao mais antigo.",
    fonte: "Abas Vigência CNPJ x Serviço, Histórico de Serviços e Fatos Movimentacao.",
    observacao: "Mostra o histórico completo do cliente, sem os filtros globais.",
    busca: ["gantt", "histórico", "linha do tempo do cliente", "ciclos"],
  },
  {
    id: "servico-e-responsaveis",
    termo: "Serviço e Responsáveis",
    tela: "Por Cliente",
    resumo: "Quem foi responsável por cada serviço do cliente ao longo do tempo.",
    calculo:
      "Lista cronológica, do mais recente ao mais antigo, com a data, o serviço e o responsável, a partir dos eventos do cliente até a data de referência. Finalizações de Operação Assistida e Spot F360 aparecem como “Finalização do período”, não como cancelamento.",
    fonte: "Aba Fatos Movimentacao (Cliente, Data, Serviço, Tipo Movimentação, Responsável).",
    busca: ["responsável", "responsavel", "movimentações do cliente"],
  },
  {
    id: "detalhamento-servicos",
    termo: "Detalhamento dos serviços",
    tela: "Por Cliente",
    resumo: "Tabela com cada serviço do cliente e a situação dele.",
    calculo:
      "Status Ativo (sem Fim ou com término futuro) ou Encerrado (término atingido). Dias vem da coluna Dias ou da duração calculada entre início e fim (ou data de referência); CNPJs são os distintos por serviço; Marca e Local (cidade e estado) vêm da vigência.",
    fonte: "Aba Vigência CNPJ x Serviço.",
    busca: ["tabela de serviços", "status do serviço"],
  },

  // ------------------------------------------------------------------ Por Colaborador
  {
    id: "colaboradores-lista",
    termo: "Colaboradores e Prestadores de Serviço",
    tela: "Por Colaborador",
    resumo: "Grade com todos os colaboradores, mostrando foto (ou iniciais), cargo e as contagens de clientes e CNPJs.",
    calculo:
      "A busca encontra por nome, cargo ou departamento; os filtros Cliente (seleção múltipla) e Departamento reduzem a lista. Com um cliente filtrado, só aparecem os colaboradores que atendem aquele cliente, e os contadores, o mapa e a carteira mostram apenas ele.",
    fonte: "Cadastro de colaboradores e de responsáveis por cliente no Pipefy, entregue ao painel por uma API privada.",
    observacao:
      "A foto vem, nesta ordem, de: foto enviada por um administrador, foto da conta Google, foto do cadastro. Sem foto, aparecem as iniciais.",
    busca: ["consultores", "equipe", "foto", "departamento"],
  },
  {
    id: "colaborador-clientes",
    termo: "Clientes do colaborador (número verde)",
    tela: "Por Colaborador",
    resumo: "Quantos clientes o colaborador atende.",
    calculo:
      "Conta os clientes em que o colaborador aparece como responsável por algum serviço. O vínculo é ligado ao cliente pelo nome do cliente e ao colaborador pelo e-mail (nome.sobrenome@vena.app.br).",
    fonte: "Campos de responsável do Database Clientes do Pipefy (Receita, Despesa, BPO Gerencial, Suprimentos etc.).",
    busca: ["quantidade de clientes", "carteira", "clientes"],
  },
  {
    id: "colaborador-cnpjs",
    termo: "CNPJs do colaborador (número laranja)",
    tela: "Por Colaborador",
    resumo: "Quantos CNPJs ativos o colaborador atende.",
    calculo:
      "Conta os CNPJs com vigência ativa nos serviços pelos quais o colaborador responde em cada cliente dele, sem repetir CNPJ. Quem responde por BPO Gerencial, por exemplo, conta só os CNPJs com BPO Gerencial ativo.",
    fonte: "Aba Vigência CNPJ x Serviço combinada com os vínculos de responsável.",
    busca: ["cnpj", "quantidade de cnpjs"],
  },
  {
    id: "colaborador-carteira",
    termo: "Carteira do colaborador",
    tela: "Por Colaborador",
    resumo: "Lista de todos os clientes do colaborador selecionado.",
    calculo:
      "Abas por grupo de serviço (Operacional, Gerencial, Suprimentos e Outros), busca por cliente, marca ou cidade, filtro por UF e a chave “Somente clientes ativos”. Clicar em um cliente abre a página Por Cliente.",
    fonte: "Aba Vigência CNPJ x Serviço (UF, cidade, marca, serviços ativos) combinada com os vínculos de responsável.",
    busca: ["clientes do colaborador", "abas", "operacional", "gerencial", "suprimentos"],
  },
  {
    id: "colaborador-mapa",
    termo: "Mapa da carteira por UF",
    tela: "Por Colaborador",
    resumo: "Distribuição geográfica da carteira do colaborador.",
    calculo: "Conta os clientes do colaborador por estado. Clicar em um estado filtra a lista de clientes; “Limpar estado” desfaz o filtro.",
    fonte: "Aba Vigência CNPJ x Serviço (Estado).",
    busca: ["mapa", "uf", "estado"],
  },
  {
    id: "colaborador-contato",
    termo: "Chamar no Google Chat e no WhatsApp",
    tela: "Por Colaborador",
    resumo: "Atalhos para falar com o colaborador selecionado.",
    calculo:
      "O botão do Google Chat copia uma mensagem pronta e abre o Chat. O botão do WhatsApp abre a conversa com o número cadastrado, já com a mensagem pronta, e só aparece quando há um telefone válido. O ícone ao lado do e-mail e do telefone copia o dado.",
    fonte: "Cadastro de colaboradores (e-mail e telefone).",
    observacao: "O Chat ainda não abre direto a conversa com a pessoa: a mensagem fica copiada para você colar.",
    busca: ["chat", "whatsapp", "telefone", "contato", "copiar"],
  },

  // ------------------------------------------------------------------ Conceitos e regras
  {
    id: "cliente-x-cnpj",
    termo: "Cliente × CNPJ",
    tela: "Conceitos e regras",
    resumo: "São medidas diferentes e não devem ser somadas nem tratadas como equivalentes.",
    calculo:
      "Os indicadores de cliente contam o campo Cliente sem repetição; os de CNPJ contam o campo CNPJ sem repetição. Um cliente pode ter vários CNPJs, e cada um conta uma vez nos indicadores de CNPJ.",
    fonte: "Aba Vigência CNPJ x Serviço.",
  },
  {
    id: "estoque-x-fluxo",
    termo: "Estoque × fluxo",
    tela: "Conceitos e regras",
    resumo: "Estoque é a fotografia da carteira; fluxo é o que aconteceu dentro do período.",
    calculo:
      "Clientes ativos e CNPJs em operação são estoque. Entradas, Saídas e a Linha do tempo são fluxo. Por isso o fluxo não se soma ao estoque. Só o cancelamento total retira um cliente do estoque.",
    fonte: "Abas Vigência CNPJ x Serviço (estoque) e Fatos Movimentacao (fluxo).",
  },
  {
    id: "tipos-de-movimentacao",
    termo: "Novo cliente, aquisição, expansão e cancelamentos",
    tela: "Conceitos e regras",
    resumo: "As cinco situações que o painel usa para classificar uma movimentação.",
    calculo:
      "Novo cliente: primeiro contrato do cliente (evento NOVO CLIENTE). Aquisição: serviço contratado junto com o cliente novo. Expansão: serviço adicional contratado por quem já era cliente. Cancelamento total: o cliente saiu da carteira (CLIENTE PERDIDO). Cancelamento parcial: o cliente cancelou parte dos serviços e continua com outros.",
    fonte: "Aba Fatos Movimentacao (Tipo Movimentação e Evento Cliente).",
    observacao: "Expansão não conta como cliente novo, e cancelamento parcial não conta como cliente cancelado.",
    busca: ["aquisição", "aquisicao", "expansão", "expansao", "cancelamento total", "cancelamento parcial", "novo cliente"],
  },
  {
    id: "operacao-assistida-spot",
    termo: "Operação Assistida e Spot F360",
    tela: "Conceitos e regras",
    resumo: "Serviços com duração própria: o fim deles é conclusão, não cancelamento.",
    calculo:
      "Quando o ciclo termina (Operação Assistida, ou Spot F360 na etapa Concluído do pipe 302416833), o serviço passa para Encerrados e fica fora das listas de cancelamento e da série vermelha da Linha do tempo. Um novo ciclo sem Fim permanece no histórico como Operação Assistida aberto.",
    fonte: "Abas Vigência CNPJ x Serviço, Histórico de Serviços e Fatos Movimentacao.",
    busca: ["spot", "f360", "operação assistida", "operacao assistida", "ciclo concluído"],
  },
  {
    id: "data-de-corte",
    termo: "Data de corte",
    tela: "Conceitos e regras",
    resumo: "A data que o painel usa como “hoje” para fotografar a carteira.",
    calculo:
      "É a maior entre a data do último fato de movimentação e a data de hoje. Assim, o estoque acompanha fins de vigência mesmo sem movimentação nova. O texto “dados até” do filtro usa a mesma data.",
    fonte: "Aba Fatos Movimentacao (Data) e o calendário do dia.",
    busca: ["dados até", "data de referência", "último fato"],
  },
  {
    id: "atualizacao-dos-dados",
    termo: "Atualização dos dados",
    tela: "Conceitos e regras",
    resumo: "De onde vêm os números e quando eles são atualizados.",
    calculo:
      "O painel lê a planilha de indicadores. Rotinas automáticas do Apps Script atualizam a planilha de madrugada (análise por volta das 3h e sincronização com o Pipefy por volta das 6h). O botão Reconectar, no cabeçalho, lê a planilha de novo; enquanto lê, a navegação fica bloqueada.",
    fonte: "Planilha do Google Sheets alimentada pelo Pipefy.",
    observacao: "Uma mudança feita no Pipefy só aparece no painel depois da próxima atualização da planilha.",
    busca: ["reconectar", "atualizar", "sincronização", "pipefy", "planilha"],
  },
];

/** Minúsculas e sem acento, para a busca ignorar “Retenção” x “retencao”. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buscarGlossario(
  termo: string,
  tela: TelaGlossario | "Todas" = "Todas",
  lista: TermoGlossario[] = GLOSSARIO,
): TermoGlossario[] {
  const q = normalizarBusca(termo);
  return lista.filter((t) => {
    if (tela !== "Todas" && t.tela !== tela) return false;
    if (!q) return true;
    const texto = normalizarBusca([t.termo, t.resumo, t.calculo, t.fonte, t.observacao ?? "", ...(t.busca ?? [])].join(" "));
    return q.split(" ").every((parte) => texto.includes(parte));
  });
}
