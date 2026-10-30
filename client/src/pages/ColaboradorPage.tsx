import { useMemo, useState } from "react";
import { Building2, Check, Copy, MessageCircle, Phone, Search, Users } from "lucide-react";
import { GRUPOS_SERVICO, normalizarTexto, type ColaboradoresPayload, type GrupoServico } from "@shared/colaboradores";
import { UfMap } from "@/components/UfMap";
import {
  SEM_UF,
  carteiraDoColaborador,
  contarClientesPorUf,
  contarPorGrupo,
  iniciais,
  mensagemDeChamada,
  resumirColaboradores,
  urlDoChat,
  type ClienteInfo,
} from "@/lib/colaboradores";

interface Props {
  payload: ColaboradoresPayload | undefined;
  carregando: boolean;
  erro: string | null;
  indiceClientes: Map<string, ClienteInfo>;
  emailSelecionado: string;
  onSelecionar: (email: string) => void;
  onAbrirCliente: (cliente: string) => void;
  usuarioNome?: string | null;
}

type AbaGrupo = "Todos" | GrupoServico;

function Avatar({ nome, fotoUrl, grande = false }: { nome: string; fotoUrl: string | null; grande?: boolean }) {
  const [falhou, setFalhou] = useState(false);
  const classe = grande ? "collab-avatar collab-avatar-lg" : "collab-avatar";
  if (fotoUrl && !falhou) {
    return <img className={classe} src={fotoUrl} alt={nome} referrerPolicy="no-referrer" onError={() => setFalhou(true)} />;
  }
  return <span className={`${classe} collab-avatar-fallback`} aria-hidden="true">{iniciais(nome)}</span>;
}

export function ColaboradorPage({ payload, carregando, erro, indiceClientes, emailSelecionado, onSelecionar, onAbrirCliente, usuarioNome }: Props) {
  const [buscaColab, setBuscaColab] = useState("");
  const [departamento, setDepartamento] = useState("Todos");
  const [aba, setAba] = useState<AbaGrupo>("Todos");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [uf, setUf] = useState<string | null>(null);
  const [somenteAtivos, setSomenteAtivos] = useState(true);
  const [aviso, setAviso] = useState("");

  const colaboradores = payload?.colaboradores ?? [];
  const vinculos = payload?.vinculos ?? [];

  const resumos = useMemo(
    () => resumirColaboradores(colaboradores, vinculos, indiceClientes, somenteAtivos),
    [colaboradores, vinculos, indiceClientes, somenteAtivos],
  );

  const departamentos = useMemo(
    () => ["Todos", ...Array.from(new Set(colaboradores.map((c) => c.departamento).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"))],
    [colaboradores],
  );

  const listaColab = useMemo(() => {
    const termo = normalizarTexto(buscaColab);
    return resumos.filter(({ colaborador }) => {
      if (departamento !== "Todos" && colaborador.departamento !== departamento) return false;
      return !termo || normalizarTexto(`${colaborador.nome} ${colaborador.cargo} ${colaborador.email}`).includes(termo);
    });
  }, [resumos, buscaColab, departamento]);

  const selecionado = colaboradores.find((c) => c.email === emailSelecionado) ?? null;

  const carteiraCompleta = useMemo(
    () => (selecionado ? carteiraDoColaborador(selecionado.email, vinculos, indiceClientes) : []),
    [selecionado, vinculos, indiceClientes],
  );
  const carteiraBase = useMemo(
    () => (somenteAtivos ? carteiraCompleta.filter((c) => c.ativo) : carteiraCompleta),
    [carteiraCompleta, somenteAtivos],
  );
  const porGrupo = useMemo(() => contarPorGrupo(carteiraBase), [carteiraBase]);
  const contagemUf = useMemo(() => contarClientesPorUf(carteiraBase), [carteiraBase]);

  const carteiraFiltrada = useMemo(() => {
    const termo = normalizarTexto(buscaCliente);
    return carteiraBase.filter((cliente) => {
      if (aba !== "Todos" && !cliente.grupos.includes(aba)) return false;
      if (uf && !(uf === SEM_UF ? cliente.estados.length === 0 : cliente.estados.includes(uf))) return false;
      return !termo || normalizarTexto(`${cliente.nome} ${cliente.marca} ${cliente.cidades.join(" ")}`).includes(termo);
    });
  }, [carteiraBase, aba, uf, buscaCliente]);

  const chamar = async () => {
    if (!selecionado) return;
    const url = urlDoChat(selecionado.email);
    let copiou = false;
    try {
      await navigator.clipboard.writeText(mensagemDeChamada(selecionado, usuarioNome));
      copiou = true;
    } catch {
      copiou = false;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    setAviso(copiou ? "Mensagem copiada. Cole no Google Chat e procure pelo colaborador." : "Google Chat aberto. Procure pelo colaborador pelo e-mail.");
    window.setTimeout(() => setAviso(""), 6000);
  };

  const copiarEmail = async () => {
    if (!selecionado) return;
    try {
      await navigator.clipboard.writeText(selecionado.email);
      setAviso("E-mail copiado.");
    } catch {
      setAviso(selecionado.email);
    }
    window.setTimeout(() => setAviso(""), 4000);
  };

  const trocarColaborador = (email: string) => {
    onSelecionar(email);
    setUf(null);
    setAba("Todos");
    setBuscaCliente("");
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow"><span className="status-dot status-dot-blue" /> Recorte por colaborador</div>
          <h1>{selecionado?.nome ?? "Visão por colaborador"}</h1>
          <p>{selecionado ? `${selecionado.cargo || "Colaborador"}${selecionado.departamento ? ` · ${selecionado.departamento}` : ""}` : "Escolha um colaborador para ver a carteira de clientes sob a responsabilidade dele."}</p>
        </div>
        <label className="collab-toggle">
          <input type="checkbox" checked={somenteAtivos} onChange={(e) => setSomenteAtivos(e.target.checked)} />
          <span>Somente clientes ativos</span>
        </label>
      </div>

      {payload?.fonte === "exemplo" && (
        <div className="collab-notice" role="status">
          <strong>Dados de exemplo.</strong> Os colaboradores são fictícios e a carteira foi distribuída automaticamente entre os clientes reais, só para validar a tela. A ligação com o Pipefy ainda não foi configurada.
        </div>
      )}
      {erro && <div className="collab-notice collab-notice-error" role="alert">{erro}</div>}

      <div className="collab-layout">
        <div className="collab-left">
          <section className="panel">
            <div className="panel-header">
              <div className="panel-title-block">
                <div className="panel-icon"><Users size={16} /></div>
                <div><div className="panel-eyebrow">{listaColab.length} COLABORADORES</div><h2>Colaboradores e Prestadores de Serviço</h2></div>
              </div>
            </div>
            <div className="collab-filters">
              <label className="collab-search"><Search size={14} /><input value={buscaColab} onChange={(e) => setBuscaColab(e.target.value)} placeholder="Buscar nome ou cargo" aria-label="Buscar colaborador" /></label>
              <select value={departamento} onChange={(e) => setDepartamento(e.target.value)} aria-label="Filtrar por departamento">
                {departamentos.map((d) => <option key={d} value={d}>{d === "Todos" ? "Todos os departamentos" : d}</option>)}
              </select>
            </div>
            {carregando && !payload ? <p className="collab-empty">Carregando colaboradores…</p> : listaColab.length === 0 ? <p className="collab-empty">Nenhum colaborador encontrado.</p> : (
              <div className="collab-grid">
                {listaColab.map(({ colaborador, clientes }) => (
                  <button
                    key={colaborador.email}
                    type="button"
                    className={`collab-card ${colaborador.email === emailSelecionado ? "collab-card-active" : ""}`}
                    onClick={() => trocarColaborador(colaborador.email)}
                    aria-pressed={colaborador.email === emailSelecionado}
                  >
                    <Avatar nome={colaborador.nome} fotoUrl={colaborador.fotoUrl} />
                    <strong title={colaborador.nome}>{colaborador.nome}</strong>
                    <small title={colaborador.cargo}>{colaborador.cargo || colaborador.departamento || "—"}</small>
                    <span className="collab-count">{clientes} {clientes === 1 ? "cliente" : "clientes"}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div className="panel-title-block">
                <div className="panel-icon"><Building2 size={16} /></div>
                <div><div className="panel-eyebrow">CLIENTES POR ESTADO</div><h2>{selecionado ? `Carteira de ${selecionado.nome.split(" ")[0]}` : "Mapa do Brasil"}</h2></div>
              </div>
              {uf && <button type="button" className="collab-link-button" onClick={() => setUf(null)}>Limpar estado ({uf})</button>}
            </div>
            <UfMap contagem={contagemUf} ufSelecionada={uf} onSelecionar={setUf} />
          </section>
        </div>

        <section className="panel collab-right">
          {!selecionado ? (
            <div className="client-empty-state">
              <div className="client-empty-icon"><Users size={24} /></div>
              <h2>Selecione um colaborador</h2>
              <p>Clique em um colaborador para listar todos os clientes dele e chamá-lo pelo Google Chat.</p>
            </div>
          ) : (
            <>
              <div className="collab-profile">
                <Avatar nome={selecionado.nome} fotoUrl={selecionado.fotoUrl} grande />
                <div className="collab-profile-info">
                  <strong>{selecionado.nome}</strong>
                  <span>{selecionado.cargo}{selecionado.departamento ? ` · ${selecionado.departamento}` : ""}</span>
                  <small>{selecionado.email}</small>
                  {selecionado.telefone && <small className="collab-phone"><Phone size={12} /> {selecionado.telefone}</small>}
                </div>
                <div className="collab-actions">
                  <button type="button" className="collab-chat-button" onClick={chamar}><MessageCircle size={15} /> Chamar no Google Chat</button>
                  <button type="button" className="collab-ghost-button" onClick={copiarEmail}><Copy size={14} /> Copiar e-mail</button>
                </div>
              </div>
              {aviso && <div className="collab-toast" role="status"><Check size={13} /> {aviso}</div>}

              <div className="collab-tabs" role="tablist" aria-label="Grupo de serviço">
                {(["Todos", ...GRUPOS_SERVICO] as AbaGrupo[]).map((g) => {
                  const total = g === "Todos" ? carteiraBase.length : porGrupo[g];
                  if (g !== "Todos" && total === 0) return null;
                  return (
                    <button key={g} type="button" role="tab" aria-selected={aba === g} className={`collab-tab ${aba === g ? "collab-tab-active" : ""}`} onClick={() => setAba(g)}>
                      {g} <b>{total}</b>
                    </button>
                  );
                })}
              </div>

              <label className="collab-search collab-search-wide"><Search size={14} /><input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar cliente, marca ou cidade" aria-label="Buscar cliente" /></label>

              <div className="collab-clients-head">
                <span>{carteiraFiltrada.length} de {carteiraBase.length} clientes{uf ? ` em ${uf}` : ""}</span>
              </div>

              {carteiraFiltrada.length === 0 ? (
                <p className="collab-empty">{carteiraBase.length === 0 ? "Este colaborador ainda não tem clientes vinculados." : "Nenhum cliente com esses filtros."}</p>
              ) : (
                <ul className="collab-clients">
                  {carteiraFiltrada.map((cliente) => (
                    <li key={cliente.nome}>
                      <button type="button" className="collab-client" onClick={() => onAbrirCliente(cliente.nome)} title="Abrir na visão Por Cliente">
                        <div className="collab-client-main">
                          <strong>{cliente.nome}</strong>
                          <small>
                            {cliente.marca || "Sem marca"}
                            {cliente.estados.length ? ` · ${cliente.estados.join(", ")}` : ""}
                            {!cliente.ativo ? " · inativo" : ""}
                            {cliente.semVigencia ? " · sem vigência" : ""}
                          </small>
                        </div>
                        <div className="collab-chips">
                          {cliente.funcoes.map((f) => <span key={f} className="collab-chip">{f}</span>)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
