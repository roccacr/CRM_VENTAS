/**
 * Pantalla reutilizable de valores de un catálogo CRM.
 *
 * La misma página sirve en Administración y en los perfiles operativos: el
 * catálogo y el módulo de contexto llegan por props. Crear, editar y cambiar
 * estado exigen un motivo porque el API audita cada cambio. Esta pantalla
 * protege visualmente cada acción con permisos efectivos; el BFF conserva la
 * autorización definitiva de cada llamada.
 */
import "./CatalogItemsPage.css";
import "./ProjectsView.css";

import DoubleLeftOutlined from "@ant-design/icons/DoubleLeftOutlined";
import DoubleRightOutlined from "@ant-design/icons/DoubleRightOutlined";
import LeftOutlined from "@ant-design/icons/LeftOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Form from "antd/es/form";
import Input from "antd/es/input";
import esES from "antd/es/locale/es_ES";
import message from "antd/es/message";
import Modal from "antd/es/modal";
import Tooltip from "antd/es/tooltip";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../../services/api/api-client";
import { getIdentityProfile } from "../../../services/auth/auth-service";
import { type CatalogContextModuleCode, type CatalogExternalReferencePayload, type CatalogItem, type CatalogItemPayload, type CatalogItemStatus, createCatalogItem, listCatalogItems, updateCatalogItem, updateCatalogItemStatus } from "../../../services/catalogs/catalog-service";
import { ADMINISTRATION_MODAL_Z_INDEX, ADMINISTRATION_THEME } from "../administration-theme";
import { BROKERS_FORM_COPY, BROKERS_NAME_MAX_LENGTH } from "../brokers/brokers-definition";
import { CAMPAIGNS_FORM_COPY } from "../campaigns/campaigns-definition";
import { CLASSES_FORM_COPY, CLASSES_NAME_MAX_LENGTH } from "../classes/classes-definition";
import { LOCATIONS_FORM_COPY, LOCATIONS_NAME_MAX_LENGTH } from "../locations/locations-definition";
import { SUBSIDIARIES_FORM_COPY, SUBSIDIARIES_NAME_MAX_LENGTH } from "../subsidiaries/subsidiaries-definition";
import { type AdministrationCatalogDefinition, CATALOG_REFERENCE_PROVIDERS, getCatalogPresentation } from "./catalog-definitions";
import { type CatalogPermissions, getCatalogPermissions, NO_CATALOG_PERMISSIONS } from "./catalog-permissions";
import { CatalogItemDetailDrawer } from "./CatalogItemDetailDrawer";
import { CatalogItemsDataTable } from "./CatalogItemsDataTable";
import { PROJECTS_THEME } from "./projects-theme";

/** Mínimo que el formulario exige antes de enviar un motivo auditable. */
const MIN_REASON_LENGTH = 5;
const STATUS_LABELS: Record<CatalogItemStatus, string> = { active: "Activo", inactive: "Inactivo" };
/** Sistemas externos cuyas referencias se capturan en el formulario. */
const PROVIDER_OPTIONS = CATALOG_REFERENCE_PROVIDERS.map((provider) => provider.systemCode);

/** Cuerpo del formulario. El módulo de contexto lo agrega la página al guardar. */
type CatalogItemFormPayload = Omit<CatalogItemPayload, "moduleCode">;

/** Campos editables. Los ids externos son opcionales y se omiten si quedan en blanco. */
interface CatalogItemFormValues {
    detail?: string;
    name: string;
    netsuiteId?: string;
    odooId?: string;
    reason: string;
}

/** Catálogo a administrar y el módulo desde el que se abre. */
interface CatalogItemsPageProps {
    readonly catalog: AdministrationCatalogDefinition;
    readonly contextLabel?: string;
    readonly contextModuleCode?: CatalogContextModuleCode;
}

/** Cambio de estado pendiente de confirmación y de motivo. */
interface StatusAction {
    readonly item: CatalogItem;
    readonly status: CatalogItemStatus;
}

/**
 * Texto del BFF cuando viene como `message` string o lista de strings.
 *
 * Cualquier otro error usa el texto de respaldo para no mostrar estado HTTP ni cuerpos crudos.
 *
 * @param error - Fallo de la llamada
 * @param fallback - Mensaje neutro si el cuerpo no trae un texto usable
 */
const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof ApiClientError)) {
        return fallback;
    }

    const responseBody = error.responseBody;
    if (!responseBody || typeof responseBody !== "object" || !("message" in responseBody)) {
        return fallback;
    }

    const message = (responseBody as { readonly message?: unknown }).message;
    return Array.isArray(message) ? message.filter((item): item is string => typeof item === "string").join(" ") : typeof message === "string" && message.length > 0 ? message : fallback;
};

/** Arma solo las referencias cuyo id quedó con texto. Un campo vacío no se envía. */
const buildExternalReferences = (values: CatalogItemFormValues): CatalogExternalReferencePayload[] =>
    PROVIDER_OPTIONS.flatMap((systemCode) => {
        const externalId = systemCode === "netsuite" ? values.netsuiteId?.trim() : values.odooId?.trim();
        return externalId ? [{ externalId, systemCode }] : [];
    });

/** Id externo ya guardado, para precargar el formulario de edición. */
const getReferenceValue = (item: CatalogItem | null, systemCode: "netsuite" | "odoo"): string | undefined => item?.externalReferences.find((reference) => reference.systemCode === systemCode)?.externalId;

/** Titulo, boton de alta y ejemplo del modal; Proyectos y Campañas usan su sustantivo en singular. */
/** El detalle recorre el orden y filtro visibles de la tabla; si el registro abierto quedó fuera, usa el listado cargado. */
const getNavigationItems = (items: readonly CatalogItem[], visibleOrder: readonly string[] | null, selectedItem: CatalogItem | null, projectView: boolean): readonly CatalogItem[] => {
    if (!projectView || !visibleOrder || !selectedItem || !visibleOrder.includes(selectedItem.publicId)) return items;
    const byId = new Map(items.map((item) => [item.publicId, item]));
    return visibleOrder.flatMap((publicId) => byId.get(publicId) ?? []);
};

const getModalCopy = (catalog: AdministrationCatalogDefinition, isEdit: boolean) => {
    const domainCopy: Partial<Record<AdministrationCatalogDefinition["code"], typeof CAMPAIGNS_FORM_COPY>> = { campaigns: CAMPAIGNS_FORM_COPY, classes: CLASSES_FORM_COPY, locations: LOCATIONS_FORM_COPY, subsidiaries: SUBSIDIARIES_FORM_COPY, brokers: BROKERS_FORM_COPY };
    const copy = domainCopy[catalog.code];
    if (copy) {
        return { placeholder: copy.placeholder, submit: copy.submit, title: isEdit ? copy.editTitle : copy.createTitle };
    }
    if (catalog.code === "projects") {
        return { placeholder: "Ej. Proyecto principal", submit: "Crear proyecto", title: isEdit ? "Editar proyecto" : "Nuevo proyecto" };
    }
    return { placeholder: `Ej. ${catalog.label} principal`, submit: "Crear valor", title: isEdit ? `Editar ${catalog.label}` : `Nuevo ${catalog.label}` };
};

/** Proyectos arranca con dos líneas y crece con el texto, para que el formulario quepa sin scroll en escritorio. */
const getTextAreaSizes = (projectView: boolean) => (projectView ? { detail: { autoSize: { minRows: 2, maxRows: 6 } }, reason: { autoSize: { minRows: 2, maxRows: 4 } } } : { detail: { rows: 3 }, reason: { rows: 4 } });

/** Approved catalog opt-ins share the drawer hierarchy without changing other forms. */
function CatalogFormSection({ projectView, title, children }: { readonly projectView: boolean; readonly title: string; readonly children: ReactNode }) {
    return projectView ? (
        <fieldset className="projects-view-form-section">
            <legend>{title}</legend>
            <div>{children}</div>
        </fieldset>
    ) : (
        <>{children}</>
    );
}

/**
 * Alta o edición de un valor.
 *
 * El motivo se vacía en cada apertura: un motivo anterior no debe reutilizarse
 * para auditar un cambio nuevo.
 */
function CatalogItemModal({ catalog, initialItem, isSaving, open, error, onClose, onSubmit }: { readonly catalog: AdministrationCatalogDefinition; readonly error: string | null; readonly initialItem: CatalogItem | null; readonly isSaving: boolean; readonly onClose: () => void; readonly onSubmit: (payload: CatalogItemFormPayload) => void; readonly open: boolean }) {
    const [form] = Form.useForm<CatalogItemFormValues>();
    const isEdit = initialItem !== null;
    const projectView = getCatalogPresentation(catalog.code).enhanced;
    const copy = getModalCopy(catalog, isEdit);
    const nameLimits: Partial<Record<AdministrationCatalogDefinition["code"], number>> = { locations: LOCATIONS_NAME_MAX_LENGTH, classes: CLASSES_NAME_MAX_LENGTH, subsidiaries: SUBSIDIARIES_NAME_MAX_LENGTH, brokers: BROKERS_NAME_MAX_LENGTH };
    const nameMaxLength = nameLimits[catalog.code];
    const textAreaSizes = getTextAreaSizes(projectView);

    useEffect(() => {
        if (!open) {
            return;
        }

        form.setFieldsValue({
            detail: initialItem?.detail ?? "",
            name: initialItem?.name ?? "",
            netsuiteId: getReferenceValue(initialItem, "netsuite") ?? "",
            odooId: getReferenceValue(initialItem, "odoo") ?? "",
            reason: "",
        });
    }, [form, initialItem, open]);

    const submit = (): void => {
        void form.validateFields().then((values) => {
            const detail = values.detail?.trim();
            onSubmit({
                externalReferences: buildExternalReferences(values),
                name: values.name.trim(),
                reason: values.reason.trim(),
                ...(detail ? { detail } : {}),
            });
        });
    };

    return (
        <Modal
            centered
            forceRender
            className={`catalog-items-modal${projectView ? " catalog-items-modal--projects" : ""}`}
            footer={
                <div className="catalog-items-modal__footer">
                    <Button disabled={isSaving} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="primary" loading={isSaving} onClick={submit}>
                        <SaveOutlined />
                        {isEdit ? "Guardar cambios" : copy.submit}
                    </Button>
                </div>
            }
            open={open}
            title={
                <div className="catalog-items-modal__title">
                    <h2>{copy.title}</h2>
                    <p>Valor nativo CRM con referencias opcionales de NetSuite, Odoo u otros proveedores.</p>
                </div>
            }
            zIndex={ADMINISTRATION_MODAL_Z_INDEX}
            onCancel={onClose}
        >
            <Form form={form} layout="vertical" requiredMark="optional">
                {error ? <div className="catalog-items-error">{error}</div> : null}
                <CatalogFormSection projectView={projectView} title="Información del registro">
                    <Form.Item<CatalogItemFormValues> label="Nombre" name="name" rules={[{ min: 2, message: "Agrega un nombre válido." }, { required: true, message: "El nombre es obligatorio." }, ...(nameMaxLength ? [{ max: nameMaxLength, message: `El nombre admite hasta ${String(nameMaxLength)} caracteres.` }] : [])]}>
                        <Input placeholder={copy.placeholder} {...(nameMaxLength ? { maxLength: nameMaxLength } : {})} />
                    </Form.Item>
                    <Form.Item<CatalogItemFormValues> label="Detalle" name="detail">
                        <Input.TextArea {...textAreaSizes.detail} maxLength={500} showCount placeholder="Detalle operativo visible para administración." />
                    </Form.Item>
                </CatalogFormSection>
                <div className="catalog-items-modal__grid">
                    <CatalogFormSection projectView={projectView} title="NetSuite">
                        <Form.Item<CatalogItemFormValues> label="ID NetSuite" name="netsuiteId">
                            <Input />
                        </Form.Item>
                    </CatalogFormSection>
                    <CatalogFormSection projectView={projectView} title="Odoo">
                        <Form.Item<CatalogItemFormValues> label="ID Odoo" name="odooId">
                            <Input />
                        </Form.Item>
                    </CatalogFormSection>
                </div>
                <CatalogFormSection projectView={projectView} title="Auditoría">
                    <Form.Item<CatalogItemFormValues>
                        label="Motivo de auditoría"
                        name="reason"
                        rules={[
                            { min: MIN_REASON_LENGTH, message: "Agrega un motivo auditable de al menos 5 caracteres." },
                            { required: true, message: "El motivo es obligatorio." },
                        ]}
                    >
                        <Input.TextArea {...textAreaSizes.reason} maxLength={255} showCount placeholder="Ej. Alta autorizada por jefatura." />
                    </Form.Item>
                </CatalogFormSection>
            </Form>
        </Modal>
    );
}

/**
 * Confirmación de activar o inactivar.
 *
 * El botón permanece deshabilitado hasta que el motivo alcanza el mínimo:
 * el API rechazaría un cambio sin texto auditable.
 */
function CatalogStatusModal({ action, isSaving, onClose, onReasonChange, onSubmit, reason, projectView }: { readonly action: StatusAction | null; readonly isSaving: boolean; readonly onClose: () => void; readonly onReasonChange: (value: string) => void; readonly onSubmit: () => void; readonly reason: string; readonly projectView: boolean }) {
    return (
        <Modal
            centered
            destroyOnHidden
            className={`catalog-items-modal${projectView ? " catalog-items-modal--projects" : ""}`}
            footer={
                <div className="catalog-items-modal__footer">
                    <Button disabled={isSaving} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="primary" danger={action?.status === "inactive"} disabled={reason.trim().length < MIN_REASON_LENGTH} loading={isSaving} onClick={onSubmit}>
                        <SaveOutlined />
                        Confirmar acción
                    </Button>
                </div>
            }
            open={action !== null}
            title={
                <div className="catalog-items-modal__title">
                    <h2>{action?.status === "inactive" ? "Inactivar valor" : "Reactivar valor"}</h2>
                    <p>{action ? `Se actualizará ${action.item.name}.` : "Confirma el cambio de estado."}</p>
                </div>
            }
            zIndex={ADMINISTRATION_MODAL_Z_INDEX}
            onCancel={onClose}
        >
            {action ? (
                <div className="catalog-items-summary">
                    <strong>Resumen efectivo</strong>
                    <span>
                        Estado: {STATUS_LABELS[action.item.status]} -&gt; {STATUS_LABELS[action.status]}
                    </span>
                </div>
            ) : null}
            <label className="catalog-items-label" htmlFor="catalog-status-reason">
                Motivo de auditoría *
            </label>
            <Input.TextArea
                id="catalog-status-reason"
                rows={4}
                maxLength={255}
                showCount
                autoFocus
                value={reason}
                placeholder="Ej. Cambio autorizado por jefatura."
                onChange={(event) => {
                    onReasonChange(event.target.value);
                }}
            />
        </Modal>
    );
}

function CatalogLoadState({ error, isLoading, projectView }: { readonly error: string | null; readonly isLoading: boolean; readonly projectView: boolean }) {
    return (
        <>
            {error ? (
                <div className="catalog-items-error" role="alert">
                    {error}
                </div>
            ) : null}
            {isLoading && !projectView ? <div role="status">Cargando catálogo…</div> : null}
        </>
    );
}

/** One API-backed pager; DataTables renders only this page, never a second local page. */
function CatalogPagination({ page, pageSize, total, loaded, disabled, isLoading, onChange }: { readonly page: number; readonly pageSize: number; readonly total: number; readonly loaded: number; readonly disabled: boolean; readonly isLoading: boolean; readonly onChange: (page: number, pageSize: number) => void }) {
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    return (
        <nav className="catalog-items-pagination" aria-label="Paginación del catálogo">
            <span aria-live="polite">
                {start}–{total === 0 ? 0 : Math.min(total, start + loaded - 1)} de {total} valores
            </span>
            <div className="catalog-items-pagination__controls">
                <span className="catalog-items-pagination__loading">{isLoading && <ReloadOutlined spin aria-label="Cargando página" />}</span>
                <label>
                    Filas por página
                    <select
                        aria-label="Filas por página"
                        disabled={disabled}
                        value={pageSize}
                        onChange={(event) => {
                            onChange(1, Number(event.target.value));
                        }}
                    >
                        {[10, 50, 100, 200].map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>
                <Button
                    aria-label="Primera página"
                    icon={<DoubleLeftOutlined />}
                    disabled={disabled || page <= 1}
                    onClick={() => {
                        onChange(1, pageSize);
                    }}
                />
                <Button
                    aria-label="Página anterior"
                    icon={<LeftOutlined />}
                    disabled={disabled || page <= 1}
                    onClick={() => {
                        onChange(page - 1, pageSize);
                    }}
                />
                <span>
                    Página {page} de {lastPage}
                </span>
                <Button
                    aria-label="Página siguiente"
                    icon={<RightOutlined />}
                    disabled={disabled || page >= lastPage}
                    onClick={() => {
                        onChange(page + 1, pageSize);
                    }}
                />
                <Button
                    aria-label="Última página"
                    icon={<DoubleRightOutlined />}
                    disabled={disabled || page >= lastPage}
                    onClick={() => {
                        onChange(lastPage, pageSize);
                    }}
                />
            </div>
        </nav>
    );
}

/** Domain-aware header actions; block refresh while a request or mutation is active. */
function CatalogHeaderActions({ canRead, canCreate, catalogCode, isLoading, isSaving, isSavingStatus, onRefresh, onCreate }: { readonly canRead: boolean; readonly canCreate: boolean; readonly catalogCode: string; readonly isLoading: boolean; readonly isSaving: boolean; readonly isSavingStatus: boolean; readonly onRefresh: () => void; readonly onCreate: () => void }) {
    const presentation = getCatalogPresentation(catalogCode);
    const refreshLabel = presentation.refresh;
    return (
        <div className="global-home-page-header__actions">
            {canRead && presentation.enhanced && (
                <Tooltip title={refreshLabel}>
                    <Button className="projects-view-refresh" aria-label={refreshLabel} icon={<ReloadOutlined spin={isLoading} />} disabled={isLoading || isSaving || isSavingStatus} onClick={onRefresh} />
                </Tooltip>
            )}
            {canCreate ? (
                <button className="global-home-page-header__primary" type="button" onClick={onCreate}>
                    <PlusOutlined />
                    {presentation.create}
                </button>
            ) : null}
        </div>
    );
}

/** Projects shows the API total beside the title; it counts every record, not only the loaded batch. */
function CatalogPageTitle({ catalog, isLoading, total }: { readonly catalog: AdministrationCatalogDefinition; readonly isLoading: boolean; readonly total: number }) {
    const presentation = getCatalogPresentation(catalog.code);
    const title = <h1 id="catalog-items-page-title">{catalog.label}</h1>;
    if (!presentation.enhanced) return title;
    const noun = (total === 1 ? presentation.entity : catalog.label).toLocaleLowerCase("es-CR");
    return (
        <div className="projects-view-title-row">
            {title}
            {!isLoading && (
                <span className="projects-view-total">
                    {total} {noun}
                </span>
            )}
        </div>
    );
}

/** Approved catalog opt-ins announce list updates without changing other catalogs. */
function CatalogListPanel({ catalog, isLoading, children }: { readonly catalog: AdministrationCatalogDefinition; readonly isLoading: boolean; readonly children: ReactNode }) {
    return (
        <section className="catalog-items-panel" aria-label={`Listado de ${catalog.label}`} aria-busy={getCatalogPresentation(catalog.code).enhanced ? isLoading : undefined}>
            {children}
        </section>
    );
}

/** Proyectos usa la escala Bunker y textos AntD en español; los demás catálogos conservan el tema de Administración. */
const getCatalogProviderProps = (projectView: boolean) => (projectView ? { locale: esES, theme: PROJECTS_THEME } : { theme: ADMINISTRATION_THEME });

/** Pantalla administrativa scoped por catalogo y modulo autorizado. */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- Keep explicit permission gates and scope-bound dialogs beside the existing page state.
export function CatalogItemsPage({ catalog, contextLabel = "Administración", contextModuleCode = "administration" }: CatalogItemsPageProps) {
    const scope = `${contextModuleCode}:${catalog.code}`;
    const scopeRef = useRef(scope);
    scopeRef.current = scope;
    const permissionSequence = useRef(0);
    const [permissionState, setPermissionState] = useState({ scope: "", permissions: NO_CATALOG_PERMISSIONS });
    const permissions = permissionState.scope === scope ? permissionState.permissions : NO_CATALOG_PERMISSIONS;
    const permissionsRef = useRef<CatalogPermissions>(NO_CATALOG_PERMISSIONS);
    const permissionScopeRef = useRef("");
    const presentation = getCatalogPresentation(catalog.code);
    const projectView = presentation.enhanced;
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [items, setItems] = useState<readonly CatalogItem[]>([]);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [dialogScope, setDialogScope] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingStatus, setIsSavingStatus] = useState(false);
    const [pendingStatusAction, setPendingStatusAction] = useState<StatusAction | null>(null);
    const [reason, setReason] = useState("");
    const [total, setTotal] = useState(0);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 100 });
    const currentPage = useRef(pagination);
    const [selection, setSelection] = useState<{ publicId: string; catalogCode: string; context: string; open: boolean } | null>(null);
    const isDetailOpen = selection?.catalogCode === catalog.code && selection.context === contextModuleCode && selection.open;
    const selectedItem = items.find((item) => item.publicId === selection?.publicId) ?? null;
    const [visibleOrder, setVisibleOrder] = useState<readonly string[] | null>(null);
    const navigationItems = getNavigationItems(items, visibleOrder, selectedItem, projectView);
    const selectedIndex = navigationItems.findIndex((item) => item === selectedItem);
    // A late response from an older filter/context must not replace the visible details.
    const loadSequence = useRef(0);
    // Session-local batches only: never persist CRM data or share it between mounted users.
    const pageCache = useRef(new Map<string, Awaited<ReturnType<typeof listCatalogItems>>>());
    const editingRef = useRef(editingItem);
    editingRef.current = editingItem;

    const refreshPermissions = useCallback(async (): Promise<CatalogPermissions> => {
        const request = ++permissionSequence.current;
        const next = await getIdentityProfile()
            .then((profile) => getCatalogPermissions(profile, catalog, contextModuleCode))
            .catch(() => NO_CATALOG_PERMISSIONS);
        if (request !== permissionSequence.current || scopeRef.current !== scope) return NO_CATALOG_PERMISSIONS;
        permissionsRef.current = next;
        permissionScopeRef.current = scope;
        setPermissionState({ scope, permissions: next });
        if (!next.read) {
            loadSequence.current++;
            pageCache.current.clear();
            setItems([]);
            setTotal(0);
            setSelection(null);
            setIsLoading(false);
        }
        if (!(editingRef.current ? next.read && next.update : next.create)) {
            setIsFormOpen(false);
            setEditingItem(null);
        }
        setPendingStatusAction((action) => (action && next.read && (action.status === "inactive" ? next.inactivate : next.update) ? action : null));
        return next;
    }, [catalog, contextModuleCode, scope]);
    const showPage = useCallback((target: { page: number; pageSize: number }, response: Awaited<ReturnType<typeof listCatalogItems>>) => {
        if (target.page !== currentPage.current.page || target.pageSize !== currentPage.current.pageSize) setSelection(null);
        currentPage.current = target;
        setPagination(target);
        setItems(response.items);
        setTotal(response.total);
    }, []);

    const loadItems = useCallback(
        function loadPage(target = { page: 1, pageSize: 100 }, refresh = false) {
            if (scopeRef.current !== scope || permissionScopeRef.current !== scope || !permissionsRef.current.read) return;
            const sequence = ++loadSequence.current;
            if (refresh) pageCache.current.clear();
            const key = JSON.stringify([catalog.code, contextModuleCode, target.pageSize, target.page]);
            const cached = pageCache.current.get(key);
            setError(null);
            if (cached) {
                showPage(target, cached);
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            void listCatalogItems(catalog.code, { limit: target.pageSize, offset: (target.page - 1) * target.pageSize, moduleCode: contextModuleCode, status: "all" })
                .then((response) => {
                    if (sequence !== loadSequence.current) return;
                    if ([...pageCache.current.values()].some((page) => page.total !== response.total)) pageCache.current.clear();
                    const lastPage = Math.max(1, Math.ceil(response.total / target.pageSize));
                    if (target.page > lastPage) {
                        loadPage({ ...target, page: lastPage });
                        return;
                    }
                    pageCache.current.set(key, response);
                    // Bound retained batches to 20 (at most 4,000 records).
                    if (pageCache.current.size > 20) {
                        const oldest = pageCache.current.keys().next().value;
                        if (oldest !== undefined) pageCache.current.delete(oldest);
                    }
                    showPage(target, response);
                })
                .catch((loadError: unknown) => {
                    if (sequence !== loadSequence.current) return;
                    setError(getApiErrorMessage(loadError, "No pudimos cargar el catálogo."));
                })
                .finally(() => {
                    if (sequence !== loadSequence.current) return;
                    setIsLoading(false);
                });
        },
        [catalog.code, contextModuleCode, showPage, scope],
    );

    useEffect(() => {
        // Dialog targets cannot carry over into another catalog or module.
        setDialogScope(null);
        setIsFormOpen(false);
        setEditingItem(null);
        setPendingStatusAction(null);
        setReason("");
        setFormError(null);
        setIsSaving(false);
        setIsSavingStatus(false);
        void refreshPermissions().then((next) => {
            if (next.read) loadItems();
        });
        const onFocus = () => {
            void refreshPermissions();
        };
        window.addEventListener("focus", onFocus);
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the latest request counter, not a captured DOM ref.
            loadSequence.current++;
            // eslint-disable-next-line react-hooks/exhaustive-deps -- This is a request counter, not a DOM ref.
            permissionSequence.current++;
            window.removeEventListener("focus", onFocus);
        };
    }, [loadItems, refreshPermissions]);

    const refreshItems = (): void => {
        void refreshPermissions().then((next) => {
            if (next.read) loadItems(currentPage.current, true);
        });
    };

    const openCreate = (): void => {
        void refreshPermissions().then((next) => {
            if (!next.create) return;
            setFormError(null);
            setEditingItem(null);
            setDialogScope(scope);
            setIsFormOpen(true);
        });
    };

    const openEdit = (item: CatalogItem): void => {
        void refreshPermissions().then((next) => {
            if (!next.read || !next.update) return;
            setFormError(null);
            setEditingItem(item);
            setDialogScope(scope);
            setIsFormOpen(true);
        });
    };

    const closeForm = (): void => {
        if (isSaving) {
            return;
        }

        setIsFormOpen(false);
        setEditingItem(null);
        setFormError(null);
    };

    const submitForm = (payload: CatalogItemFormPayload): void => {
        const origin = dialogScope;
        if (!isFormOpen || origin !== scope || origin !== scopeRef.current) return;
        void refreshPermissions().then((next) => {
            if (scopeRef.current !== origin) return;
            if (!(editingItem ? next.read && next.update : next.create)) return;
            setIsSaving(true);
            setFormError(null);
            const scopedPayload = { ...payload, moduleCode: contextModuleCode };
            const request = editingItem ? updateCatalogItem(catalog.code, editingItem.publicId, scopedPayload) : createCatalogItem(catalog.code, scopedPayload);

            void request
                .then((saved) => {
                    if (scopeRef.current !== origin) return;
                    if (editingItem) setSelection((current) => (current?.publicId === editingItem.publicId ? { ...current, publicId: saved.publicId } : current));
                    setIsFormOpen(false);
                    setEditingItem(null);
                    void message.success(`${catalog.label} guardado y auditado.`);
                    loadItems(currentPage.current, true);
                })
                .catch((saveError: unknown) => {
                    if (scopeRef.current !== origin) return;
                    setFormError(getApiErrorMessage(saveError, "No pudimos guardar el catálogo. Revisa permisos, duplicados y motivo de auditoría."));
                })
                .finally(() => {
                    if (scopeRef.current !== origin) return;
                    setIsSaving(false);
                });
        });
    };

    const openStatusAction = (item: CatalogItem, status: CatalogItemStatus): void => {
        void refreshPermissions().then((next) => {
            if (!next.read || !(status === "inactive" ? next.inactivate : next.update)) return;
            setReason("");
            setDialogScope(scope);
            setPendingStatusAction({ item, status });
        });
    };

    const closeStatusAction = (): void => {
        if (isSavingStatus) {
            return;
        }

        setPendingStatusAction(null);
        setReason("");
    };

    const openDetail = (item: CatalogItem): void => {
        void refreshPermissions().then((next) => {
            if (next.read) setSelection({ publicId: item.publicId, catalogCode: catalog.code, context: contextModuleCode, open: true });
        });
    };

    const submitStatusAction = (): void => {
        if (!pendingStatusAction) {
            return;
        }

        const origin = dialogScope;
        if (origin !== scope || origin !== scopeRef.current) return;
        void refreshPermissions().then((next) => {
            if (scopeRef.current !== origin) return;
            if (!next.read || !(pendingStatusAction.status === "inactive" ? next.inactivate : next.update) || reason.trim().length < MIN_REASON_LENGTH) return;
            setIsSavingStatus(true);
            void updateCatalogItemStatus(catalog.code, pendingStatusAction.item.publicId, { moduleCode: contextModuleCode, reason: reason.trim(), status: pendingStatusAction.status })
                .then((saved) => {
                    if (scopeRef.current !== origin) return;
                    setSelection((current) => (current?.publicId === pendingStatusAction.item.publicId ? { ...current, publicId: saved.publicId } : current));
                    void message.success(`${pendingStatusAction.item.name} actualizado.`);
                    closeStatusAction();
                    loadItems(currentPage.current, true);
                })
                .catch(() => {
                    if (scopeRef.current !== origin) return;
                    void message.error("No pudimos actualizar el estado del catálogo.");
                })
                .finally(() => {
                    if (scopeRef.current !== origin) return;
                    setIsSavingStatus(false);
                });
        });
    };

    return (
        <ConfigProvider {...getCatalogProviderProps(projectView)}>
            <div className={`global-home-dashboard catalog-items-page catalog-items-page--${catalog.code} ${presentation.scopeClass}`}>
                <section className="global-home-page-header administration-users-page-header" aria-labelledby="catalog-items-page-title">
                    <div>
                        <nav className="administration-users-breadcrumb" aria-label="Ruta">
                            <span>{contextLabel}</span>
                            <span aria-hidden="true">/</span>
                            <span>Catálogos</span>
                            <span aria-hidden="true">/</span>
                            <span>{catalog.label}</span>
                        </nav>
                        <CatalogPageTitle catalog={catalog} isLoading={isLoading} total={permissions.read ? total : 0} />
                        <p>Gestión de valores nativos CRM y sus referencias externas.</p>
                    </div>
                    <CatalogHeaderActions canRead={permissions.read} canCreate={permissions.create} catalogCode={catalog.code} isLoading={isLoading} isSaving={isSaving} isSavingStatus={isSavingStatus} onRefresh={refreshItems} onCreate={openCreate} />
                </section>

                {permissions.read ? (
                    <CatalogListPanel catalog={catalog} isLoading={isLoading}>
                        <CatalogItemsDataTable
                            canEdit={permissions.update}
                            canInactivate={permissions.inactivate}
                            entityLabel={presentation.entity}
                            projectView={projectView}
                            key={`${contextModuleCode}:${catalog.code}`}
                            items={items}
                            label={catalog.label}
                            isLoading={isLoading}
                            storageKey={`rocca.${contextModuleCode}.catalogs.${catalog.code}.datatable.v1`}
                            selectedPublicId={isDetailOpen ? selection.publicId : null}
                            onEdit={openEdit}
                            onStatusAction={openStatusAction}
                            onSelect={openDetail}
                            onVisibleOrderChange={setVisibleOrder}
                        />
                        <CatalogLoadState error={error} isLoading={isLoading} projectView={projectView} />
                        <CatalogPagination
                            {...pagination}
                            total={total}
                            loaded={items.length}
                            isLoading={isLoading}
                            disabled={[isLoading, isSaving, isSavingStatus].some(Boolean)}
                            onChange={(page, pageSize) => {
                                loadItems({ page, pageSize });
                            }}
                        />
                    </CatalogListPanel>
                ) : (
                    <p role="status">{permissionState.scope === scope ? "No tienes permiso para consultar este catálogo." : "Verificando permisos del catálogo..."}</p>
                )}

                <CatalogItemDetailDrawer
                    canEdit={permissions.update}
                    canInactivate={permissions.inactivate}
                    projectView={projectView}
                    catalogLabel={catalog.label}
                    error={error}
                    isLoading={isLoading}
                    item={permissions.read ? selectedItem : null}
                    open={permissions.read && isDetailOpen}
                    position={selectedIndex + 1}
                    total={navigationItems.length}
                    onSelectPrevious={() => {
                        const previous = navigationItems[selectedIndex - 1];
                        if (previous) openDetail(previous);
                    }}
                    onSelectNext={() => {
                        const next = navigationItems[selectedIndex + 1];
                        if (next) openDetail(next);
                    }}
                    onClose={() => {
                        setSelection((current) => (current ? { ...current, open: false } : null));
                    }}
                    onEdit={openEdit}
                    onRefresh={refreshItems}
                    onStatusAction={openStatusAction}
                />
                {isFormOpen && dialogScope === scope ? <CatalogItemModal catalog={catalog} error={formError} initialItem={editingItem} isSaving={isSaving} open={isFormOpen} onClose={closeForm} onSubmit={submitForm} /> : null}
                {pendingStatusAction && dialogScope === scope ? <CatalogStatusModal action={pendingStatusAction} isSaving={isSavingStatus} reason={reason} onClose={closeStatusAction} onReasonChange={setReason} onSubmit={submitStatusAction} projectView={projectView} /> : null}
            </div>
        </ConfigProvider>
    );
}
