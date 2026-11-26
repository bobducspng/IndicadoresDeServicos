import { useState } from "react";
import { Check, ChevronDown, Filter } from "lucide-react";

export function MultiSelectFilter({ filterKey, label, value, options, icon: Icon, onChange, openFilter, setOpenFilter, searchable = false }: { filterKey: string; label: string; value: string[]; options: string[]; icon: typeof Filter; onChange: (value: string[]) => void; openFilter: string | null; setOpenFilter: (value: string | null) => void; searchable?: boolean }) {
  const open = openFilter === filterKey;
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? options.filter((option) => option.toLowerCase().includes(termo)) : options;
  const toggle = (option: string) => {
    onChange(value.some((item) => item === option) ? value.filter((item) => item !== option) : [...value, option]);
    setOpenFilter(null);
    setBusca("");
  };
  const summary = value.length === 0 ? "Todos" : value.length === 1 ? value[0] : `${value.length} selecionados`;
  return (
    <div className={`multi-select-filter ${open ? "multi-select-filter-open" : ""}`}>
      <button className="multi-select-trigger" onClick={() => setOpenFilter(open ? null : filterKey)} aria-expanded={open}>
        <Icon size={14} /><span className="multi-select-copy"><small>{label}</small><strong title={summary}>{summary}</strong></span><ChevronDown size={14} className="multi-select-chevron" />
      </button>
      {open && <div className="multi-select-menu">
        <div className="multi-select-menu-head"><span>{label}</span><button onClick={() => { onChange([]); setOpenFilter(null); }}>Limpar</button></div>
        {searchable && <input className="multi-select-search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${label.toLowerCase()}…`} aria-label={`Buscar ${label.toLowerCase()}`} autoFocus />}
        <div className="multi-select-options">
          {visiveis.map((option) => <button key={option} className={`multi-select-option ${value.includes(option) ? "multi-select-option-selected" : ""}`} onClick={() => toggle(option)}><span>{option}</span>{value.includes(option) && <Check size={14} />}</button>)}
          {!visiveis.length && <div className="multi-select-empty">Nenhuma opção disponível</div>}
        </div>
      </div>}
    </div>
  );
}
