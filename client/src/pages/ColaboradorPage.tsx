import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Camera, Check, Copy, Filter, ImageOff, MessageCircle, Phone, Search, Users, X } from "lucide-react";
import { GRUPOS_SERVICO, normalizarTexto, type ColaboradoresPayload, type GrupoServico } from "@shared/colaboradores";
import { FotoColaboradorEditor } from "@/components/FotoColaboradorEditor";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { UfMap } from "@/components/UfMap";
import { trpc } from "@/lib/trpc";
import {
  SEM_UF,
  chaveCliente,
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
  /** Administradores podem enviar/remover a foto do colaborador. */
  ehAdmin?: boolean;
  /** Clientes disponíveis no filtro "Cliente". */
  clientesOpcoes?: string[];
  /** Filtro de cliente aplicado (vem da página Por Cliente ou do próprio filtro). */
  clientesFiltro?: string[];
  onClientesFiltro?: (clientes: string[]) => void;
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

export function ColaboradorPage({ payload, carregando, erro, indiceClientes, emailSelecionado, onSelecionar, onAbrirCliente, usuarioNome, ehAdmin = false, clientesOpcoes = [], clientesFiltro = [], onClientesFiltro = () => {} }: Props) {
  const [buscaColab, setBuscaColab] = useState("");
  const [departamentosSel, setDepartamentosSel] = useState<string[]>([]);
  const [filtroAberto, setFiltroAberto] = useState<string | null>(null);
  const [emailCopiado, setEmailCopiado] = useState(false);
  const filtrosRef = useRef<HTMLDivElement>(null);
  const [aba, setAba] = useState<AbaGrupo>("Todos");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [uf, setUf] = useState<string | null>(null);
  const [somenteAtivos, setSomenteAtivos] = useState(true);
  const [aviso, setAviso] = useState("");
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const salvarFoto = trpc.colaboradores.salvarFoto.useMutation();
  const removerFoto = trpc.colaboradores.removerFoto.useMutation();

  const colaboradores = payload?.colaboradores ?? [];
  const vinculosTodos = payload?.vinculos ?? [];

  // Com filtro de cliente, só entram os vínculos desse(s) cliente(s): a carteira, os contadores
  // e o mapa passam a mostrar somente o que diz respeito a eles.
  const filtroAtivo = clientesFiltro.length > 0;
  const vinculos = useMemo(() => {
    if (!clientesFiltro.length) return vinculosTodos;
    const alvo = new Set(clientesFiltro.map(chaveCliente));
    return vinculosTodos.filter((v) => alvo.has(chaveCliente(v.cliente)));
  }, [vinculosTodos, clientesFiltro]);

  const resumos = useMemo(
    () => resumirColaboradores(colaboradores, vinculos, indiceClientes, somenteAtivos),
    [colaboradores, vinculos, indiceClientes, somenteAtivos],
  );

  const departamentos = useMemo(
    () => Array.from(new Set(colaboradores.map((c) => c.departamento).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [colaboradores],
  );

  // Fecha o menu do filtro ao clicar fora, como na barra de filtros dos Indicadores Gerais.
  useEffect(() => {
    if (!filtroAberto) return;
    const aoClicar = (evento: PointerEvent) => {
      if (!filtrosRef.current?.contains(evento.target as Node)) setFiltroAberto(null);
    };
    document.addEventListener("pointerdown", aoClicar);
    return () => document.removeEventListener("pointerdown", aoClicar);
  }, [filtroAberto]);

  const listaColab = useMemo(() => {
    const termo = normalizarTexto(buscaColab);
    const atendem = filtroAtivo ? new Set(vinculos.map((v) => v.email.toLowerCase())) : null;
    return resumos.filter(({ colaborador }) => {
      if (atendem && !atendem.has(colaborador.email.toLowerCase())) return false;
      if (departamentosSel.length && !departamentosSel.includes(colaborador.departamento)) return false;
      return !termo || normalizarTexto(`${colaborador.nome} ${colaborador.cargo} ${colaborador.email}`).includes(termo);
    });
  }, [resumos, buscaColab, departamentosSel, filtroAtivo, vinculos]);

  // Com filtro de cliente, o colaborador selecionado precisa ser um dos que atendem o cliente.
  useEffect(() => {
    if (!filtroAtivo || !payload || carregando) return;
    if (listaColab.some(({ colaborador }) => colaborador.email === emailSelecionado)) return;
    onSelecionar(listaColab[0]?.colaborador.email ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAtivo, listaColab, emailSelecionado, payload, carregando]);

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

  const avisar = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso(""), 4000);
  };

  const escolherArquivoFoto = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0] ?? null;
    evento.target.value = "";
    if (arquivo) setArquivoFoto(arquivo);
  };

  const gravarFoto = async (imagem: string) => {
    if (!selecionado) return;
    try {
      await salvarFoto.mutateAsync({ email: selecionado.email, imagem });
    } catch (error) {
      throw new Error(error instanceof Error && error.message ? error.message : "Não foi possível salvar a foto.");
    }
    await utils.colaboradores.carteira.invalidate();
    setArquivoFoto(null);
    avisar("Foto atualizada.");
  };

  const apagarFoto = async () => {
    if (!selecionado) return;
    try {
      await removerFoto.mutateAsync({ email: selecionado.email });
      await utils.colaboradores.carteira.invalidate();
      avisar("Foto removida.");
    } catch {
      avisar("Não foi possível remover a foto.");
    }
  };

  const copiarEmail = async () => {
    if (!selecionado) return;
    try {
      await navigator.clipboard.writeText(selecionado.email);
      setEmailCopiado(true);
      window.setTimeout(() => setEmailCopiado(false), 2000);
    } catch {
      setAviso(selecionado.email);
      window.setTimeout(() => setAviso(""), 4000);
    }
  };

  const trocarColaborador = (email: string) => {
    onSelecionar(email);
    setEmailCopiado(false);
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

      {filtroAtivo && (
        <div className="collab-filter-banner" role="status">
          <Filter size={14} />
          <span>
            Filtro aplicado — {clientesFiltro.length === 1 ? "cliente" : "clientes"}: <strong>{clientesFiltro.length === 1 ? clientesFiltro[0] : `${clientesFiltro.length} selecionados`}</strong>
            {" · "}{listaColab.length} {listaColab.length === 1 ? "colaborador atende" : "colaboradores atendem"}
          </span>
          <button type="button" className="clear-filters" onClick={() => { onClientesFiltro([]); setFiltroAberto(null); }}><X size={14} /> Limpar</button>
        </div>
      )}

      {payload?.fonte === "exemplo" && (
        <div className="collab-notice" role="status">
          <strong>Dados de exemplo.</strong> Os colaboradores são fictícios e a carteira foi distribuída automaticamente entre os clientes reais, só para validar a tela. A ligação com o Pipefy ainda não foi configurada.
        </div>
      )}
      {erro && <div className="collab-notice collab-notice-error" role="alert">{erro}</div>}

      <div className="collab-layout">
        <div className="collab-left">
          <section className="panel collab-panel-filtros">
            <div className="panel-header">
              <div className="panel-title-block">
                <div className="panel-icon"><Users size={16} /></div>
                <div><div className="panel-eyebrow">{listaColab.length} COLABORADORES</div><h2>Colaboradores e Prestadores de Serviço</h2></div>
              </div>
            </div>
            <div className="collab-filters" ref={filtrosRef}>
              <label className="collab-search"><Search size={14} /><input value={buscaColab} onChange={(e) => setBuscaColab(e.target.value)} placeholder="Buscar nome ou cargo" aria-label="Buscar colaborador" /></label>
              <MultiSelectFilter
                filterKey="cliente"
                label="Cliente"
                icon={Users}
                value={clientesFiltro}
                options={clientesOpcoes}
                searchable
                onChange={onClientesFiltro}
                openFilter={filtroAberto}
                setOpenFilter={setFiltroAberto}
              />
              <MultiSelectFilter
                filterKey="departamento"
                label="Departamento"
                icon={Building2}
                value={departamentosSel}
                options={departamentos}
                onChange={setDepartamentosSel}
                openFilter={filtroAberto}
                setOpenFilter={setFiltroAberto}
              />
            </div>
            {carregando && !payload ? <p className="collab-empty">Carregando colaboradores…</p> : listaColab.length === 0 ? <p className="collab-empty">{filtroAtivo ? "Nenhum colaborador atende o(s) cliente(s) filtrado(s)." : "Nenhum colaborador encontrado."}</p> : (
              <div className="collab-grid">
                {listaColab.map(({ colaborador, clientes, cnpjs }) => (
                  <button
                    key={colaborador.email}
                    type="button"
                    className={`collab-card ${colaborador.email === emailSelecionado ? "collab-card-active" : ""}`}
                    onClick={() => trocarColaborador(colaborador.email)}
                    aria-pressed={colaborador.email === emailSelecionado}
                  >
                    <Avatar key={colaborador.fotoUrl ?? "sem-foto"} nome={colaborador.nome} fotoUrl={colaborador.fotoUrl} />
                    <strong title={colaborador.nome}>{colaborador.nome}</strong>
                    <small title={colaborador.cargo}>{colaborador.cargo || colaborador.departamento || "—"}</small>
                    <span className="collab-counts">
                      <span className="collab-count">{clientes} {clientes === 1 ? "cliente" : "clientes"}</span>
                      <span className="collab-count collab-count-cnpj" title="CNPJs ativos nos serviços pelos quais responde">{cnpjs} {cnpjs === 1 ? "CNPJ" : "CNPJs"}</span>
                    </span>
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
                {ehAdmin ? (
                  <div className="collab-avatar-edit">
                    <button type="button" className="collab-avatar-button" onClick={() => inputFotoRef.current?.click()} aria-label={`Alterar foto de ${selecionado.nome}`} title="Clique para enviar uma foto">
                      <Avatar key={selecionado.fotoUrl ?? "sem-foto"} nome={selecionado.nome} fotoUrl={selecionado.fotoUrl} grande />
                      <span className="collab-avatar-camera" aria-hidden="true"><Camera size={18} /></span>
                    </button>
                    <input ref={inputFotoRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={escolherArquivoFoto} />
                    {selecionado.fotoOrigem === "upload" && (
                      <button type="button" className="collab-link-button collab-avatar-remove" onClick={apagarFoto} disabled={removerFoto.isPending}>
                        <ImageOff size={11} /> Remover foto
                      </button>
                    )}
                  </div>
                ) : (
                  <Avatar key={selecionado.fotoUrl ?? "sem-foto"} nome={selecionado.nome} fotoUrl={selecionado.fotoUrl} grande />
                )}
                <div className="collab-profile-info">
                  <strong>{selecionado.nome}</strong>
                  <span>{selecionado.cargo}{selecionado.departamento ? ` · ${selecionado.departamento}` : ""}</span>
                  <small className="collab-email">
                    <span>{selecionado.email}</span>
                    <button type="button" className="collab-icon-button" onClick={copiarEmail} aria-label="Copiar e-mail" title={emailCopiado ? "E-mail copiado" : "Copiar e-mail"}>
                      {emailCopiado ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </small>
                  {selecionado.telefone && <small className="collab-phone"><Phone size={12} /> {selecionado.telefone}</small>}
                </div>
                <div className="collab-actions">
                  <button type="button" className="collab-chat-button" onClick={chamar}><MessageCircle size={15} /> Chamar no Google Chat</button>
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
      {ehAdmin && selecionado && arquivoFoto && (
        <FotoColaboradorEditor nome={selecionado.nome} arquivo={arquivoFoto} onCancelar={() => setArquivoFoto(null)} onSalvar={gravarFoto} />
      )}
    </>
  );
}
