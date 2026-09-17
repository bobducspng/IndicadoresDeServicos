import { useEffect, useRef, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  User,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mail,
  UserCheck,
  Power,
  UserX,
  Pencil,
  Check,
  Search,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string | null;
  availableServices?: string[];
  mode?: "modal" | "page";
}

type UserTableColumn = "name" | "email" | "role" | "services" | "status" | "addedBy" | "actions";

const userTableColumns: UserTableColumn[] = ["name", "email", "role", "services", "status", "addedBy", "actions"];

const defaultColumnWidths: Record<UserTableColumn, number> = {
  name: 21,
  email: 22,
  role: 11,
  services: 18,
  status: 9,
  addedBy: 11,
  actions: 8,
};

const minimumColumnWidths: Record<UserTableColumn, number> = {
  name: 15,
  email: 16,
  role: 9,
  services: 13,
  status: 8,
  addedBy: 9,
  actions: 7,
};

export function UserManagementModal({
  isOpen,
  onClose,
  currentUserEmail,
  availableServices = [],
  mode = "modal",
}: UserManagementModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [newAllowedServices, setNewAllowedServices] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingServicesUserId, setEditingServicesUserId] = useState<number | null>(null);
  const [editingServices, setEditingServices] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [sortKey, setSortKey] = useState<"name" | "email" | "status">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [copiedEmailId, setCopiedEmailId] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<UserTableColumn, number>>(defaultColumnWidths);
  const [isResizingColumn, setIsResizingColumn] = useState(false);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const resizeRef = useRef<{
    left: UserTableColumn;
    right: UserTableColumn;
    startX: number;
    tableWidth: number;
    leftWidth: number;
    rightWidth: number;
  } | null>(null);

  const utils = trpc.useUtils();

  const usersQuery = trpc.accessControl.list.useQuery(undefined, {
    enabled: isOpen,
  });

  const addMutation = trpc.accessControl.add.useMutation({
    onSuccess: () => {
      setEmail("");
      setName("");
      setAvatarUrl("");
      setRole("user");
      setNewAllowedServices([]);
      setFormError(null);
      setSuccessMsg("E-mail autorizado com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3500);
      utils.accessControl.list.invalidate();
    },
    onError: (err) => {
      setFormError(err.message || "Erro ao adicionar usuário");
    },
  });

  const updateRoleMutation = trpc.accessControl.updateRole.useMutation({
    onSuccess: () => {
      utils.accessControl.list.invalidate();
    },
    onError: (err) => {
      alert(err.message || "Erro ao atualizar permissão");
    },
  });

  const removeMutation = trpc.accessControl.remove.useMutation({
    onSuccess: () => {
      utils.accessControl.list.invalidate();
    },
    onError: (err) => {
      alert(err.message || "Erro ao remover usuário");
    },
  });

  const toggleStatusMutation = trpc.accessControl.toggleStatus.useMutation({
    onSuccess: () => {
      utils.accessControl.list.invalidate();
    },
    onError: (err) => {
      alert(err.message || "Erro ao alterar status do usuário");
    },
  });

  const updateNameMutation = trpc.accessControl.updateName.useMutation({
    onSuccess: () => {
      setEditingUserId(null);
      setEditingName("");
      setFormError(null);
      setSuccessMsg("Nome atualizado com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3500);
      utils.accessControl.list.invalidate();
    },
    onError: (err) => {
      setFormError(err.message || "Erro ao atualizar nome");
    },
  });

  const updateServicesMutation = trpc.accessControl.updateServices.useMutation({
    onSuccess: () => {
      setEditingServicesUserId(null);
      setEditingServices([]);
      setFormError(null);
      setSuccessMsg("Serviços autorizados atualizados!");
      setTimeout(() => setSuccessMsg(null), 3500);
      utils.accessControl.list.invalidate();
    },
    onError: (err) => {
      setFormError(err.message || "Erro ao atualizar serviços autorizados");
    },
  });

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;

      const deltaPercent = ((event.clientX - resize.startX) / resize.tableWidth) * 100;
      const combinedWidth = resize.leftWidth + resize.rightWidth;
      const nextLeftWidth = Math.min(
        combinedWidth - minimumColumnWidths[resize.right],
        Math.max(minimumColumnWidths[resize.left], resize.leftWidth + deltaPercent),
      );
      const nextRightWidth = combinedWidth - nextLeftWidth;

      setColumnWidths((current) => ({
        ...current,
        [resize.left]: nextLeftWidth,
        [resize.right]: nextRightWidth,
      }));
    };

    const handlePointerUp = () => {
      resizeRef.current = null;
      setIsResizingColumn(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const serviceGroups = [
    {
      label: "BPO Operacional",
      services: availableServices.filter((service) =>
        ["BPO Operacional Receitas", "BPO Operacional Despesas", "BPO Controle/Tesouraria"].includes(service)
      ),
    },
    {
      label: "BPO Gerencial",
      services: availableServices.filter((service) =>
        ["BPO Gerencial", "BPO Gerencial DRE Essencial", "BPO Gerencial Treinamento em Gestão Financeira"].includes(service)
      ),
    },
    {
      label: "Demais serviços",
      services: availableServices.filter((service) =>
        ![
          "BPO Operacional Receitas",
          "BPO Operacional Despesas",
          "BPO Controle/Tesouraria",
          "BPO Gerencial",
          "BPO Gerencial DRE Essencial",
          "BPO Gerencial Treinamento em Gestão Financeira",
        ].includes(service)
      ),
    },
  ].filter((group) => group.services.length > 0);

  const normalizedSearch = userSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredUsers = (usersQuery.data ?? [])
    .filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!normalizedSearch) return true;
      return `${user.name} ${user.email}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    })
    .sort((a, b) => {
      const first = sortKey === "name" ? a.name : sortKey === "email" ? a.email : String(a.isActive);
      const second = sortKey === "name" ? b.name : sortKey === "email" ? b.email : String(b.isActive);
      const comparison = first.localeCompare(second, "pt-BR", { sensitivity: "base" });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  const editingServicesUser = (usersQuery.data ?? []).find((user) => user.id === editingServicesUserId);

  if (!isOpen) return null;

  const isPage = mode === "page";

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (!email.trim() || !name.trim()) {
      setFormError("Informe nome e e-mail.");
      return;
    }

    addMutation.mutate({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      allowedServices: role === "user" ? newAllowedServices : undefined,
      avatarUrl: avatarUrl.trim() || undefined,
    });
  };

  const handleRemove = (id: number, targetEmail: string) => {
    if (targetEmail.toLowerCase() === currentUserEmail?.toLowerCase()) {
      if (!confirm("Você está removendo seu próprio e-mail de acesso. Tem certeza?")) {
        return;
      }
    } else {
      if (!confirm(`Remover a autorização de ${targetEmail}?`)) {
        return;
      }
    }
    removeMutation.mutate({ id });
  };

  const handleToggleRole = (id: number, currentRole: "admin" | "user") => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    updateRoleMutation.mutate({ id, role: newRole });
  };

  const handleToggleStatus = (id: number, currentStatus: number, targetEmail: string) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    const action = nextStatus === 0 ? "desativar" : "ativar";
    if (targetEmail.toLowerCase() === currentUserEmail?.toLowerCase() && nextStatus === 0) {
      if (!confirm("Você está desativando sua própria conta. Deseja continuar?")) return;
    } else {
      if (!confirm(`Deseja realmente ${action} o acesso de ${targetEmail}?`)) return;
    }
    toggleStatusMutation.mutate({ id, isActive: nextStatus });
  };

  const handleSort = (key: "name" | "email" | "status") => {
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const handleStartColumnResize = (leftColumn: UserTableColumn, event: React.PointerEvent<HTMLDivElement>) => {
    const rightIndex = userTableColumns.indexOf(leftColumn) + 1;
    const rightColumn = userTableColumns[rightIndex];
    const table = tableRef.current;
    if (!rightColumn || !table) return;

    const tableWidth = table.getBoundingClientRect().width;
    resizeRef.current = {
      left: leftColumn,
      right: rightColumn,
      startX: event.clientX,
      tableWidth,
      leftWidth: columnWidths[leftColumn],
      rightWidth: columnWidths[rightColumn],
    };
    setIsResizingColumn(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const resetColumnWidths = () => {
    setColumnWidths(defaultColumnWidths);
  };

  const handleCopyEmail = async (targetEmail: string, id: number) => {
    try {
      await navigator.clipboard.writeText(targetEmail);
      setCopiedEmailId(id);
      setSuccessMsg("E-mail copiado para a área de transferência.");
      setTimeout(() => {
        setCopiedEmailId((current) => current === id ? null : current);
        setSuccessMsg(null);
      }, 2200);
    } catch {
      setFormError("Não foi possível copiar o e-mail neste navegador.");
    }
  };

  const handleStartNameEdit = (id: number, currentName: string) => {
    setFormError(null);
    setSuccessMsg(null);
    setEditingUserId(id);
    setEditingName(currentName);
  };

  const handleCancelNameEdit = () => {
    if (updateNameMutation.isPending) return;
    setEditingUserId(null);
    setEditingName("");
  };

  const handleSaveName = (id: number) => {
    const trimmedName = editingName.trim();
    if (trimmedName.length < 2) {
      setFormError("Informe um nome com pelo menos 2 caracteres.");
      return;
    }
    setFormError(null);
    updateNameMutation.mutate({ id, name: trimmedName });
  };

  const toggleNewAllowedService = (service: string) => {
    setNewAllowedServices((prev) =>
      prev.includes(service) ? prev.filter((item) => item !== service) : [...prev, service]
    );
  };

  const handleStartServicesEdit = (id: number, currentList: string[]) => {
    setFormError(null);
    setSuccessMsg(null);
    setEditingServicesUserId(id);
    setEditingServices(currentList);
  };

  const handleCancelServicesEdit = () => {
    if (updateServicesMutation.isPending) return;
    setEditingServicesUserId(null);
    setEditingServices([]);
  };

  const toggleEditingService = (service: string) => {
    setEditingServices((prev) =>
      prev.includes(service) ? prev.filter((item) => item !== service) : [...prev, service]
    );
  };

  const handleSaveServices = (id: number) => {
    setFormError(null);
    updateServicesMutation.mutate({ id, allowedServices: editingServices });
  };

  const renderServiceGroups = (
    selectedServices: string[],
    toggleService: (service: string) => void,
    inline = false,
  ) => (
    <div className={inline ? "services-inline-groups" : "services-chips-selector"}>
      {serviceGroups.map((group) => (
        <div className="service-group" key={group.label}>
          <span className="service-group-label">{group.label}</span>
          <div className="service-group-chips">
            {group.services.map((service) => {
              const selected = selectedServices.includes(service);
              return (
                <button
                  type="button"
                  key={service}
                  className={`${inline ? "service-inline-chip" : "service-chip-btn"} ${selected ? (inline ? "service-inline-chip-active" : "service-chip-selected") : ""}`}
                  onClick={() => toggleService(service)}
                >
                  <span>{service}</span>
                  {selected && <Check size={12} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={isPage ? "access-page-shell" : "modal-backdrop"} onClick={isPage ? undefined : onClose}>
      <div className={isPage ? "access-page-card" : "modal-content user-mgmt-modal"} onClick={(e) => e.stopPropagation()}>
        {isPage && (
          <div className="access-page-heading">
            <div>
              <div className="page-eyebrow"><span className="status-dot status-dot-blue" /> Administração</div>
              <h1>Cadastro</h1>
              <p>Gerencie usuários autorizados, perfis e serviços disponíveis no painel.</p>
            </div>
            <div className="access-page-heading-meta">
              <span>{usersQuery.data?.length ?? 0} usuários cadastrados</span>
              <span className="heading-meta-divider" />
              <span>Acesso restrito a administradores</span>
            </div>
          </div>
        )}
        <div className={isPage ? "modal-header access-page-toolbar" : "modal-header"}>
          <div className="modal-header-title">
            <Users size={20} className="modal-icon-blue" />
            <div>
              <h3>{isPage ? "Usuários autorizados" : "Gestão de Usuários Autorizados"}</h3>
              <p>Controle quem pode acessar o Indicadores de Serviços via Google SSO.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {successMsg && (
          <div className="mgmt-toast" role="status" aria-live="polite">
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="modal-body user-mgmt-body">
          {/* Formulário para Adicionar */}
          <form onSubmit={handleAddSubmit} className="add-user-form">
            <div className="add-user-form-title">
              <UserPlus size={16} />
              <span>Cadastrar Novo E-mail de Acesso</span>
            </div>

            <div className="add-user-grid">
              <div className="form-group">
                <label htmlFor="user-name">Nome do Usuário</label>
                <input
                  id="user-name"
                  type="text"
                  required
                  placeholder="Ex: João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mgmt-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user-email">E-mail Google / Corporativo</label>
                <input
                  id="user-email"
                  type="email"
                  required
                  placeholder="exemplo@vena.app.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mgmt-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="user-role">Perfil de Acesso</label>
                <select
                  id="user-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "user" | "admin")}
                  className="mgmt-select"
                >
                  <option value="user">Usuário (Visualizador)</option>
                  <option value="admin">Administrador (Total)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="user-avatar">URL da Foto (opcional)</label>
                <input
                  id="user-avatar"
                  type="url"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="mgmt-input"
                />
              </div>
            </div>

            {role === "user" && availableServices.length > 0 && (
              <div className="form-services-group">
                <div className="form-services-label">
                  <span>Serviços que este usuário pode visualizar:</span>
                  <small>Selecione os serviços permitidos. Se nenhum for selecionado, o usuário não verá serviços na visão geral.</small>
                  <div className="services-selection-actions">
                    <button type="button" onClick={() => setNewAllowedServices(availableServices)}>Selecionar todos</button>
                    <button type="button" onClick={() => setNewAllowedServices([])}>Remover todos</button>
                  </div>
                </div>
                {renderServiceGroups(newAllowedServices, toggleNewAllowedService)}
              </div>
            )}

            {formError && (
              <div className="mgmt-alert mgmt-alert-error">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <div className="add-user-actions">
              <button
                type="submit"
                className="btn-add-user"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="spin-icon" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={15} />
                    <span>Autorizar E-mail</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Lista de Usuários Autorizados */}
          <div className="users-list-section">
            <div className="users-list-header">
              <div className="users-list-count">
                <UserCheck size={16} />
                <strong>E-mails Cadastrados</strong>
                <span className="badge-count">
                  {filteredUsers.length}/{usersQuery.data?.length ?? 0}
                </span>
              </div>
              <div className="users-list-tools">
                <button type="button" className="reset-column-widths" onClick={resetColumnWidths} title="Restaurar larguras padrão">
                  Restaurar colunas
                </button>
                <label className="users-role-filter">
                  <span className="sr-only">Filtrar por perfil</span>
                  <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "all" | "admin" | "user")} aria-label="Filtrar por perfil">
                    <option value="all">Todos os perfis</option>
                    <option value="admin">Administradores</option>
                    <option value="user">Usuários</option>
                  </select>
                </label>
                <label className="users-search-box">
                  <Search size={14} />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Buscar nome ou e-mail"
                    aria-label="Buscar usuário por nome ou e-mail"
                  />
                  {userSearch && (
                    <button type="button" onClick={() => setUserSearch("")} aria-label="Limpar busca">
                      <X size={13} />
                    </button>
                  )}
                </label>
              </div>
            </div>

            {editingServicesUser && (
              <section className="services-editor-panel" aria-label={`Editar serviços de ${editingServicesUser.name}`}>
                <div className="services-editor-heading">
                  <div>
                    <span className="services-editor-eyebrow">Permissões de visualização</span>
                    <strong>{editingServicesUser.name}</strong>
                    <small>{editingServicesUser.email}</small>
                  </div>
                  <button type="button" className="services-editor-close" onClick={handleCancelServicesEdit} aria-label="Fechar edição de serviços">
                    <X size={15} />
                  </button>
                </div>
                <div className="services-editor-actions">
                  <span>Selecione os serviços que este usuário poderá visualizar.</span>
                  <div>
                    <button type="button" className="services-inline-command" onClick={() => setEditingServices(availableServices)} disabled={updateServicesMutation.isPending}>Todos</button>
                    <button type="button" className="services-inline-command services-inline-command-clear" onClick={() => setEditingServices([])} disabled={updateServicesMutation.isPending}>Nenhum</button>
                  </div>
                </div>
                {renderServiceGroups(editingServices, toggleEditingService, true)}
                <div className="services-editor-footer">
                  <span>{editingServices.length} serviço(s) selecionado(s)</span>
                  <div>
                    <button type="button" className="btn-inline-cancel services-editor-cancel" onClick={handleCancelServicesEdit} disabled={updateServicesMutation.isPending}>Cancelar</button>
                    <button type="button" className="btn-inline-save services-editor-save" onClick={() => handleSaveServices(editingServicesUser.id)} disabled={updateServicesMutation.isPending}>
                      {updateServicesMutation.isPending ? <Loader2 size={13} className="spin-icon" /> : <Check size={13} />}
                      Salvar permissões
                    </button>
                  </div>
                </div>
              </section>
            )}

            {usersQuery.isLoading ? (
              <div className="mgmt-loading">
                <Loader2 size={24} className="spin-icon" />
                <span>Carregando lista de acessos...</span>
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="users-table-wrap">
                <table ref={tableRef} className={`users-table ${isResizingColumn ? "users-table-resizing" : ""}`}>
                  <colgroup>
                    {userTableColumns.map((column) => (
                      <col key={column} data-column={column} style={{ width: `${columnWidths[column]}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="resizable-table-header">
                        <button type="button" className="table-sort-button" onClick={() => handleSort("name")}>
                          Usuário
                          {sortKey === "name" ? (sortDirection === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} />}
                        </button>
                        <div className="column-resize-handle" onPointerDown={(event) => handleStartColumnResize("name", event)} role="separator" aria-label="Redimensionar coluna Usuário" />
                      </th>
                      <th className="resizable-table-header">
                        <button type="button" className="table-sort-button" onClick={() => handleSort("email")}>
                          E-mail
                          {sortKey === "email" ? (sortDirection === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} />}
                        </button>
                        <div className="column-resize-handle" onPointerDown={(event) => handleStartColumnResize("email", event)} role="separator" aria-label="Redimensionar coluna E-mail" />
                      </th>
                      <th className="resizable-table-header">
                        Perfil
                        <div className="column-resize-handle" onPointerDown={(event) => handleStartColumnResize("role", event)} role="separator" aria-label="Redimensionar coluna Perfil" />
                      </th>
                      <th className="resizable-table-header">
                        Serviços Permitidos
                        <div className="column-resize-handle" onPointerDown={(event) => handleStartColumnResize("services", event)} role="separator" aria-label="Redimensionar coluna Serviços Permitidos" />
                      </th>
                      <th className="resizable-table-header">
                        <button type="button" className="table-sort-button" onClick={() => handleSort("status")}>
                          Status
                          {sortKey === "status" ? (sortDirection === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} />}
                        </button>
                        <div className="column-resize-handle" onPointerDown={(event) => handleStartColumnResize("status", event)} role="separator" aria-label="Redimensionar coluna Status" />
                      </th>
                      <th className="resizable-table-header">
                        Cadastrado por
                        <div className="column-resize-handle" onPointerDown={(event) => handleStartColumnResize("addedBy", event)} role="separator" aria-label="Redimensionar coluna Cadastrado por" />
                      </th>
                      <th className="th-actions">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isMe =
                        currentUserEmail?.toLowerCase() ===
                        u.email.toLowerCase();
                      return (
                        <tr key={u.id} className={`${isMe ? "row-highlight" : ""} ${u.isActive === 0 ? "row-inactive" : ""}`}>
                          <td data-label="Usuário">
                            <div className="user-table-cell-user">
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt={u.name}
                                  className="user-table-avatar"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display =
                                      "none";
                                  }}
                                />
                              ) : (
                                <div className="user-table-avatar-fallback">
                                  {u.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              {editingUserId === u.id ? (
                                <div className="user-name-editor">
                                  <input
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSaveName(u.id);
                                      }
                                      if (e.key === "Escape") handleCancelNameEdit();
                                    }}
                                    className="user-name-edit-input"
                                    aria-label={`Editar nome de ${u.email}`}
                                    autoFocus
                                  />
                                  <div className="user-name-edit-actions">
                                    <button
                                      type="button"
                                      className="btn-inline-save"
                                      onClick={() => handleSaveName(u.id)}
                                      disabled={updateNameMutation.isPending}
                                      title="Salvar nome"
                                      aria-label="Salvar nome"
                                    >
                                      {updateNameMutation.isPending ? <Loader2 size={13} className="spin-icon" /> : <Check size={13} />}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-inline-cancel"
                                      onClick={handleCancelNameEdit}
                                      disabled={updateNameMutation.isPending}
                                      title="Cancelar edição"
                                      aria-label="Cancelar edição"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="user-table-name">
                                  <strong>{u.name}</strong>
                                  {isMe && <span className="tag-voce">Você</span>}
                                </div>
                              )}
                            </div>
                          </td>
                          <td data-label="E-mail" className="user-table-email td-email-clean">
                            <div className="email-cell-container">
                              <Mail size={13} className="email-icon" />
                              <span className="email-text" title={u.email} aria-label={u.email}>
                                {u.email}
                              </span>
                              <button
                                type="button"
                                className={`btn-copy-email ${copiedEmailId === u.id ? "btn-copy-email-copied" : ""}`}
                                onClick={() => handleCopyEmail(u.email, u.id)}
                                title={copiedEmailId === u.id ? "E-mail copiado" : "Copiar e-mail"}
                                aria-label={copiedEmailId === u.id ? `E-mail de ${u.name} copiado` : `Copiar e-mail de ${u.name}`}
                              >
                                {copiedEmailId === u.id ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </td>
                          <td data-label="Perfil">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(u.id, u.role)}
                              className={`role-pill role-pill-${u.role}`}
                              title="Clique para alternar permissão"
                              disabled={updateRoleMutation.isPending}
                            >
                              {u.role === "admin" ? (
                                <>
                                  <Shield size={12} />
                                  <span>ADMINISTRADOR</span>
                                </>
                              ) : (
                                <>
                                  <User size={12} />
                                  <span>USUÁRIO</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td data-label="Serviços" className="td-services">
                            {u.role === "admin" ? (
                              <span className="badge-all-services">Todos (Admin)</span>
                            ) : (
                              <div className="user-services-summary">
                                {u.allowedServices === null ? (
                                  <span className="badge-all-services">Todos</span>
                                ) : u.allowedServicesList && u.allowedServicesList.length > 0 ? (
                                  <div className="user-services-tags">
                                    {u.allowedServicesList.slice(0, 2).map((srv) => (
                                      <span key={srv} className="service-tag-item" title={srv}>{srv}</span>
                                    ))}
                                    {u.allowedServicesList.length > 2 && (
                                      <span className="service-tag-more">+{u.allowedServicesList.length - 2}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="badge-no-services">Nenhum</span>
                                )}
                                <button
                                  type="button"
                                  className="btn-services-edit"
                                  onClick={() => handleStartServicesEdit(u.id, u.allowedServices === null ? availableServices : (u.allowedServicesList || []))}
                                  title="Editar serviços permitidos"
                                  aria-label={`Editar serviços permitidos de ${u.email}`}
                                  disabled={editingServicesUserId === u.id || updateServicesMutation.isPending}
                                >
                                  <Pencil size={12} />
                                  <span>Editar</span>
                                </button>
                              </div>
                            )}
                          </td>
                          <td data-label="Status">
                            <span className={`status-pill ${u.isActive === 1 ? "status-pill-active" : "status-pill-inactive"}`}>
                              <span className="status-pill-dot" />
                              <span>{u.isActive === 1 ? "Ativo" : "Desativado"}</span>
                            </span>
                          </td>
                          <td data-label="Cadastrado por" className="user-table-addedby">
                            <span>{u.addedBy || "sistema"}</span>
                          </td>
                          <td data-label="Ações" className="td-actions">
                            <button
                              type="button"
                              className="btn-edit-user"
                              onClick={() => handleStartNameEdit(u.id, u.name)}
                              title="Editar nome da conta"
                              aria-label={`Editar nome de ${u.email}`}
                              disabled={(editingUserId !== null && editingUserId !== u.id) || updateNameMutation.isPending}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className={`btn-action-status ${u.isActive === 1 ? "btn-status-deactivate" : "btn-status-activate"}`}
                              onClick={() => handleToggleStatus(u.id, u.isActive, u.email)}
                              title={u.isActive === 1 ? "Desativar acesso" : "Reativar acesso"}
                              disabled={toggleStatusMutation.isPending}
                            >
                              {u.isActive === 1 ? <UserX size={15} /> : <Power size={15} />}
                            </button>
                            <button
                              type="button"
                              className="btn-remove-user"
                              onClick={() => handleRemove(u.id, u.email)}
                              title="Revogar autorização"
                              disabled={removeMutation.isPending}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mgmt-empty">
                <AlertCircle size={24} />
                <p>{userSearch || roleFilter !== "all" ? "Nenhum cadastro corresponde aos filtros selecionados." : "Nenhum e-mail autorizado encontrado."}</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-modal-close" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
