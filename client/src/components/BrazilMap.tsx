import { useMemo, useState } from "react";
import { Layers, Map as MapIcon } from "lucide-react";
import { MapView } from "@/components/Map";
import { STATE_COORDINATES, formatNumber, type DashboardSnapshot } from "@/lib/dashboard";
import mapData from "@/data/brazil-state-paths.json";

interface StateFeature {
  uf: string;
  name: string;
  d: string;
  center: [number, number];
}

interface StateClientRanking {
  client: string;
  services: number;
}

const stateFeatures = (mapData.features ?? []) as StateFeature[];

export function BrazilMap({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [mode, setMode] = useState<"choropleth" | "google">("choropleth");
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  const stateCounts = useMemo(() => {
    const map = new Map<string, number>();
    snapshot.stateCounts.forEach((item) => map.set(item.state, item.value));
    return { map, max: Math.max(...snapshot.stateCounts.map((item) => item.value), 1) };
  }, [snapshot.stateCounts]);

  const stateClientRankings = useMemo(() => {
    const byState = new Map<string, Map<string, Set<string>>>();
    snapshot.activeRows.forEach((row) => {
      const state = String(row["Estado"] ?? "").trim().toUpperCase();
      const client = String(row["Cliente"] ?? "").trim();
      const service = String(row["Serviço"] ?? "").trim();
      if (!state || !client) return;
      const clients = byState.get(state) ?? new Map<string, Set<string>>();
      const services = clients.get(client) ?? new Set<string>();
      services.add(service || "Não informado");
      clients.set(client, services);
      byState.set(state, clients);
    });

    return new Map<string, StateClientRanking[]>(
      Array.from(byState.entries()).map(([state, clients]) => [
        state,
        Array.from(clients.entries())
          .map(([client, services]) => ({ client, services: services.size }))
          .sort((a, b) => b.services - a.services || a.client.localeCompare(b.client, "pt-BR"))
          .slice(0, 3),
      ]),
    );
  }, [snapshot.activeRows]);

  const geoRows = snapshot.activeRows.filter((row) => String(row["Cidade"] ?? "").trim() && String(row["Estado"] ?? "").trim()).length;
  const geoCoverage = snapshot.activeRows.length ? Math.round((geoRows / snapshot.activeRows.length) * 100) : 0;
  const colorForCount = (count: number) => {
    if (!count) return "#101e36";
    const ratio = count / stateCounts.max;
    if (ratio > 0.7) return "#2f7dff";
    if (ratio > 0.4) return "#245fc2";
    if (ratio > 0.2) return "#1b468d";
    if (ratio > 0.08) return "#143265";
    return "#11264c";
  };

  const hoveredFeature = hoveredState ? stateFeatures.find((state) => state.uf === hoveredState) : null;
  const hoveredCount = hoveredState ? stateCounts.map.get(hoveredState) ?? 0 : 0;
  const hoveredShare = snapshot.kpis.clients ? (hoveredCount / snapshot.kpis.clients) * 100 : 0;
  const hoveredRanking = hoveredState ? stateClientRankings.get(hoveredState) ?? [] : [];
  const hoveredTooltipStyle = hoveredFeature
    ? {
        left: `${(hoveredFeature.center[0] / 500) * 100}%`,
        top: `${(hoveredFeature.center[1] / 535) * 100}%`,
        transform: hoveredFeature.center[0] > 315 ? "translate(-104%, -50%)" : "translate(14px, -50%)",
      }
    : undefined;

  return (
    <div className="geo-map-card">
      <div className="geo-map-toolbar">
        <div className="geo-map-meta">
          <span className="coverage-badge"><span className="status-dot status-dot-live" /> {geoCoverage}% com cidade/UF</span>
          <span className="coverage-sub">{formatNumber(snapshot.kpis.clients)} clientes únicos ativos</span>
        </div>
        <div className="map-mode-toggle">
          <button className={`mode-button ${mode === "choropleth" ? "mode-button-active" : ""}`} onClick={() => setMode("choropleth")}>
            <Layers size={13} /><span>Mapa por Estados</span>
          </button>
          <button className={`mode-button ${mode === "google" ? "mode-button-active" : ""}`} onClick={() => setMode("google")}>
            <MapIcon size={13} /><span>Satélite / Vias</span>
          </button>
        </div>
      </div>

      {mode === "choropleth" ? (
        <div className="vector-map-wrapper choropleth-wrapper">
          <div className="brazil-map-stage">
            <svg viewBox="0 0 500 535" className="brazil-vector-map" role="img" aria-label="Mapa real do Brasil por clientes ativos em cada estado">
              <rect width="500" height="535" rx="14" className="vector-map-bg" />
              <g className="states-group">
                {stateFeatures.map((state) => {
                  const count = stateCounts.map.get(state.uf) ?? 0;
                  const isSelected = selectedState === state.uf;
                  const isHovered = hoveredState === state.uf;
                  return (
                    <g
                      key={state.uf}
                      className={`state-shape-group ${isSelected ? "state-shape-selected" : ""}`}
                      onClick={() => setSelectedState(isSelected ? null : state.uf)}
                      onMouseEnter={() => setHoveredState(state.uf)}
                      onMouseLeave={() => setHoveredState(null)}
                      aria-label={`${state.name}: ${formatNumber(count)} clientes`}
                    >
                      <title>{`${state.name}: ${formatNumber(count)} clientes`}</title>
                      <path d={state.d} fill={colorForCount(count)} className="state-shape-path" />
                      <circle cx={state.center[0]} cy={state.center[1]} r={count ? 11 : 8} className="state-node-circle" />
                      <text x={state.center[0]} y={state.center[1] - 1} className="state-node-uf">{state.uf}</text>
                      <text x={state.center[0]} y={state.center[1] + 7} className="state-node-count">{count || "—"}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
            {hoveredFeature && (
              <div className="state-hover-tooltip" style={hoveredTooltipStyle} role="status">
                <div className="state-tooltip-kicker"><span className="status-dot status-dot-live" /> Estado em foco</div>
                <div className="state-tooltip-title">{hoveredFeature.name} <span>({hoveredFeature.uf})</span></div>
                <div className="state-tooltip-metrics">
                  <strong>{formatNumber(hoveredCount)}</strong>
                  <span>clientes ativos</span>
                  <b>{formatNumber(hoveredShare, 1)}%</b>
                  <span>da carteira</span>
                </div>
                <div className="state-tooltip-divider" />
                <div className="state-tooltip-ranking-title">Principais clientes</div>
                {hoveredRanking.length ? hoveredRanking.map((item, index) => (
                  <div className="state-tooltip-ranking-row" key={item.client}>
                    <span><i>{index + 1}</i>{item.client}</span>
                    <strong>{item.services} {item.services === 1 ? "serviço" : "serviços"}</strong>
                  </div>
                )) : <div className="state-tooltip-empty">Nenhum cliente com estado informado</div>}
              </div>
            )}
          </div>

          <div className="map-legend-side">
            <div className="legend-title">Clientes por Estado</div>
            <div className="legend-pills legend-pills-clean">
              {snapshot.stateCounts.slice(0, 7).map((item) => (
                <button key={item.state} className={`state-chip ${selectedState === item.state ? "state-chip-active" : ""}`} onClick={() => setSelectedState(selectedState === item.state ? null : item.state)}>
                  <strong>{item.state}</strong><span>{formatNumber(item.value)} clientes</span>
                </button>
              ))}
            </div>
            {selectedState && <div className="state-selection-card"><div><small>Estado selecionado</small><strong>{stateFeatures.find((state) => state.uf === selectedState)?.name ?? selectedState} ({selectedState})</strong></div><span>{formatNumber(stateCounts.map.get(selectedState) ?? 0)} clientes</span></div>}
            <div className="map-gradient-scale"><span>Menos</span><div className="gradient-bar" /><span>Mais clientes</span></div>
          </div>
        </div>
      ) : (
        <div className="google-map-frame">
          <MapView className="google-map" initialCenter={{ lat: -14.3, lng: -52.4 }} initialZoom={4} onMapReady={(map) => {
            snapshot.stateCounts.slice(0, 18).forEach((item, index) => {
              const coordinates = STATE_COORDINATES[item.state];
              if (!coordinates) return;
              new window.google!.maps.Marker({ map, position: coordinates, title: `${item.state}: ${formatNumber(item.value)} clientes ativos`, label: { text: String(index + 1), color: "#ffffff", fontSize: "10px", fontWeight: "700" } });
            });
          }} />
        </div>
      )}
    </div>
  );
}
