import { useMemo, useState } from "react";
import mapData from "@/data/brazil-state-paths.json";

interface StateFeature {
  uf: string;
  name: string;
  d: string;
  center: [number, number];
}

const features = (mapData.features ?? []) as StateFeature[];

const ESCALA = ["#101e36", "#11264c", "#143265", "#1b468d", "#245fc2", "#2f7dff"];

function corPorContagem(valor: number, maximo: number): string {
  if (!valor) return ESCALA[0];
  const razao = valor / Math.max(maximo, 1);
  if (razao > 0.7) return ESCALA[5];
  if (razao > 0.4) return ESCALA[4];
  if (razao > 0.2) return ESCALA[3];
  if (razao > 0.08) return ESCALA[2];
  return ESCALA[1];
}

interface UfMapProps {
  contagem: Map<string, number>;
  ufSelecionada: string | null;
  onSelecionar: (uf: string | null) => void;
  rotulo?: string;
}

/** Mapa do Brasil por UF, com a contagem de clientes de uma carteira. */
export function UfMap({ contagem, ufSelecionada, onSelecionar, rotulo = "clientes" }: UfMapProps) {
  const [foco, setFoco] = useState<string | null>(null);
  const maximo = useMemo(() => Math.max(1, ...Array.from(contagem.values())), [contagem]);
  const emFoco = foco ? features.find((f) => f.uf === foco) : null;

  return (
    <div className="uf-map">
      <svg viewBox="0 0 500 535" className="brazil-vector-map" role="img" aria-label={`Mapa do Brasil com ${rotulo} por UF`}>
        <rect width="500" height="535" rx="14" className="vector-map-bg" />
        <g>
          {features.map((estado) => {
            const total = contagem.get(estado.uf) ?? 0;
            const selecionado = ufSelecionada === estado.uf;
            return (
              <g
                key={estado.uf}
                className={`state-shape-group ${selecionado ? "state-shape-selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={selecionado}
                aria-label={`${estado.name}: ${total} ${rotulo}`}
                onClick={() => onSelecionar(selecionado ? null : estado.uf)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelecionar(selecionado ? null : estado.uf);
                  }
                }}
                onMouseEnter={() => setFoco(estado.uf)}
                onMouseLeave={() => setFoco(null)}
              >
                <title>{`${estado.name}: ${total} ${rotulo}`}</title>
                <path d={estado.d} fill={corPorContagem(total, maximo)} className="state-shape-path" />
                <circle cx={estado.center[0]} cy={estado.center[1]} r={total ? 11 : 8} className="state-node-circle" />
                <text x={estado.center[0]} y={estado.center[1] - 1} className="state-node-uf">{estado.uf}</text>
                <text x={estado.center[0]} y={estado.center[1] + 7} className="state-node-count">{total || "—"}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="uf-map-caption" role="status">
        {emFoco
          ? <><strong>{emFoco.name} ({emFoco.uf})</strong><span>{contagem.get(emFoco.uf) ?? 0} {rotulo}</span></>
          : <span>Passe o mouse ou clique em um estado para filtrar a lista.</span>}
      </div>
    </div>
  );
}
