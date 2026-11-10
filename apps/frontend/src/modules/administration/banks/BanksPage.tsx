import "./BanksPage.css";
import "../catalogs/EnterpriseSurface.css";
import "../catalogs/CatalogItemsPage.css";
import "../catalogs/ProjectsView.css";
import "../components/CreateSystemUserDrawer.css";
import "../components/UserDetailDrawer.css";

import PlusOutlined from "@ant-design/icons/PlusOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Drawer from "antd/es/drawer";
import Empty from "antd/es/empty";
import Input from "antd/es/input";
import esES from "antd/es/locale/es_ES";
import Pagination from "antd/es/pagination";
import Select from "antd/es/select";
import Skeleton from "antd/es/skeleton";
import Space from "antd/es/space";
import Table from "antd/es/table";
import Tooltip from "antd/es/tooltip";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError, subscribeToSessionRefresh } from "../../../services/api/api-client";
import { getIdentityProfile } from "../../../services/auth/auth-service";
import type { IdentityProfile } from "../../../services/auth/identity-contracts";
import { type Bank, type BankAdvisor, type BankPage, createBank, createBankAdvisor, getBank, listBankAdvisors, listBanks, updateBank, updateBankAdvisor, updateBankAdvisorStatus, updateBankStatus } from "../../../services/catalogs/banks-service";
import type { CatalogContextModuleCode } from "../../../services/catalogs/catalog-service";
import { ADMINISTRATION_DRAWER_PROPS } from "../administration-theme";
import { ADMINISTRATION_CATALOGS } from "../catalogs/catalog-definitions";
import { type CatalogPermissions, getCatalogPermissions, NO_CATALOG_PERMISSIONS } from "../catalogs/catalog-permissions";
import { buildBankCards } from "../catalogs/catalog-summary";
import { CatalogBanners } from "../catalogs/CatalogSummary";
import { PROJECTS_THEME } from "../catalogs/projects-theme";
import { type BankDialog, BankFormDrawer, type BankFormValues } from "./BankFormDrawer";

const BANK_CATALOG = ADMINISTRATION_CATALOGS.find((catalog) => catalog.code === "banks");
if (!BANK_CATALOG) throw new Error("Falta la definición del catálogo Bancos.");
const bankCatalog = BANK_CATALOG;
const identityKey = (profile: IdentityProfile): string => `${profile.user.publicId}:${profile.session.publicId}`;
// Un perfil tardío de otra cuenta o sesión no autoriza el borrador de esta página.
const snapshotPermissions = (profile: IdentityProfile, context: CatalogContextModuleCode, identity: string): CatalogPermissions => (identityKey(profile) === identity ? getCatalogPermissions(profile, bankCatalog, context) : NO_CATALOG_PERMISSIONS);
const EMPTY_BANKS: BankPage<Bank> = { items: [], total: 0 };
const EMPTY_ADVISORS: BankPage<BankAdvisor> = { items: [], total: 0 };
type Filters = { search: string; status: "all" | "active" | "inactive"; page: number };
const INITIAL_FILTERS: Filters = { search: "", status: "all", page: 1 };
const labelStatus = (status: string) => (status === "active" ? "Activo" : "Inactivo");
/** La misma pastilla de estado que usan los demás catálogos. */
const StatusPill = ({ status }: { readonly status: string }) => <span className={`catalog-items-status catalog-items-status--${status === "active" ? "active" : "inactive"}`}>{labelStatus(status)}</span>;
const messageFor = (error: unknown, fallback: string): string => {
    if (!(error instanceof ApiClientError) || !error.responseBody || typeof error.responseBody !== "object" || !("message" in error.responseBody)) return fallback;
    const message = error.responseBody.message;
    return typeof message === "string" ? message : Array.isArray(message) ? message.filter((part): part is string => typeof part === "string").join(" ") : fallback;
};
const isAuthorizationFailure = (error: unknown): boolean => error instanceof ApiClientError && [401, 403].includes(error.status);
function bankErrorCode(error: unknown): string | null {
    if (!(error instanceof ApiClientError) || !error.responseBody || typeof error.responseBody !== "object") return null;
    return "code" in error.responseBody && typeof error.responseBody.code === "string" ? error.responseBody.code : null;
}
function BankFilters({ value, onChange, label }: { readonly value: Filters; readonly onChange: (value: Filters) => void; readonly label: string }) {
    return (
        <div className="banks-toolbar">
            <Input.Search
                aria-label={`Buscar ${label}`}
                placeholder={`Buscar ${label}`}
                allowClear
                onSearch={(search) => {
                    onChange({ ...value, search, page: 1 });
                }}
            />
            <Select
                aria-label={`Estado de ${label}`}
                value={value.status}
                onChange={(status) => {
                    onChange({ ...value, status, page: 1 });
                }}
                options={[
                    { value: "all", label: "Todos los estados" },
                    { value: "active", label: "Activos" },
                    { value: "inactive", label: "Inactivos" },
                ]}
            />
        </div>
    );
}
async function dispatchBankChange(target: BankDialog, values: BankFormValues, context: CatalogContextModuleCode, signal: AbortSignal): Promise<void> {
    const reason = values.reason.trim();
    if (target.kind === "status") {
        const body = { moduleCode: context, reason, status: target.item.status === "active" ? ("inactive" as const) : ("active" as const), expectedVersion: target.item.version };
        if (target.bankId) await updateBankAdvisorStatus(target.bankId, target.item.publicId, body, signal);
        else await updateBankStatus(target.item.publicId, body, signal);
    } else if (target.kind === "bank") {
        const body = { moduleCode: context, reason, name: values.name.trim() };
        if (target.item) await updateBank(target.item.publicId, { ...body, expectedVersion: target.item.version }, signal);
        else await createBank(body, signal);
    } else await dispatchAdvisorChange(target, values, context, signal);
}
async function dispatchAdvisorChange(target: Extract<BankDialog, { kind: "advisor" }>, values: BankFormValues, context: CatalogContextModuleCode, signal: AbortSignal): Promise<void> {
    const reason = values.reason.trim();
    const body = { moduleCode: context, reason, name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(), area: values.area.trim() };
    if (target.item) await updateBankAdvisor(target.bankId, target.item.publicId, { ...body, expectedVersion: target.item.version }, signal);
    else await createBankAdvisor(target.bankId, body, signal);
}
function writableDialog(dialog: BankDialog | null, saving: boolean, blocked: boolean): BankDialog | null {
    return saving || blocked ? null : dialog;
}
function canSubmit(target: BankDialog, permissions: CatalogPermissions): boolean {
    if (!permissions.read) return false;
    if (target.kind === "status") return target.item.status === "active" ? permissions.inactivate : permissions.update;
    return target.item ? permissions.update : permissions.create;
}

/** Flujo nativo propio de bancos. La época de sesión y de contexto descarta lecturas viejas y evita que un preflight tardío escriba. */
function useBanks(contextModuleCode: CatalogContextModuleCode) {
    const epoch = useRef(0);
    const identity = useRef("");

    const [permissions, setPermissions] = useState<CatalogPermissions>(NO_CATALOG_PERMISSIONS);
    const permissionsRef = useRef(NO_CATALOG_PERMISSIONS);
    const [authorizing, setAuthorizing] = useState(true);
    const [authorizationFailed, setAuthorizationFailed] = useState(false);
    const [authorizationAttempt, setAuthorizationAttempt] = useState(0);
    const [banks, setBanks] = useState(EMPTY_BANKS);
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Bank | null>(null);
    const [advisors, setAdvisors] = useState(EMPTY_ADVISORS);
    const [advisorFilters, setAdvisorFilters] = useState(INITIAL_FILTERS);
    const [advisorLoading, setAdvisorLoading] = useState(false);
    const [advisorError, setAdvisorError] = useState<string | null>(null);
    const [refresh, setRefresh] = useState(0);
    const [dialog, setDialog] = useState<BankDialog | null>(null);
    const dialogRef = useRef<BankDialog | null>(null);

    const writeSequence = useRef(0);
    const writeController = useRef<AbortController | null>(null);
    const savingRef = useRef(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [blocked, setBlocked] = useState(false);
    const closeDialog = () => {
        writeController.current?.abort();
        writeSequence.current++;
        dialogRef.current = null;
        setDialog(null);
        setFormError(null);
        setBlocked(false);
        setSaving(false);
        savingRef.current = false;
    };
    const openDialog = (next: BankDialog) => {
        writeController.current?.abort();
        writeSequence.current++;
        dialogRef.current = next;
        setFormError(null);
        setBlocked(false);
        setDialog(next);
    };
    const selectedId = selected?.publicId;
    useEffect(() => {
        let active = true;
        const authorize = () => {
            writeController.current?.abort();
            const token = ++epoch.current;
            writeSequence.current++;
            dialogRef.current = null;
            permissionsRef.current = NO_CATALOG_PERMISSIONS;
            savingRef.current = false;
            setPermissions(NO_CATALOG_PERMISSIONS);
            setAuthorizing(true);
            setAuthorizationFailed(false);
            setBanks(EMPTY_BANKS);
            setSelected(null);
            setAdvisors(EMPTY_ADVISORS);
            setDialog(null);
            setSaving(false);
            setError(null);
            setFormError(null);
            void getIdentityProfile()
                .then((profile) => {
                    if (!active || token !== epoch.current) return;
                    identity.current = identityKey(profile);
                    const next = getCatalogPermissions(profile, bankCatalog, contextModuleCode);
                    permissionsRef.current = next;
                    setPermissions(next);
                })
                .catch(() => {
                    // Una consulta fallida no demuestra una denegación de permisos.
                    if (active && token === epoch.current) setAuthorizationFailed(true);
                })
                .finally(() => {
                    if (active && token === epoch.current) {
                        setAuthorizing(false);
                        setLoading(false);
                    }
                });
        };
        authorize();
        const unsubscribe = subscribeToSessionRefresh(authorize);
        const invalidate = () => {
            writeController.current?.abort();
            epoch.current++;
            writeSequence.current++;
        };
        return () => {
            active = false;
            invalidate();
            dialogRef.current = null;
            permissionsRef.current = NO_CATALOG_PERMISSIONS;
            unsubscribe();
        };
    }, [contextModuleCode, authorizationAttempt]);
    useEffect(() => {
        if (!permissions.read) return;
        let active = true;
        const token = epoch.current;
        queueMicrotask(() => {
            if (active) {
                setLoading(true);
                setError(null);
            }
        });
        void listBanks({ moduleCode: contextModuleCode, search: filters.search, status: filters.status, limit: 500, offset: (filters.page - 1) * 500 })
            .then((result) => {
                if (active && token === epoch.current) setBanks(result);
            })
            .catch((failure: unknown) => {
                if (active && token === epoch.current) {
                    setBanks(EMPTY_BANKS);
                    setError(messageFor(failure, "No pudimos cargar los bancos."));
                }
            })
            .finally(() => {
                if (active && token === epoch.current) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [contextModuleCode, filters, permissions.read, refresh]);
    useEffect(() => {
        if (!selectedId || !permissions.read) return;
        let active = true;
        const token = epoch.current;
        queueMicrotask(() => {
            if (active) {
                setAdvisorLoading(true);
                setAdvisorError(null);
                setAdvisors(EMPTY_ADVISORS);
            }
        });
        void Promise.all([getBank(selectedId, contextModuleCode), listBankAdvisors(selectedId, { moduleCode: contextModuleCode, search: advisorFilters.search, status: advisorFilters.status, limit: 25, offset: (advisorFilters.page - 1) * 25 })])
            .then(([bank, result]) => {
                if (active && token === epoch.current) {
                    setSelected(bank);
                    setAdvisors(result);
                }
            })
            .catch((failure: unknown) => {
                if (active && token === epoch.current) setAdvisorError(messageFor(failure, "No pudimos cargar los ejecutivos."));
            })
            .finally(() => {
                if (active && token === epoch.current) setAdvisorLoading(false);
            });
        return () => {
            active = false;
        };
    }, [selectedId, contextModuleCode, advisorFilters, permissions.read, refresh]);
    const reload = useCallback(() => {
        setRefresh((value) => value + 1);
    }, []);
    const handleFailure = (failure: unknown) => {
        if (bankErrorCode(failure) === "BANK_DUPLICATE") {
            setFormError(messageFor(failure, "El registro ya existe."));
            return;
        }
        if (isAuthorizationFailure(failure)) {
            permissionsRef.current = NO_CATALOG_PERMISSIONS;
            setPermissions(NO_CATALOG_PERMISSIONS);
            setBanks(EMPTY_BANKS);
            setAdvisors(EMPTY_ADVISORS);
            setSelected(null);
            closeDialog();
            return;
        }
        if (failure instanceof ApiClientError && failure.status === 409) {
            setBlocked(true);
            setFormError(`${messageFor(failure, "El registro cambió.")} Actualiza los datos y vuelve a abrir la edición. Conservamos tu borrador para consulta.`);
            reload();
        } else if (!(failure instanceof ApiClientError) || failure.status >= 500) {
            setBlocked(true);
            setFormError("No pudimos confirmar el resultado. Conservamos tu borrador. Actualiza los datos antes de iniciar otra operación; no vuelvas a enviar a ciegas.");
        } else setFormError(messageFor(failure, "No pudimos guardar el cambio."));
    };
    const save = async (values: BankFormValues) => {
        const target = writableDialog(dialogRef.current, savingRef.current, blocked);
        if (!target) return;
        const token = epoch.current;
        const sequence = ++writeSequence.current;
        const context = contextModuleCode;
        const controller = new AbortController();
        writeController.current = controller;
        savingRef.current = true;
        setSaving(true);
        setFormError(null);
        const current = () => token === epoch.current && sequence === writeSequence.current;
        try {
            const profile = await getIdentityProfile();
            if (!current()) return;
            const next = snapshotPermissions(profile, context, identity.current);
            permissionsRef.current = next;
            setPermissions(next);
            const can = canSubmit(target, next);
            if (!can) {
                closeDialog();
                setError("Tu acceso cambió. Actualiza la sesión para continuar.");
                return;
            }
            await dispatchBankChange(target, values, context, controller.signal);
            if (current()) {
                closeDialog();
                reload();
            }
        } catch (failure: unknown) {
            if (!current()) return;
            handleFailure(failure);
        } finally {
            if (current()) {
                savingRef.current = false;
                setSaving(false);
            }
        }
    };
    const advisorCreateDisabled = selected?.status !== "active" || advisorLoading || Boolean(advisorError);
    return {
        advisorCreateDisabled,
        permissions,
        authorizing,
        authorizationFailed,
        retryAuthorization: () => {
            setAuthorizationAttempt((value) => value + 1);
        },
        banks,
        filters,
        setFilters,
        loading,
        error,
        selected,
        setSelected,
        advisors,
        setAdvisors,
        advisorFilters,
        setAdvisorFilters,
        advisorLoading,
        advisorError,
        dialog,
        saving,
        formError,
        blocked,
        closeDialog,
        openDialog,
        reload,
        save,
    };
}
/** Distingue una verificación fallida de una denegación confirmada por el perfil. */
function BankAccessNotice({ failed, onRetry }: { readonly failed: boolean; readonly onRetry: () => void }) {
    return (
        <section className="banks-page global-home-dashboard catalog-items-page catalog-items-page--projects">
            <Alert type="warning" showIcon title={failed ? "No fue posible verificar el acceso a Bancos" : "Sin acceso a Bancos"} description={failed ? "No pudimos consultar tus permisos. Reintenta la consulta." : "Este catálogo requiere permiso de lectura en el módulo actual."} action={failed ? <Button onClick={onRetry}>Reintentar verificación</Button> : undefined} />
        </section>
    );
}
/** Encabezado con ruta, total y acciones, con la misma disposición que el resto de catálogos. */
function BankHeader({ label, loading, total, canCreate, onRefresh, onCreate }: { readonly label: string; readonly loading: boolean; readonly total: number; readonly canCreate: boolean; readonly onRefresh: () => void; readonly onCreate: () => void }) {
    return (
        <section className="global-home-page-header administration-users-page-header" aria-labelledby="banks-page-title">
            <div>
                <nav className="administration-users-breadcrumb" aria-label="Ruta">
                    <span>{label}</span>
                    <span aria-hidden="true">/</span>
                    <span>Catálogos</span>
                    <span aria-hidden="true">/</span>
                    <span>Bancos</span>
                </nav>
                <div className="projects-view-title-row">
                    <h1 id="banks-page-title">Bancos</h1>
                    {!loading && (
                        <span className="projects-view-total">
                            {total} {total === 1 ? "banco" : "bancos"}
                        </span>
                    )}
                </div>
                <p>Entidades bancarias y sus ejecutivos de contacto.</p>
            </div>
            <div className="global-home-page-header__actions">
                <Tooltip title="Actualizar bancos">
                    <Button className="projects-view-refresh" aria-label="Actualizar bancos" icon={<ReloadOutlined spin={loading} />} disabled={loading} onClick={onRefresh} />
                </Tooltip>
                {canCreate ? (
                    <button className="global-home-page-header__primary" type="button" onClick={onCreate}>
                        <PlusOutlined aria-hidden="true" />
                        Nuevo banco
                    </button>
                ) : null}
            </div>
        </section>
    );
}
/** El espacio de banco y ejecutivo conserva la identidad nativa y el permiso exacto de cada acción. */
export function BanksPage({ contextLabel = "Administración", contextModuleCode = "administration" }: { readonly contextLabel?: string; readonly contextModuleCode?: CatalogContextModuleCode }) {
    const model = useBanks(contextModuleCode);
    const { permissions, authorizing, authorizationFailed, retryAuthorization, banks, loading, dialog, saving, formError, blocked, closeDialog, openDialog, reload, save } = model;
    const actionButtons = (item: Bank | BankAdvisor, bankId?: string) => (
        <Space wrap>
            {permissions.update ? (
                <Button
                    size="small"
                    onClick={() => {
                        openDialog("bankPublicId" in item ? { kind: "advisor", item, bankId: item.bankPublicId } : { kind: "bank", item });
                    }}
                >
                    Editar
                </Button>
            ) : null}
            {(item.status === "active" ? permissions.inactivate : permissions.update) ? (
                <Button
                    size="small"
                    onClick={() => {
                        openDialog({ kind: "status", item, ...(bankId ? { bankId } : {}) });
                    }}
                >
                    {item.status === "active" ? "Inactivar" : "Reactivar"}
                </Button>
            ) : null}
        </Space>
    );
    if (authorizing)
        return (
            <section className="banks-page global-home-dashboard catalog-items-page catalog-items-page--projects" aria-label="Cargando permisos de Bancos">
                <Skeleton active paragraph={{ rows: 6 }} />
            </section>
        );
    if (!permissions.read) return <BankAccessNotice failed={authorizationFailed} onRetry={retryAuthorization} />;
    return (
        <ConfigProvider locale={esES} theme={PROJECTS_THEME}>
            <div className="global-home-dashboard catalog-items-page catalog-items-page--banks catalog-items-page--projects banks-page">
                <BankHeader
                    label={contextLabel}
                    loading={loading}
                    total={banks.total}
                    canCreate={permissions.create}
                    onRefresh={reload}
                    onCreate={() => {
                        openDialog({ kind: "bank", item: null });
                    }}
                />
                <CatalogBanners label="Resumen de Bancos" cards={buildBankCards({ items: banks.items, total: banks.total, ready: !loading })} />
                <BankList model={model} actionButtons={actionButtons} />
                <BankDetail model={model} actionButtons={actionButtons} />
                {dialog ? (
                    <BankFormDrawer
                        dialog={dialog}
                        saving={saving}
                        error={formError}
                        blocked={blocked}
                        onClose={closeDialog}
                        onSubmit={(values) => {
                            void save(values);
                        }}
                    />
                ) : null}
            </div>
        </ConfigProvider>
    );
}

type BankModel = ReturnType<typeof useBanks>;
type ActionButtons = (item: Bank | BankAdvisor, bankId?: string) => ReactNode;
function BankList({ model, actionButtons }: { readonly model: BankModel; readonly actionButtons: ActionButtons }) {
    const { banks, filters, setFilters, loading, error, reload, setAdvisorFilters, setSelected } = model;
    return (
        <section className="catalog-items-panel banks-panel" aria-label="Listado de bancos" aria-busy={loading}>
            <div className="catalog-section-heading">
                <h2>Listado de bancos</h2>
                <p>Busca o filtra y abre un banco para ver y administrar sus ejecutivos.</p>
            </div>
            <BankFilters value={filters} onChange={setFilters} label="bancos" />
            {error ? <Alert type="error" title={error} action={<Button onClick={reload}>Reintentar lectura</Button>} /> : null}
            {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
                <Table<Bank>
                    rowKey="publicId"
                    dataSource={[...banks.items]}
                    pagination={false}
                    scroll={{ x: 620 }}
                    locale={{ emptyText: <Empty description="No hay bancos con estos filtros." /> }}
                    columns={[
                        {
                            title: "Banco",
                            dataIndex: "name",
                            render: (_: unknown, item: Bank) => (
                                <Button
                                    type="link"
                                    className="banks-name"
                                    onClick={() => {
                                        setAdvisorFilters(INITIAL_FILTERS);
                                        setSelected(item);
                                    }}
                                >
                                    {item.name}
                                </Button>
                            ),
                        },
                        { title: "Estado", dataIndex: "status", render: (status: string) => <StatusPill status={status} /> },
                        { title: "Ejecutivos", dataIndex: "advisorCount" },
                        { title: "Acciones", key: "actions", render: (_: unknown, item: Bank) => actionButtons(item) },
                    ]}
                />
            )}
            <Pagination
                current={filters.page}
                pageSize={500}
                total={banks.total}
                showSizeChanger={false}
                showTotal={(total) => `${String(total)} bancos`}
                onChange={(page) => {
                    setFilters({ ...filters, page });
                }}
            />
        </section>
    );
}
function BankDetail({ model, actionButtons }: { readonly model: BankModel; readonly actionButtons: ActionButtons }) {
    const { advisorCreateDisabled, selected, setSelected, setAdvisors, closeDialog, permissions, advisors, advisorLoading, advisorError, advisorFilters, setAdvisorFilters, reload, openDialog } = model;
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            rootClassName="create-user-drawer banks-detail"
            title={selected?.name ?? "Banco"}
            open={Boolean(selected)}
            onClose={() => {
                closeDialog();
                setSelected(null);
                setAdvisors(EMPTY_ADVISORS);
            }}
        >
            {selected ? (
                <>
                    <div className="banks-detail__summary">
                        <StatusPill status={selected.status} />
                        <span>{selected.advisorCount} ejecutivos</span>
                        {actionButtons(selected)}
                    </div>
                    <section className="create-user-drawer__section banks-detail__section" aria-labelledby="bank-advisors-title">
                        <header className="create-user-drawer__section-header">
                            <span className="create-user-drawer__step" aria-hidden="true">
                                1
                            </span>
                            <h3 id="bank-advisors-title">Ejecutivos bancarios</h3>
                        </header>
                        <p className="banks-detail__lead">Información de contacto vinculada a este banco.</p>
                        {selected.status === "inactive" ? <Alert type="info" title="Un banco inactivo no admite nuevos ejecutivos. Los contactos existentes conservan su estado." /> : null}
                        <Space className="banks-detail__actions">
                            <Button onClick={reload}>Actualizar ejecutivos</Button>
                            {permissions.create ? (
                                <Button
                                    type="primary"
                                    disabled={advisorCreateDisabled}
                                    onClick={() => {
                                        openDialog({ kind: "advisor", item: null, bankId: selected.publicId });
                                    }}
                                >
                                    <PlusOutlined aria-hidden="true" />
                                    Nuevo ejecutivo
                                </Button>
                            ) : null}
                        </Space>
                        <BankFilters value={advisorFilters} onChange={setAdvisorFilters} label="ejecutivos" />
                        {advisorError ? <Alert type="error" title={advisorError} /> : null}
                        {advisorLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : <BankContacts advisors={advisors} advisorError={advisorError} bankId={selected.publicId} actionButtons={actionButtons} />}
                        <Pagination
                            current={advisorFilters.page}
                            pageSize={25}
                            total={advisors.total}
                            showSizeChanger={false}
                            showTotal={(total) => `${String(total)} ejecutivos`}
                            onChange={(page) => {
                                setAdvisorFilters({ ...advisorFilters, page });
                            }}
                        />
                    </section>
                </>
            ) : null}
        </Drawer>
    );
}

function BankContacts({ advisors, advisorError, bankId, actionButtons }: { readonly advisors: BankPage<BankAdvisor>; readonly advisorError: string | null; readonly bankId: string; readonly actionButtons: ActionButtons }) {
    return (
        <div className="banks-contacts">
            {advisors.items.length ? (
                advisors.items.map((item) => (
                    <article key={item.publicId} className="banks-contact">
                        <header>
                            <h3>{item.name}</h3>
                            <StatusPill status={item.status} />
                        </header>
                        <dl>
                            <dt>Correo</dt>
                            <dd>{item.email}</dd>
                            <dt>Teléfono</dt>
                            <dd>{item.phone}</dd>
                            <dt>Área</dt>
                            <dd>{item.area}</dd>
                        </dl>
                        {actionButtons(item, bankId)}
                    </article>
                ))
            ) : !advisorError ? (
                <Empty description="No hay ejecutivos con estos filtros." />
            ) : null}
        </div>
    );
}
