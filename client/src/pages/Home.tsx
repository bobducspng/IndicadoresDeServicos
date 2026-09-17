import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Database,
  Filter,
  Layers3,
  Map as MapIcon,
  Menu,
  Moon,
  RefreshCw,
  Settings2,
  Store,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { BrazilMap } from "@/components/BrazilMap";
import { LoginOverlay } from "@/components/LoginOverlay";
import { UserManagementModal } from "@/components/UserManagementModal";
import { trpc } from "@/lib/trpc";
import { LogOut, Shield } from "lucide-react";
import { fetchDashboardSheets, getInitialSheets, mergeDashboardSheets, spreadsheetSource, type DashboardSheets } from "@/lib/sheets";
import {
  DEFAULT_FILTERS,
  PERIOD_OPTIONS,
  asText,
  buildClientOptions,
  buildFilterOptions,
  deriveClientDetail,
  deriveSnapshot,
  filterDataByAllowedServices,
  formatDate,
  formatNumber,
  formatPeriodDate,
  normalize,
  type DashboardSnapshot,
  type ClientDetail,
  type DashboardView,
  type FilterOptions,
  type FilterState,
  type PeriodPreset,
} from "@/lib/dashboard";

const EXPANDED_MARK = "/manus-storage/menu-expanded_4134ee4e.png";
const COLLAPSED_MARK = "/manus-storage/menu-collapsed_962cea64.png";

type Tone = "blue" | "teal" | "amber" | "violet" | "boticario";

type SyncLogItem = {
  at: string;
  status: "success" | "warning" | "error";
  message: string;
  counts: string;
};

const SERVICE_COLORS = ["#2f7dff", "#19c6a3", "#f6bf4b", "#fb5b72", "#9b7bf8", "#5da0ff", "#62e0c7", "#d5a7ff"];

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function useDashboardData(enabled: boolean) {
  const [data, setData] = useState<DashboardSheets>(() => getInitialSheets());
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setError("");
    setLoading(true);
    fetchDashboardSheets()
      .then((nextData) => {
        if (!active) return;
        const merged = mergeDashboardSheets(data, nextData);
        const now = new Date().toISOString();
        const counts = `${merged.data.fatos.length.toLocaleString("pt-BR")} fatos · ${merged.data.vigencia.length.toLocaleString("pt-BR")} vigências · ${merged.data.baseMensal.length.toLocaleString("pt-BR")} meses`;
        const partial = merged.partialSheets.length > 0;
        setData(merged.data);
        setSyncNotice(partial ? "A atualização pública retornou uma aba incompleta; mantivemos essa aba com a última leitura completa." : "");
        const log: SyncLogItem = {
          at: now,
          status: partial ? "warning" : "success",
          message: partial ? `Atualização parcial · ${merged.partialSheets.join(", ")}` : "Base atualizada com sucesso",
          counts,
        };
        setSyncLogs((current) => [log, ...current].slice(0, 8));
      })
      .catch((cause: unknown) => {
        if (active) {
          const message = cause instanceof Error ? cause.message : "Não foi possível atualizar os dados públicos.";
          setError(message);
          setSyncNotice(message);
          const log: SyncLogItem = { at: new Date().toISOString(), status: "error", message: "Falha na atualização", counts: message };
          setSyncLogs((current) => [log, ...current].slice(0, 8));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [enabled, refreshKey]);

  return { data, loading, error, syncNotice, syncLogs, refresh: () => { setLoading(true); setRefreshKey((value) => value + 1); } };
}

function LogoMark({ collapsed }: { collapsed: boolean }) {
  return <img src={collapsed ? COLLAPSED_MARK : EXPANDED_MARK} alt="Indicadores de Serviços" className={collapsed ? "brand-mark brand-mark-collapsed" : "brand-mark"} />;
}

function Sidebar({ collapsed, setCollapsed, view, setView, mobileOpen, onCloseMobile, user, onLogout }: { collapsed: boolean; setCollapsed: (value: boolean) => void; view: DashboardView; setView: (value: DashboardView) => void; mobileOpen: boolean; onCloseMobile: () => void; user: any; onLogout: () => void }) {
  const goTo = (nextView: DashboardView) => {
    setView(nextView);
    window.history.replaceState({}, "", nextView === "client" ? "/clientes" : nextView === "access" ? "/cadastro" : "/");
    onCloseMobile();
  };

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}>
      <div className="sidebar-brand">
        <LogoMark collapsed={collapsed} />
        <button className="icon-button sidebar-toggle" aria-label={mobileOpen ? "Fechar menu" : collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => mobileOpen ? onCloseMobile() : setCollapsed(!collapsed)}>{mobileOpen || !collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>
      </div>
      <div className="sidebar-section-label">Navegação</div>
      <nav className="sidebar-nav" aria-label="Navegação principal">
        <button className={`nav-item ${view === "general" ? "nav-item-active" : ""}`} onClick={() => goTo("general")} title="Indicadores Gerais"><BarChart3 size={17} /><span>Indicadores Gerais</span></button>
        <button className={`nav-item ${view === "client" ? "nav-item-active" : ""}`} onClick={() => goTo("client")} title="Por Cliente"><Users size={17} /><span>Por Cliente</span></button>
        {user?.role === "admin" && (
          <button
            type="button"
            className={`nav-item nav-item-admin ${view === "access" ? "nav-item-active" : ""}`}
            onClick={() => goTo("access")}
            title="Cadastro de usuários autorizados"
          >
            <Shield size={17} />
            <span>Cadastro</span>
          </button>
        )}
      </nav>
      <div className="sidebar-section-label sidebar-section-secondary">Contexto</div>
      <div className="sidebar-context-list">
        <div className="sidebar-context-item"><Activity size={15} /><span>Movimentação</span></div>
        <div className="sidebar-context-item"><Layers3 size={15} /><span>Distribuição por serviço</span></div>
        <div className="sidebar-context-item"><MapIcon size={15} /><span>Base geográfica</span></div>
      </div>
      <div className="sidebar-user-footer">
        <div className="sidebar-user-avatar-wrap">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name || "Usuário"} className="sidebar-user-photo" onError={(e) => { (e.target as HTMLElement).style.display = "none"; }} />
          ) : (
            <div className="sidebar-user-photo-fallback">
              {(user?.name || user?.email || "U").slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="sidebar-user-meta">
          <strong className="sidebar-user-name" title={user?.name || user?.email || "Usuário"}>
            {user?.name ? user.name.split(" ")[0] : "Usuário"}
          </strong>
          <span className="sidebar-user-role">
            {user?.role === "admin" ? "ADMINISTRADOR" : "USUÁRIO"}
          </span>
          <span className="sidebar-user-email" title={user?.email || ""}>
            {user?.email || ""}
          </span>
        </div>
        <div className="sidebar-user-actions">
          {user?.role === "admin" && (
            <button
              type="button"
              className="sidebar-action-btn"
              onClick={() => goTo("access")}
              title="Abrir Cadastro"
              aria-label="Abrir Cadastro"
            >
              <Settings2 size={15} />
            </button>
          )}
          <button
            type="button"
            className="sidebar-action-btn sidebar-logout-btn"
            onClick={onLogout}
            title="Sair do sistema"
            aria-label="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function formatSyncDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value));
}

function TopHeader({ onMenu, theme, setTheme, onRefresh, loading, syncLogs, view }: { onMenu: () => void; theme: "dark" | "light"; setTheme: (value: "dark" | "light") => void; onRefresh: () => void; loading: boolean; syncLogs: SyncLogItem[]; view: DashboardView }) {
  const [showSyncLog, setShowSyncLog] = useState(false);
  const breadcrumb = view === "access" ? "Cadastro" : view === "client" ? "Visão por cliente" : "Visão executiva";
  return (
    <header className="top-header">
      <div className="top-header-left">
        <button className="mobile-menu-button icon-button" onClick={onMenu} aria-label="Abrir menu"><Menu size={18} /></button>
        <div className="breadcrumbs"><span>Indicadores de Serviços</span><ChevronRight size={14} /><strong>{breadcrumb}</strong></div>
      </div>
      <div className="top-header-actions">
        <a className="source-link" href={spreadsheetSource} target="_blank" rel="noreferrer"><Database size={14} /> Fonte Sheets <ChevronRight size={13} /></a>
        <div className="sync-log-anchor">
          <button className="sync-status sync-status-button" onClick={() => setShowSyncLog((value) => !value)} aria-expanded={showSyncLog}><span className={`status-dot ${loading ? "status-dot-warning" : "status-dot-live"}`} /> {loading ? "atualizando base" : syncLogs[0] ? `atualizado ${formatSyncDate(syncLogs[0].at)}` : "atualização pública"}</button>
          {showSyncLog && <div className="sync-log-popover" role="dialog" aria-label="Histórico de sincronização"><div className="sync-log-title"><strong>Histórico de sincronização</strong><span>{syncLogs.length} registros</span></div>{syncLogs.length ? syncLogs.map((log, index) => <div className="sync-log-item" key={`${log.at}-${index}`}><span className={`sync-log-dot sync-log-dot-${log.status}`} /><div><strong>{log.message}</strong><small>{formatSyncDate(log.at)}</small><small>{log.counts}</small></div></div>) : <p className="sync-log-empty">Nenhuma sincronização concluída nesta sessão.</p>}</div>}
        </div>
        <button className="reconnect-button" onClick={onRefresh}><RefreshCw size={13} className={loading ? "spin-icon" : ""} /> Reconectar</button>
        <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
      </div>
    </header>
  );
}

function MultiSelectFilter({ filterKey, label, value, options, icon: Icon, onChange, openFilter, setOpenFilter }: { filterKey: string; label: string; value: string[]; options: string[]; icon: typeof Filter; onChange: (value: string[]) => void; openFilter: string | null; setOpenFilter: (value: string | null) => void }) {
  const open = openFilter === filterKey;
  const toggle = (option: string) => {
    onChange(value.some((item) => item === option) ? value.filter((item) => item !== option) : [...value, option]);
    setOpenFilter(null);
  };
  const summary = value.length === 0 ? "Todos" : value.length === 1 ? value[0] : `${value.length} selecionados`;
  return (
    <div className={`multi-select-filter ${open ? "multi-select-filter-open" : ""}`}>
      <button className="multi-select-trigger" onClick={() => setOpenFilter(open ? null : filterKey)} aria-expanded={open}>
        <Icon size={14} /><span className="multi-select-copy"><small>{label}</small><strong title={summary}>{summary}</strong></span><ChevronDown size={14} className="multi-select-chevron" />
      </button>
      {open && <div className="multi-select-menu">
        <div className="multi-select-menu-head"><span>{label}</span><button onClick={() => { onChange([]); setOpenFilter(null); }}>Limpar</button></div>
        <div className="multi-select-options">
          {options.map((option) => <button key={option} className={`multi-select-option ${value.includes(option) ? "multi-select-option-selected" : ""}`} onClick={() => toggle(option)}><span>{option}</span>{value.includes(option) && <Check size={14} />}</button>)}
          {!options.length && <div className="multi-select-empty">Nenhuma opção disponível</div>}
        </div>
      </div>}
    </div>
  );
}

function PeriodFilter({ value, onChange, openFilter, setOpenFilter }: { value: FilterState["period"]; onChange: (value: FilterState["period"]) => void; openFilter: string | null; setOpenFilter: (value: string | null) => void }) {
  const open = openFilter === "period";
  const selected = PERIOD_OPTIONS.find((option) => option.value === value) ?? PERIOD_OPTIONS[0];
  return (
    <div className={`multi-select-filter period-filter ${open ? "multi-select-filter-open" : ""}`}>
      <button className="multi-select-trigger" onClick={() => setOpenFilter(open ? null : "period")} aria-expanded={open}><CalendarClock size={14} /><span className="multi-select-copy"><small>Período</small><strong>{selected.label}</strong></span><ChevronDown size={14} className="multi-select-chevron" /></button>
      {open && <div className="multi-select-menu period-menu"><div className="multi-select-menu-head"><span>Recorte posterior ao ano</span><button onClick={() => { onChange("last6"); setOpenFilter(null); }}>Limpar</button></div><div className="multi-select-options period-options">{PERIOD_OPTIONS.map((option) => <button key={option.value} className={`multi-select-option ${value === option.value ? "multi-select-option-selected" : ""}`} onClick={() => { onChange(option.value); setOpenFilter(null); }}><span>{option.label}</span>{value === option.value && <Check size={14} />}</button>)}</div></div>}
    </div>
  );
}

function YearFilter({ value, years, onChange, openFilter, setOpenFilter }: { value: string; years: string[]; onChange: (value: string) => void; openFilter: string | null; setOpenFilter: (value: string | null) => void }) {
  const open = openFilter === "year";
  const label = value === "all" ? "Selecionar ano" : value;
  return <div className={`multi-select-filter year-filter ${open ? "multi-select-filter-open" : ""}`}>
    <button className="multi-select-trigger" onClick={() => setOpenFilter(open ? null : "year")} aria-expanded={open}><CalendarClock size={14} /><span className="multi-select-copy"><small>Ano</small><strong>{label}</strong></span><ChevronDown size={14} className="multi-select-chevron" /></button>
    {open && <div className="multi-select-menu period-menu"><div className="multi-select-menu-head"><span>Ano de referência</span><button onClick={() => { onChange("all"); setOpenFilter(null); }}>Limpar</button></div><div className="multi-select-options period-options"><button className={`multi-select-option ${value === "all" ? "multi-select-option-selected" : ""}`} onClick={() => { onChange("all"); setOpenFilter(null); }}><span>Selecionar ano</span>{value === "all" && <Check size={14} />}</button>{years.map((option) => <button key={option} className={`multi-select-option ${value === option ? "multi-select-option-selected" : ""}`} onClick={() => { onChange(option); setOpenFilter(null); }}><span>{option}</span>{value === option && <Check size={14} />}</button>)}</div></div>}
  </div>;
}

function FilterBar({ filters, setFilters, options, onClear }: { filters: FilterState; setFilters: (next: FilterState) => void; options: FilterOptions; onClear: () => void }) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const filterBarRef = useRef<HTMLElement>(null);
  const hasFilters = filters.regions.length + filters.services.length + filters.brands.length > 0 || filters.period !== "last6" || filters.year !== "all";
  useEffect(() => {
    if (!openFilter) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!filterBarRef.current?.contains(event.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openFilter]);
  return (
    <section ref={filterBarRef} className="filter-bar filter-bar-reference" aria-label="Filtros globais">
      <div className="filter-bar-heading"><div className="filter-bar-title"><Filter size={15} /><strong>Filtros globais</strong><span>selecione uma ou mais opções</span></div><span className="filter-period-note">Padrão: últimos 6 meses · dados até {formatDate(options.latestDate)}</span></div>
      <div className="filter-controls filter-controls-reference">
        <MultiSelectFilter filterKey="regions" label="Segmento" value={filters.regions} options={options.regions} icon={Layers3} onChange={(regions) => setFilters({ ...filters, regions })} openFilter={openFilter} setOpenFilter={setOpenFilter} />
        <MultiSelectFilter filterKey="brands" label="Marca / clube" value={filters.brands} options={options.brands} icon={Target} onChange={(brands) => setFilters({ ...filters, brands })} openFilter={openFilter} setOpenFilter={setOpenFilter} />
        <MultiSelectFilter filterKey="services" label="Serviços" value={filters.services} options={options.services} icon={Zap} onChange={(services) => setFilters({ ...filters, services })} openFilter={openFilter} setOpenFilter={setOpenFilter} />
        <YearFilter value={filters.year} years={options.years} onChange={(year) => setFilters({ ...filters, year })} openFilter={openFilter} setOpenFilter={setOpenFilter} />
        <PeriodFilter value={filters.period} onChange={(period) => setFilters({ ...filters, period })} openFilter={openFilter} setOpenFilter={setOpenFilter} />
        {hasFilters && <button className="clear-filters" onClick={() => { onClear(); setOpenFilter(null); }}><X size={14} /> Limpar</button>}
      </div>
    </section>
  );
}

function KpiCard({ icon: Icon, label, value, detail, tone, trend, trendPositive }: { icon: typeof Activity; label: string; value: string; detail: string; tone: Tone; trend?: string; trendPositive?: boolean }) {
  return <article className="kpi-card"><div className={`kpi-icon kpi-icon-${tone}`}><Icon size={17} /></div><div className="kpi-label">{label}</div><div className="kpi-value-row"><strong>{value}</strong>{trend && <span className={`kpi-trend ${trendPositive === false ? "kpi-trend-negative" : `kpi-trend-${tone}`}`}>{trendPositive === false ? <TrendingDown size={12} /> : <TrendingUp size={12} />}{trend}</span>}</div><div className="kpi-detail">{detail}</div></article>;
}

function Panel({ title, eyebrow, icon: Icon, children, className = "" }: { title: string; eyebrow?: string; icon?: typeof Activity; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-header"><div className="panel-title-block">{Icon && <div className="panel-icon"><Icon size={16} /></div>}<div><div className="panel-eyebrow">{eyebrow}</div><h2>{title}</h2></div></div><button className="panel-menu" aria-label={`Opções de ${title}`}><Settings2 size={14} /></button></div>{children}</section>;
}

function formatMovementDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function MovementList({ title, items, tone }: { title: string; items: DashboardSnapshot["newClients"]; tone: "positive" | "negative" }) {
  return <div className={`movement-list movement-list-${tone}`}>
    <div className="movement-scroll" tabIndex={0} aria-label={title}>
      {items.length ? items.map((item, index) => <div className="movement-item" key={`${item.client}-${item.date}`}><span className="movement-index">{index + 1}.</span><div className="movement-copy"><strong title={item.client}>{item.client}</strong><small title={item.detail}>{item.detail}</small></div><time>{formatMovementDate(item.date)}</time></div>) : <div className="movement-empty">Nenhum cliente encontrado no período selecionado.</div>}
    </div>
  </div>;
}

function TimelineChart({ series }: { series: DashboardSnapshot["timeline"] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const width = 720;
  const height = 245;
  const padding = { left: 26, right: 15, top: 20, bottom: 32 };
  const maxValue = Math.max(...series.flatMap((point) => [point.contractedServices, point.cancelledServices]), 1);
  const points = (key: "contractedServices" | "cancelledServices") => series.map((point, index) => {
    const x = padding.left + (index / Math.max(series.length - 1, 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - point[key] / maxValue) * (height - padding.top - padding.bottom);
    return { x, y };
  });
  const smoothPath = (key: "contractedServices" | "cancelledServices") => {
    const pointsForLine = points(key);
    if (!pointsForLine.length) return "";
    return pointsForLine.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = pointsForLine[index - 1];
      const controlX = (previous.x + point.x) / 2;
      return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
    }, "");
  };
  return <div className="timeline-chart-wrap">
    <div className="timeline-header"><div className="chart-legend"><span><i className="legend-dot legend-teal" /> Serviços contratados</span><span><i className="legend-dot legend-coral" /> Serviços cancelados</span></div></div>
    <svg className="timeline-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Linha do tempo de serviços contratados e cancelados">
      {[0, .33, .66, 1].map((level) => <g key={level}><line x1={padding.left} x2={width - padding.right} y1={padding.top + level * (height - padding.top - padding.bottom)} y2={padding.top + level * (height - padding.top - padding.bottom)} className="chart-grid" /><text x="5" y={padding.top + level * (height - padding.top - padding.bottom) + 3} className="chart-axis-label">{Math.round(maxValue * (1 - level))}</text></g>)}
      <path d={smoothPath("contractedServices")} className="chart-line chart-line-teal" />
      <path d={smoothPath("cancelledServices")} className="chart-line chart-line-coral" />
      {series.map((point, index) => { const x = padding.left + (index / Math.max(series.length - 1, 1)) * (width - padding.left - padding.right); const yContracted = padding.top + (1 - point.contractedServices / maxValue) * (height - padding.top - padding.bottom); const yCancelled = padding.top + (1 - point.cancelledServices / maxValue) * (height - padding.top - padding.bottom); const segmentWidth = (width - padding.left - padding.right) / Math.max(series.length, 1); const tooltipX = Math.max(12, Math.min(width - 272, x - 112)); const tooltipTextX = tooltipX + 16; return <g key={point.key} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}><title>{point.label} · Contratados: {point.contractedServices} serviços · Cancelados: {point.cancelledServices} serviços</title><rect x={x - segmentWidth / 2} y={padding.top} width={segmentWidth} height={height - padding.top - padding.bottom} className="timeline-hover-zone" /><circle cx={x} cy={yContracted} r={hoveredIndex === index ? "5.5" : "4"} className="timeline-point timeline-point-teal" /><circle cx={x} cy={yCancelled} r={hoveredIndex === index ? "5.5" : "4"} className="timeline-point timeline-point-coral" /><text x={x} y={height - 8} textAnchor="middle" className="chart-label">{point.label}</text>{hoveredIndex === index && <g className="timeline-tooltip" pointerEvents="none"><rect x={tooltipX} y="3" width="260" height="58" rx="8" /><text x={tooltipTextX} y="22"><tspan className="timeline-tooltip-label">{point.label}</tspan><tspan x={tooltipTextX} dy="22" className="timeline-tooltip-values">Contratados {point.contractedServices} · Cancelados {point.cancelledServices}</tspan></text></g>}</g>; })}
    </svg>
  </div>;
}

function ServiceBars({ items, total }: { items: DashboardSnapshot["serviceBreakdown"]; total: number }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className="service-bars"><div className="service-total"><span>SERVIÇOS ÚNICOS POR CLIENTE</span><strong>Total: {formatNumber(total)}</strong></div>{items.slice(0, 8).map((item, index) => <div className="service-row" key={item.label}><div className="service-row-label"><span title={item.label}>{item.label}</span><strong>{formatNumber(item.value)}</strong><em>{item.percent.toFixed(1).replace(".", ",")}%</em></div><div className="service-track"><span style={{ width: `${Math.max(4, (item.value / max) * 100)}%`, background: `linear-gradient(90deg, ${SERVICE_COLORS[index % SERVICE_COLORS.length]}, color-mix(in srgb, ${SERVICE_COLORS[index % SERVICE_COLORS.length]} 60%, white))` }} /></div></div>)}</div>;
}

function ClientServiceBars({ items }: { items: DashboardSnapshot["clientServiceBreakdown"] }) {
  const max = Math.max(...items.map((item) => item.clients), 1);
  const totalClients = items.reduce((sum, item) => sum + item.clients, 0);
  const totalServices = items.reduce((sum, item) => sum + item.totalServices, 0);
  return <div className="client-service-breakdown"><div className="service-total"><span>CLIENTES ÚNICOS · SERVIÇOS</span><strong>{formatNumber(totalServices)} serviços</strong></div><div className="client-service-caption"><span>{formatNumber(totalClients)} clientes na base</span><span>cliente + serviço, sem CNPJ</span></div><div className="client-service-list">{items.map((item, index) => <div className="client-service-row" key={item.label}><div className="client-service-head"><span className="client-service-label"><i style={{ background: ["#2f7dff", "#19c6a3", "#f6bf4b", "#fb5b72", "#9b7bf8"][index % 5] }} />{item.label}</span><strong>{formatNumber(item.clients)} clientes</strong><span>{item.percent.toFixed(1).replace(".", ",")}% · {formatNumber(item.totalServices)} serviços</span></div><div className="service-track"><span style={{ width: `${Math.max(5, (item.clients / max) * 100)}%`, background: `linear-gradient(90deg, ${["#2f7dff", "#19c6a3", "#f6bf4b", "#fb5b72", "#9b7bf8"][index % 5]}, rgba(255,255,255,.75))` }} /></div></div>)}</div></div>;
}

function ClubBreakdown({ items }: { items: DashboardSnapshot["clubBreakdown"] }) {
  const colors = ["#2f7dff", "#19c6a3", "#f6bf4b", "#fb5b72", "#9b7bf8", "#6f89a8"];
  let cursor = 0;
  const gradient = items.slice(0, 7).map((item, index) => {
    const start = cursor;
    cursor += item.percent;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  }).join(", ");
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return <div className="club-donut-layout"><div className="club-donut" style={{ background: `conic-gradient(${gradient})` }}><div className="club-donut-hole"><strong>{formatNumber(total)}</strong><span>clientes com clube</span></div></div><div className="club-breakdown">{items.slice(0, 7).map((item, index) => <div className="club-row" key={item.label}><span className="club-name" title={item.label}><i style={{ background: colors[index % colors.length] }} /><span>{item.label}</span></span><strong>{formatNumber(item.value)}</strong><span className="club-percent">{item.percent.toFixed(1).replace(".", ",")}%</span></div>)}</div></div>;
}

function DataTable({ rows }: { rows: DashboardSnapshot["clientRows"] }) {
  return <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Serviços</th><th>CNPJs</th><th>Marca</th><th>Região</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.client}><td><span className="client-cell"><span className="client-avatar">{initials(row.client)}</span><span><strong>{row.client}</strong><small>{row.city}</small></span></span></td><td><b>{formatNumber(row.services)}</b></td><td>{formatNumber(row.cnpjs)}</td><td className="muted-cell">{row.brand}</td><td>{row.region}</td><td><span className={`status-chip ${row.status.toLowerCase().includes("ativo") ? "status-chip-positive" : "status-chip-neutral"}`}><span className="status-dot" />{row.status}</span></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><Users size={20} /><strong>Nenhum cliente encontrado</strong><span>Ajuste os filtros globais para ampliar a busca.</span></div>}</div>;
}

function GeneralPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  const growth = snapshot.kpis.clientsYoYPercent;
  return <>
    <div className="page-heading"><div><div className="page-eyebrow"><span className="status-dot status-dot-live" /> Visão consolidada</div><h1>Indicadores gerais</h1><p>Movimentação, retenção e distribuição da carteira por cliente.</p></div><div className="page-heading-meta"><span>{snapshot.period.label}</span><span className="heading-meta-divider" /><span>{formatPeriodDate(snapshot.period.startDate)} — {formatDate(snapshot.period.endDate)}</span></div></div>
    <div className="kpi-grid"><KpiCard icon={Users} label="Clientes ativos" value={formatNumber(snapshot.kpis.clients)} detail="clientes únicos com vigência no recorte" tone="blue" trend={growth === null ? undefined : `${growth >= 0 ? "+" : ""}${growth.toFixed(1).replace(".", ",")}%`} trendPositive={growth === null ? undefined : growth >= 0} /><KpiCard icon={Building2} label="CNPJs em operação" value={formatNumber(snapshot.kpis.cnpjs)} detail="cadastros vinculados aos clientes" tone="teal" /><KpiCard icon={Activity} label="LTV médio (retenção)" value={`${snapshot.kpis.ltvYears.toFixed(1).replace(".", ",")} anos`} detail="tempo médio de serviço ativo" tone="violet" /><KpiCard icon={Store} label="Universo O Boticário" value={`${snapshot.kpis.boticarioShare.toFixed(1).replace(".", ",")}%`} detail={`${formatNumber(snapshot.kpis.boticarioClients)} Boticário · ${formatNumber(snapshot.kpis.otherBrandClients)} outras marcas`} tone="boticario" trend={`${formatNumber(snapshot.kpis.boticarioClients)} clientes`} /></div>
    <div className="content-grid content-grid-top"><Panel title={`Clientes novos · ${formatNumber(snapshot.newClients.length)} no período`} icon={Users} className="movement-panel"><MovementList title="Clientes novos" items={snapshot.newClients} tone="positive" /></Panel><Panel title={`Clientes cancelados · ${formatNumber(snapshot.cancelledClients.length)} no período`} icon={CircleAlert} className="movement-panel"><MovementList title="Clientes cancelados" items={snapshot.cancelledClients} tone="negative" /></Panel><Panel title="Linha do tempo" icon={Activity} className="timeline-panel"><TimelineChart series={snapshot.timeline} /></Panel></div>
    <div className="content-grid content-grid-three"><Panel title="Distribuição por serviço" eyebrow="SERVIÇOS · CLIENTES ÚNICOS" icon={Layers3}><ServiceBars items={snapshot.serviceBreakdown} total={snapshot.serviceTotal} /></Panel><Panel title="Clientes × serviços" eyebrow="CLIENTES ÚNICOS · PARTICIPAÇÃO" icon={BarChart3}><ClientServiceBars items={snapshot.clientServiceBreakdown} /></Panel><Panel title="Mix por clube" eyebrow="CLIENTES ÚNICOS · PARTICIPAÇÃO" icon={Target}><ClubBreakdown items={snapshot.clubBreakdown} /></Panel></div>
    <div className="content-grid content-grid-map"><Panel title="Mapa dos serviços oferecidos" eyebrow="CLIENTES ATIVOS POR ESTADO" icon={MapIcon} className="panel-map"><BrazilMap snapshot={snapshot} /></Panel><Panel title="Clientes em foco" eyebrow="MAIOR CONCENTRAÇÃO DE SERVIÇOS" icon={Users} className="panel-table"><DataTable rows={snapshot.clientRows} /></Panel></div>
  </>;
}

function ClientPicker({ clients, value, onChange }: { clients: string[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = normalize(search);
  const matches = query ? clients.filter((client) => normalize(client).includes(query)) : clients;
  const openPicker = () => {
    setSearch("");
    setOpen(true);
  };
  return <div className="client-picker">
    <div className="client-picker-label"><Users size={13} /> Cliente selecionado <span className="client-picker-count">{clients.length} clientes</span></div>
    <div className="client-picker-input-wrap"><Users size={15} /><input value={open ? search : value} onChange={(event) => { setSearch(event.target.value); setOpen(true); }} onFocus={openPicker} onBlur={() => window.setTimeout(() => { setOpen(false); setSearch(""); }, 120)} placeholder={value && !open ? value : "Buscar cliente por nome..."} role="combobox" aria-expanded={open} aria-controls="client-picker-options" aria-autocomplete="list" />{value && <button className="client-picker-clear" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); setSearch(""); setOpen(true); }} aria-label="Limpar cliente"><X size={14} /></button>}</div>
    {open && <div className="client-picker-options" id="client-picker-options"><div className="client-picker-options-head"><span>{query ? `${matches.length} encontrados` : `${clients.length} clientes disponíveis`}</span><small>{query ? "resultado da busca" : "role para ver a lista completa"}</small></div>{matches.length ? matches.map((client) => <button key={client} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(client); setSearch(""); setOpen(false); }}>{client}</button>) : <span>Nenhum cliente encontrado</span>}</div>}
  </div>;
}

function ClientMetricCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: string; detail: string; tone: Tone }) {
  return <article className="client-metric-card"><div className={`kpi-icon kpi-icon-${tone}`}><Icon size={16} /></div><div className="kpi-label">{label}</div><strong>{value}</strong><span>{detail}</span></article>;
}

function ClientGantt({ detail }: { detail: ClientDetail }) {
  const history = detail.serviceHistory;
  const dates = history.flatMap((item) => [toTimestamp(item.startDate), toTimestamp(item.endDate)]).filter((value): value is number => value !== null);
  const latest = toTimestamp(detail.referenceEndDate) ?? Date.now();
  const minDate = Math.min(...dates, latest);
  const maxDate = Math.max(...dates, latest);
  const span = Math.max(maxDate - minDate, 86400000);
  const axisTicks = Array.from({ length: 7 }, (_, index) => {
    const timestamp = minDate + ((maxDate - minDate) * index) / 6;
    const date = new Date(timestamp);
    return { label: date.getUTCFullYear() === new Date(minDate).getUTCFullYear() && date.getUTCFullYear() === new Date(maxDate).getUTCFullYear() ? `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}` : `${date.getUTCMonth() === 0 ? "jan" : MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`, left: `${(index / 6) * 100}%` };
  });
  const serviceColorMap = new Map<string, string>();
  history.forEach((item) => { const key = item.service.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); if (!serviceColorMap.has(key)) serviceColorMap.set(key, SERVICE_COLORS[serviceColorMap.size % SERVICE_COLORS.length]); });
  const position = (value: number) => `${Math.max(0, Math.min(100, ((value - minDate) / span) * 100))}%`;
  return <div className="client-gantt-scroll"><div className="client-gantt-wrap"><div className="client-gantt-axis"><span>Histórico de serviços</span><div className="client-gantt-axis-scale">{axisTicks.map((tick, index) => <span key={`${tick.label}-${index}`} style={{ left: tick.left }}>{tick.label}</span>)}</div><span className="client-gantt-axis-dates"><span>Início</span><span>Fim</span></span></div><div className="client-gantt-list">{history.map((item) => { const start = toTimestamp(item.startDate) ?? minDate; const end = toTimestamp(item.endDate) ?? maxDate; const left = position(start); const width = `${Math.max(2, ((Math.max(end, start + 86400000) - start) / span) * 100)}%`; const key = item.service.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(); const color = serviceColorMap.get(key) ?? SERVICE_COLORS[0]; return <div className="client-gantt-row" key={`${item.service}-${item.startDate}-${item.endDate}`}><div className="client-gantt-service"><i style={{ background: color }} /><strong title={item.service}>{item.service}</strong><small>{item.status}</small></div><div className="client-gantt-track"><span className={`client-gantt-bar ${item.status === "Ativo" ? "client-gantt-active" : item.status === "Operação Assistida" ? "client-gantt-assisted" : "client-gantt-closed"}`} style={{ left, width, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 62%, white))` }}><b>{formatClientDuration(item.days)}</b></span></div><div className="client-gantt-dates"><time>{formatDate(item.startDate)}</time><time>{item.endDate ? formatDate(item.endDate) : "Em aberto"}</time></div></div>; })}</div></div></div>;
}

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatClientDuration(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years} ${years === 1 ? "ano" : "anos"}`;
  }
  return `${formatNumber(days)}d`;
}

function toTimestamp(value: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function ClientActiveChart({ detail }: { detail: ClientDetail }) {
  const series = detail.activeSeries;
  const width = 720;
  const height = 205;
  const padding = { left: 30, right: 15, top: 18, bottom: 38 };
  const max = Math.max(...series.map((item) => item.activeServices), 1);
  const points = series.map((item, index) => ({ x: padding.left + (index / Math.max(series.length - 1, 1)) * (width - padding.left - padding.right), y: padding.top + (1 - item.activeServices / max) * (height - padding.top - padding.bottom), item }));
  const path = points.reduce((result, point, index) => `${result}${index ? ` L ${point.x} ${point.y}` : `M ${point.x} ${point.y}`}`, "");
  const years = Array.from(new Set(series.map((item) => item.key.slice(0, 4))));
  const labelIndices = new Set<number>();
  if (years.length > 2) {
    series.forEach((item, index) => { if (index === 0 || item.key.endsWith("-01") || index === series.length - 1) labelIndices.add(index); });
  } else {
    const step = Math.max(1, Math.ceil(series.length / 8));
    series.forEach((_, index) => { if (index % step === 0 || index === series.length - 1) labelIndices.add(index); });
  }
  return <div className="client-active-chart"><div className="chart-legend"><span><i className="legend-dot legend-blue" /> Serviços ativos</span><span className="chart-legend-note">histórico completo do cliente</span></div>{series.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução mensal dos serviços ativos do cliente"><line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} className="chart-grid" /><path d={path} className="chart-line chart-line-blue" />{points.map((point, index) => <g key={point.item.key}><circle cx={point.x} cy={point.y} r="4" className="timeline-point timeline-point-blue" /><title>{point.item.label}: {point.item.activeServices} serviços ativos</title>{labelIndices.has(index) && <text x={point.x} y={height - 10} textAnchor="middle" className="chart-label">{years.length > 2 ? point.item.key.slice(0, 4) : point.item.label}</text>}</g>)}</svg> : <div className="empty-state">Sem série histórica disponível.</div>}</div>;
}

function ClientServiceTable({ detail }: { detail: ClientDetail }) {
  return <div className="client-service-table-wrap"><table className="client-service-table"><thead><tr><th>Serviço</th><th>Status</th><th>Início</th><th>Fim</th><th>Dias</th><th>CNPJs</th><th>Local</th></tr></thead><tbody>{detail.serviceHistory.map((item) => <tr key={`${item.service}-${item.startDate}`}><td><strong>{item.service}</strong><small>{item.brand}</small></td><td><span className={`status-chip ${item.status === "Ativo" ? "status-chip-positive" : item.status === "Operação Assistida" ? "status-chip-assisted" : "status-chip-neutral"}`}><span className="status-dot" />{item.status}</span></td><td>{item.startDate ? formatDate(item.startDate) : "—"}</td><td>{item.endDate ? formatDate(item.endDate) : "Em aberto"}</td><td><b>{formatNumber(item.days)}</b></td><td>{formatNumber(item.cnpjs)}</td><td>{item.city}{item.state !== "—" ? ` · ${item.state}` : ""}</td></tr>)}</tbody></table></div>;
}

function ClientEvents({ detail }: { detail: ClientDetail }) {
  return <div className="client-events-list">{detail.events.length ? detail.events.slice(0, 12).map((item) => <div className="client-event-row" key={`${item.date}-${item.service}-${item.movement}`}><time>{formatDate(item.date)}</time><span className="client-event-dot" /><div><strong>{item.service}</strong><small>{item.movement} · {item.event} · {item.club} · {item.responsible}</small></div></div>) : <div className="empty-state"><Activity size={18} /><strong>Sem movimentações no período</strong></div>}</div>;
}

function ClientPage({ detail, clients, selectedClient, onSelectClient }: { detail: ClientDetail | null; clients: string[]; selectedClient: string; onSelectClient: (client: string) => void }) {
  const relationshipYears = detail ? detail.metrics.relationshipDays / 365 : 0;
  return <>
    <div className="page-heading"><div><div className="page-eyebrow"><span className="status-dot status-dot-blue" /> Recorte por cliente</div><h1>{detail?.client ?? "Visão por cliente"}</h1><p>{detail ? `${detail.brand} · ${detail.city}${detail.state !== "—" ? `, ${detail.state}` : ""} · ${detail.region} · histórico completo até ${formatDate(detail.referenceEndDate)}` : "Selecione um cliente para analisar sua carteira de serviços."}</p></div><ClientPicker clients={clients} value={selectedClient} onChange={onSelectClient} /></div>
    {!detail ? <div className="client-empty-state"><div className="client-empty-icon"><Users size={24} /></div><h2>Selecione um cliente para visualizar o histórico</h2><p>Use a busca acima para analisar serviços, CNPJs, datas de vigência e movimentações de um cliente específico.</p></div> : <>
      <div className="client-detail-kpi-grid"><ClientMetricCard icon={Layers3} label="Serviços ativos" value={formatNumber(detail.metrics.activeServices)} detail={`${formatNumber(detail.metrics.historicalServices)} no histórico`} tone="blue" /><ClientMetricCard icon={Building2} label="CNPJs vinculados" value={formatNumber(detail.metrics.cnpjs)} detail="cadastros distintos" tone="teal" /><ClientMetricCard icon={Activity} label="Tempo médio" value={`${formatNumber(detail.metrics.averageActiveDays)} dias`} detail="por serviço" tone="violet" /><ClientMetricCard icon={CalendarClock} label="Relacionamento" value={`${relationshipYears.toFixed(1).replace(".", ",")} anos`} detail={`${formatDate(detail.metrics.firstServiceDate)} início`} tone="amber" /></div>
      <div className="content-grid content-grid-wide"><Panel title="Histórico dos serviços" eyebrow="INÍCIO · FIM · DURAÇÃO" icon={Layers3} className="panel-large client-gantt-panel"><ClientGantt detail={detail} /></Panel><Panel title="Resumo do cliente" eyebrow="SITUAÇÃO ATUAL" icon={Users}><div className="client-summary-list"><div><span>Serviços no filtro</span><strong>{formatNumber(detail.metrics.historicalServices)}</strong></div><div><span>Primeiro serviço</span><strong>{formatDate(detail.metrics.firstServiceDate)}</strong></div><div><span>Última movimentação</span><strong>{formatDate(detail.metrics.lastMovementDate)}</strong></div><div><span>Encerrados</span><strong>{formatNumber(detail.metrics.closedServices)}</strong></div></div></Panel></div>
      <div className="content-grid content-grid-wide"><Panel title="Evolução dos serviços ativos" eyebrow="HISTÓRICO MENSAL" icon={Activity} className="panel-large"><ClientActiveChart detail={detail} /></Panel><Panel title="Movimentações do cliente" eyebrow="FATOS MOVIMENTAÇÃO" icon={Zap}><ClientEvents detail={detail} /></Panel></div>
      <Panel title="Detalhamento dos serviços" eyebrow="DATAS E VIGÊNCIAS" icon={Database}><ClientServiceTable detail={detail} /></Panel>
    </>}
  </>;
}

function LoadingState() { return <div className="state-card"><div className="loading-orbit"><span /><span /><span /></div><h2>Conectando à base de indicadores</h2><p>Consultando as abas públicas do Google Sheets e preparando os filtros globais.</p><div className="loading-lines"><span /><span /><span /></div></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="state-card state-card-error"><div className="error-symbol"><CircleAlert size={22} /></div><h2>Não foi possível atualizar os dados</h2><p>{message}</p><button className="primary-button" onClick={onRetry}><RefreshCw size={15} /> Tentar novamente</button><a href={spreadsheetSource} target="_blank" rel="noreferrer">Abrir planilha de origem</a></div>; }

export default function Home() {
  // Consulta de autenticação do usuário logado vem antes da carga de dados.
  const utils = trpc.useUtils();
  const authQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const isAllowed = Boolean(authQuery.data?.isAllowed);
  const { data, loading, error, syncNotice, syncLogs, refresh } = useDashboardData(isAllowed);
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      utils.auth.me.setData(undefined, null);
    }
  };
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [view, setView] = useState<DashboardView>(() => window.location.pathname.includes("clientes") ? "client" : window.location.pathname.includes("cadastro") ? "access" : "general");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedClient, setSelectedClient] = useState("");
  const userAllowedServices = useMemo(() => {
    if (authQuery.data?.role === "admin") return null;
    const list = authQuery.data?.allowedServices;
    return Array.isArray(list) ? list : null;
  }, [authQuery.data]);

  const generalData = useMemo(() => {
    if (!data) return null;
    return filterDataByAllowedServices(data, userAllowedServices);
  }, [data, userAllowedServices]);

  const options = useMemo<FilterOptions>(() => generalData ? buildFilterOptions(generalData) : { regions: [], services: [], brands: [], years: [], latestDate: "" }, [generalData]);
  const clientOptions = useMemo(() => data ? buildClientOptions(data) : [], [data]);
  const snapshot = useMemo(() => generalData ? deriveSnapshot(generalData, filters) : null, [generalData, filters]);
  const clientDetail = useMemo(() => data && selectedClient ? deriveClientDetail(data, selectedClient) : null, [data, selectedClient]);
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    document.body.classList.toggle("mobile-nav-is-open", mobileNavOpen);
    return () => document.body.classList.remove("mobile-nav-is-open");
  }, [mobileNavOpen]);

  if (authQuery.isLoading) {
    return <div className="auth-loading-screen"><div className="loading-orbit"><span /><span /><span /></div><strong>Verificando seu acesso...</strong></div>;
  }
  if (!isAllowed) {
    return <LoginOverlay />;
  }

  return (
    <div className={`app-shell ${collapsed ? "app-shell-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>
    <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} view={view} setView={setView} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} user={authQuery.data} onLogout={handleLogout} />
    <button type="button" className={`mobile-nav-overlay ${mobileNavOpen ? "mobile-nav-overlay-open" : ""}`} aria-label="Fechar menu lateral" onClick={() => setMobileNavOpen(false)} />
    <div className="app-main"><TopHeader onMenu={() => { setCollapsed(false); setMobileNavOpen(true); }} theme={theme} setTheme={setTheme} onRefresh={refresh} loading={loading} syncLogs={syncLogs} view={view} /><main id="main-content" className="dashboard-main">{syncNotice && <div className="sync-notice" role="status"><CircleAlert size={15} />{syncNotice}</div>}{view === "general" && <FilterBar filters={filters} setFilters={setFilters} options={options} onClear={clearFilters} />}{view === "access" ? (authQuery.data?.role === "admin" ? <UserManagementModal mode="page" isOpen={true} onClose={() => setView("general")} currentUserEmail={authQuery.data?.email} availableServices={options.services} /> : <div className="access-denied-card"><Shield size={24} /><h2>Acesso restrito</h2><p>A página Cadastro está disponível somente para administradores.</p></div>) : loading && !snapshot ? <LoadingState /> : !snapshot && error ? <ErrorState message={error} onRetry={refresh} /> : snapshot ? (view === "general" ? <GeneralPage snapshot={snapshot} /> : <ClientPage detail={clientDetail} clients={clientOptions} selectedClient={selectedClient} onSelectClient={setSelectedClient} />) : null}</main><footer className="app-footer"><span><span className="status-dot status-dot-live" /> Dados conectados via Google Sheets</span><span>Indicadores de Serviços · {formatNumber(data?.fatos.length ?? 0)} fatos carregados</span></footer>{loading && <div className="sync-blocker" role="alert" aria-live="polite"><div className="sync-blocker-card"><div className="loading-orbit"><span /><span /><span /></div><strong>{syncLogs.length ? "Atualizando indicadores" : "Conectando à base de indicadores"}</strong><p>{syncLogs.length ? "A navegação ficará bloqueada até a leitura das abas terminar." : "Consultando as abas públicas do Google Sheets."}</p></div></div>}</div>
    </div>
  );
}
