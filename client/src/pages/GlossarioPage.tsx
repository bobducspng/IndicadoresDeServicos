import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { GLOSSARIO, TELAS_GLOSSARIO, buscarGlossario, type TelaGlossario } from "@/lib/glossario";

/** Glossário dos indicadores: visível para qualquer usuário autorizado, sem depender dos dados da planilha. */
export function GlossarioPage() {
  const [busca, setBusca] = useState("");
  const [tela, setTela] = useState<TelaGlossario | "Todas">("Todas");

  const encontrados = useMemo(() => buscarGlossario(busca, tela), [busca, tela]);
  const contagemPorTela = useMemo(() => {
    const base = buscarGlossario(busca, "Todas");
    const mapa = new Map<TelaGlossario, number>();
    for (const t of base) mapa.set(t.tela, (mapa.get(t.tela) ?? 0) + 1);
    return { total: base.length, mapa };
  }, [busca]);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow"><span className="status-dot status-dot-blue" /> Ajuda</div>
          <h1>Glossário de indicadores</h1>
          <p>O que cada indicador mede, como é calculado e de onde vêm os dados. Use a busca ou escolha uma tela.</p>
        </div>
      </div>

      <section className="panel glossario-panel">
        <label className="collab-search glossario-search">
          <Search size={14} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar indicador, regra ou palavra" aria-label="Buscar no glossário" />
          {busca && <button type="button" className="clear-filters collab-search-clear" onClick={() => setBusca("")} aria-label="Limpar busca"><X size={14} /> Limpar</button>}
        </label>

        <div className="glossario-chips" role="group" aria-label="Filtrar por tela">
          <button type="button" className={`glossario-chip ${tela === "Todas" ? "glossario-chip-active" : ""}`} onClick={() => setTela("Todas")}>
            Todas <span>{contagemPorTela.total}</span>
          </button>
          {TELAS_GLOSSARIO.map((nome) => (
            <button key={nome} type="button" className={`glossario-chip ${tela === nome ? "glossario-chip-active" : ""}`} onClick={() => setTela(nome)}>
              {nome} <span>{contagemPorTela.mapa.get(nome) ?? 0}</span>
            </button>
          ))}
        </div>

        <p className="glossario-count" role="status">{encontrados.length} de {GLOSSARIO.length} termos</p>

        {encontrados.length === 0 ? (
          <p className="collab-empty">Nenhum termo encontrado para essa busca.</p>
        ) : (
          TELAS_GLOSSARIO.filter((nome) => encontrados.some((t) => t.tela === nome)).map((nome) => (
            <section key={nome} className="glossario-group" aria-label={nome}>
              <h2>{nome}</h2>
              <div className="glossario-grid">
                {encontrados.filter((t) => t.tela === nome).map((t) => (
                  <article key={t.id} className="glossario-card" id={`termo-${t.id}`}>
                    <h3>{t.termo}</h3>
                    <dl>
                      <div><dt>O que mede</dt><dd>{t.resumo}</dd></div>
                      <div><dt>Como é calculado</dt><dd>{t.calculo}</dd></div>
                      <div><dt>Origem dos dados</dt><dd>{t.fonte}</dd></div>
                      {t.observacao && <div className="glossario-obs"><dt>Atenção</dt><dd>{t.observacao}</dd></div>}
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </section>
    </>
  );
}
