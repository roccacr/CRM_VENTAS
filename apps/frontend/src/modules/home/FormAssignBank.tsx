import "../administration/banks/BanksPage.css";
import "../administration/catalogs/CatalogItemsPage.css";
import "../administration/catalogs/ProjectsView.css";
import "../administration/components/CreateSystemUserDrawer.css";

import BankOutlined from "@ant-design/icons/BankOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Drawer from "antd/es/drawer";
import Form from "antd/es/form";
import Input from "antd/es/input";
import esES from "antd/es/locale/es_ES";
import Pagination from "antd/es/pagination";
import Select from "antd/es/select";
import Skeleton from "antd/es/skeleton";
import Space from "antd/es/space";
import { useEffect, useRef, useState } from "react";

import { ApiClientError, subscribeToSessionRefresh } from "../../services/api/api-client";
import { getIdentityProfile } from "../../services/auth/auth-service";
import type { IdentityProfile } from "../../services/auth/identity-contracts";
import { type Bank, type BankAdvisor, type BankPage, createBankAdvisor, listBankAdvisors, listBanks } from "../../services/catalogs/banks-service";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderBankAssignment, type OrderBankAssignment, saveOrderBankAssignment } from "../../services/formalization/order-bank-assignment-service";
import { ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { BankFormDrawer, type BankFormValues, Section } from "../administration/banks/BankFormDrawer";
import { ADMINISTRATION_CATALOGS } from "../administration/catalogs/catalog-definitions";
import { getCatalogPermissions } from "../administration/catalogs/catalog-permissions";
import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
const catalog = ADMINISTRATION_CATALOGS.find((entry) => entry.code === "banks");
if (!catalog) throw new Error("Falta catálogo Bancos.");
const bankCatalog = catalog;
import { canReadFormalizationOrder } from "./formalization-read-policy";
const identityKey = (profile: IdentityProfile) => `${profile.user.publicId}:${profile.session.publicId}`;
/** Usa permisos efectivos por rol o por persona; la API revalida el acceso a la orden. */
export function FormAssignBank({ item, onAssigned, label = "Asignar banco" }: { readonly item: FollowUpItem; readonly onAssigned?: (() => void) | undefined; readonly label?: string }) {
    const [profile, setProfile] = useState<IdentityProfile | null>(null);
    const [open, setOpen] = useState(false);
    const epoch = useRef(0);
    useEffect(() => {
        let active = true;
        const authorize = () => {
            const token = ++epoch.current;
            setProfile(null);
            setOpen(false);
            void getIdentityProfile()
                .then((result) => {
                    if (active && token === epoch.current) setProfile(result);
                })
                .catch(() => undefined);
        };
        authorize();
        const unsubscribe = subscribeToSessionRefresh(authorize);
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    if (!profile) return null;
    if (!canWrite(profile, profile, false)) return null;
    return (
        <>
            <Button
                icon={<BankOutlined aria-hidden="true" />}
                onClick={() => {
                    setOpen(true);
                }}
            >
                {label}
            </Button>
            {open ? (
                <AssignmentDrawer
                    key={`${item.source}:${item.id}`}
                    item={item}
                    profile={profile}
                    onAssigned={onAssigned}
                    onClose={() => {
                        setOpen(false);
                    }}
                />
            ) : null}
        </>
    );
}
function useAssignment({ item, profile, onClose, onAssigned }: { readonly item: FollowUpItem; readonly profile: IdentityProfile; readonly onClose: () => void; readonly onAssigned?: (() => void) | undefined }) {
    const [snapshot, setSnapshot] = useState<OrderBankAssignment | null>(null);
    const [bank, setBank] = useState<Bank | null>(null);
    const [advisor, setAdvisor] = useState<BankAdvisor | null>(null);
    const [banks, setBanks] = useState<BankPage<Bank>>({ items: [], total: 0 });
    const [advisors, setAdvisors] = useState<BankPage<BankAdvisor>>({ items: [], total: 0 });
    const [bankFilter, setBankFilter] = useState({ search: "", page: 1 });
    const [advisorFilter, setAdvisorFilter] = useState({ search: "", page: 1 });
    const [loading, setLoading] = useState(true);
    const [bankLoading, setBankLoading] = useState(true);
    const [advisorLoading, setAdvisorLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [blocked, setBlocked] = useState(false);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);
    const [reason, setReason] = useState("");
    const [reload, setReload] = useState(0);
    const alive = useRef(true);
    const busy = useRef(false);
    const sequence = useRef(0);
    const current = (token: number) => [alive.current, sequence.current === token].every(Boolean);
    const controller = useRef<AbortController | null>(null);
    const permissions = getCatalogPermissions(profile, bankCatalog, "formalizacion");
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            controller.current?.abort();
        };
    }, []);
    const fail = (failure: unknown) => {
        if (!alive.current) return;
        if (isAccessFailure(failure)) {
            onClose();
            return;
        }
        const conflict = failure instanceof ApiClientError ? failure.status === 409 : false;
        const uncertain = failure instanceof ApiClientError ? failure.status >= 500 : true;
        if ([conflict, uncertain].some(Boolean)) setBlocked(true);
        setError(conflict ? "La asignación cambió. Conservamos tu borrador; recarga la asignación antes de guardar." : uncertain ? "No pudimos confirmar el resultado. Conservamos tu borrador; recarga antes de otra operación." : "No fue posible completar la operación. Revisa los datos e inténtalo de nuevo.");
    };
    useEffect(() => {
        const abort = new AbortController();
        let active = true;
        void getOrderBankAssignment(item, abort.signal)
            .then((result) => {
                if (active) {
                    setSnapshot(result);
                    setBank(result.bank);
                    setAdvisor(result.advisor);
                    setBlocked(false);
                    setError(null);
                    setLoading(false);
                }
            })
            .catch((failure: unknown) => {
                if (active) {
                    setLoading(false);
                    fail(failure);
                }
            });
        return () => {
            active = false;
            abort.abort();
        };
        // Item identity is fixed by the drawer key.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload]);
    useEffect(() => {
        let active = true;
        void listBanks({ moduleCode: "formalizacion", status: "active", search: bankFilter.search, limit: 25, offset: (bankFilter.page - 1) * 25 })
            .then((result) => {
                if (active) setBanks(result);
            })
            .catch((failure: unknown) => {
                if (active) fail(failure);
            })
            .finally(() => {
                if (active) setBankLoading(false);
            });
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bankFilter]);
    useEffect(() => {
        if (!bank) return;
        let active = true;
        void listBankAdvisors(bank.publicId, { moduleCode: "formalizacion", status: "active", search: advisorFilter.search, limit: 25, offset: (advisorFilter.page - 1) * 25 })
            .then((result) => {
                if (active) setAdvisors(result);
            })
            .catch((failure: unknown) => {
                if (active) fail(failure);
            })
            .finally(() => {
                if (active) setAdvisorLoading(false);
            });
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bank?.publicId, advisorFilter]);
    const completeWrite = (created: BankAdvisor | null) => {
        if (!created) {
            // Actualiza la sección de la orden solo después de confirmar el guardado.
            onAssigned?.();
            onClose();
            return;
        }
        setAdvisor(created);
        setAdvisors((previous) => ({ items: [created, ...previous.items.filter((entry) => entry.publicId !== created.publicId)], total: previous.total + 1 }));
        setCreating(false);
    };
    const handleWriteFailure = (failure: unknown, creatingAdvisor: boolean) => {
        if (creatingAdvisor && failure instanceof ApiClientError && failure.status === 409) {
            setCreateError("El ejecutivo ya existe o los datos cambiaron. Revisa el cat�logo antes de continuar.");
            return;
        }
        fail(failure);
    };
    const failCurrentWrite = (token: number, failure: unknown, creating: boolean) => {
        if (current(token)) handleWriteFailure(failure, creating);
    };
    const finishWrite = (token: number) => {
        if (current(token)) {
            busy.current = false;
            setSaving(false);
        }
    };
    const write = async (values?: BankFormValues) => {
        if (!writableAssignment({ busy: busy.current, blocked, bank, snapshot, advisor, reason, creating: Boolean(values) })) return;
        if (!bank || !snapshot) return;
        busy.current = true;
        const token = ++sequence.current;
        setSaving(true);
        controller.current = new AbortController();
        setCreateError(null);
        const targetBank = bank;
        try {
            const latest = await getIdentityProfile();
            if (!current(token)) return;
            if (!canWrite(latest, profile, Boolean(values))) {
                onClose();
                return;
            }
            const created = await dispatchAssignment({ item, bankId: targetBank.publicId, advisor, version: snapshot.version, reason, signal: controller.current.signal }, values);
            if (!current(token)) return;
            completeWrite(created);
        } catch (failure) {
            failCurrentWrite(token, failure, Boolean(values));
        } finally {
            finishWrite(token);
        }
    };
    const bankOptions = withSelected(banks.items, bank);
    const advisorOptions = withSelected(advisors.items, advisor);
    const cancelCreate = () => {
        controller.current?.abort();
        sequence.current++;
        busy.current = false;
        setSaving(false);
        setCreating(false);
    };
    const emptyBanks = !bankLoading && banks.total === 0 && !bankFilter.search;
    const bankValue = bank?.publicId;
    const advisorValue = advisor?.publicId;
    const bankActive = bank?.status === "active";
    const advisorActive = advisor?.status === "active";
    return { emptyBanks, bankValue, advisorValue, bankActive, advisorActive, snapshot, bank, advisor, banks, advisors, bankFilter, advisorFilter, loading, bankLoading, advisorLoading, error, createError, blocked, saving, creating, reason, permissions, bankOptions, advisorOptions, write, cancelCreate, setLoading, setReload, setBank, setAdvisor, setAdvisors, setAdvisorLoading, setAdvisorFilter, setBankLoading, setBankFilter, setCreating, setReason };
}
function AssignmentDrawer(props: { readonly item: FollowUpItem; readonly profile: IdentityProfile; readonly onClose: () => void; readonly onAssigned?: (() => void) | undefined }) {
    const { item, onClose } = props;
    const { emptyBanks, bankValue, advisorValue, bankActive, advisorActive, bank, advisor, banks, advisors, bankFilter, advisorFilter, loading, bankLoading, advisorLoading, error, createError, blocked, saving, creating, reason, permissions, bankOptions, advisorOptions, write, cancelCreate, setLoading, setReload, setBank, setAdvisor, setAdvisors, setAdvisorLoading, setAdvisorFilter, setBankLoading, setBankFilter, setCreating, setReason } = useAssignment(props);
    return (
        <ConfigProvider locale={esES} theme={PROJECTS_THEME}>
            <Drawer
                {...ADMINISTRATION_DRAWER_PROPS}
                // While the executive form is open it takes the whole panel; this one comes back, with its choices, when it closes.
                open={!creating}
                rootClassName="create-user-drawer catalog-items-modal--projects users-view-form catalog-form-drawer banks-form"
                title={`Asignar banco · ${item.number}`}
                onClose={onClose}
                footer={
                    <div className="create-user-drawer__footer">
                        <span className="create-user-drawer__summary">La asignación quedará registrada en la bitácora de esta orden.</span>
                        <Space>
                            <Button onClick={onClose}>Cancelar</Button>
                            <Button
                                type="primary"
                                loading={saving}
                                disabled={[blocked, loading, bankLoading, advisorLoading, !bankActive, !advisorActive, reason.trim().length < 3, reason.trim().length > 255].some(Boolean)}
                                onClick={() => {
                                    void write();
                                }}
                            >
                                Guardar asignación
                            </Button>
                        </Space>
                    </div>
                }
            >
                {error ? (
                    <Alert
                        showIcon
                        type="warning"
                        title={error}
                        action={
                            <Button
                                disabled={saving}
                                onClick={() => {
                                    setLoading(true);
                                    setReload((value) => value + 1);
                                }}
                            >
                                Recargar asignación
                            </Button>
                        }
                    />
                ) : null}
                {loading ? (
                    <Skeleton active paragraph={{ rows: 6 }} />
                ) : (
                    <Form layout="vertical" disabled={saving}>
                        <Section step={1} title="Banco y ejecutivo de contacto">
                            <p className="banks-detail__lead">Selecciona el banco y su ejecutivo de contacto para esta orden.</p>
                            {emptyBanks ? <Alert type="info" showIcon title="No hay bancos activos. Registra uno en Catálogos → Bancos para continuar." /> : null}
                            <Form.Item label="Banco" required>
                                <Select
                                    aria-label="Banco"
                                    placeholder="Selecciona un banco"
                                    style={{ width: "100%" }}
                                    showSearch={{ optionFilterProp: "label" }}
                                    loading={bankLoading}
                                    value={bankValue}
                                    options={bankOptions.map((entry) => ({ value: entry.publicId, label: entry.name, disabled: entry.status !== "active" }))}
                                    onChange={(value) => {
                                        setBank(bankOptions.find((entry) => entry.publicId === value) ?? null);
                                        setAdvisor(null);
                                        setAdvisors({ items: [], total: 0 });
                                        setAdvisorLoading(true);
                                        setAdvisorFilter({ search: "", page: 1 });
                                    }}
                                />
                            </Form.Item>
                            <Input.Search
                                aria-label="Buscar bancos"
                                placeholder="Buscar bancos activos"
                                onSearch={(search) => {
                                    setBankLoading(true);
                                    setBankFilter({ search, page: 1 });
                                }}
                            />
                            <Pagination
                                hideOnSinglePage
                                size="small"
                                current={bankFilter.page}
                                pageSize={25}
                                total={banks.total}
                                showSizeChanger={false}
                                onChange={(page) => {
                                    setBankLoading(true);
                                    setBankFilter({ ...bankFilter, page });
                                }}
                            />
                            <Form.Item label="Ejecutivo" required>
                                <Select
                                    aria-label="Ejecutivo"
                                    placeholder="Selecciona un ejecutivo"
                                    style={{ width: "100%" }}
                                    disabled={[!bank, saving, advisorLoading].some(Boolean)}
                                    showSearch={{ optionFilterProp: "label" }}
                                    loading={advisorLoading}
                                    value={advisorValue}
                                    options={advisorOptions.map((entry) => ({ value: entry.publicId, label: entry.name, disabled: entry.status !== "active" }))}
                                    onChange={(value) => {
                                        setAdvisor(advisorOptions.find((entry) => entry.publicId === value) ?? null);
                                    }}
                                />
                            </Form.Item>
                            <Input.Search
                                aria-label="Buscar ejecutivos"
                                placeholder="Buscar ejecutivos activos"
                                disabled={!bank}
                                onSearch={(search) => {
                                    setAdvisorLoading(true);
                                    setAdvisorFilter({ search, page: 1 });
                                }}
                            />
                            <Pagination
                                hideOnSinglePage
                                size="small"
                                current={advisorFilter.page}
                                pageSize={25}
                                total={advisors.total}
                                showSizeChanger={false}
                                onChange={(page) => {
                                    setAdvisorLoading(true);
                                    setAdvisorFilter({ ...advisorFilter, page });
                                }}
                            />
                            {permissions.create ? (
                                <Button
                                    disabled={[!bankActive, saving, blocked].some(Boolean)}
                                    onClick={() => {
                                        setCreating(true);
                                    }}
                                >
                                    Nuevo ejecutivo
                                </Button>
                            ) : null}
                            {advisor ? (
                                <p className="banks-assign__contact">
                                    {advisor.email} · {advisor.phone} · {advisor.area}
                                </p>
                            ) : null}
                        </Section>
                        <Section step={2} title="Motivo de la asignación">
                            <Form.Item label="Motivo de la asignación" required>
                                <Input.TextArea
                                    aria-label="Motivo de la asignación"
                                    rows={3}
                                    maxLength={255}
                                    showCount
                                    value={reason}
                                    onChange={(event) => {
                                        setReason(event.target.value);
                                    }}
                                />
                            </Form.Item>
                        </Section>
                    </Form>
                )}
            </Drawer>
            {creating && bank ? (
                <BankFormDrawer
                    dialog={{ kind: "advisor", item: null, bankId: bank.publicId }}
                    saving={saving}
                    error={createError}
                    blocked={blocked}
                    onClose={cancelCreate}
                    onSubmit={(values) => {
                        void write(values);
                    }}
                />
            ) : null}
        </ConfigProvider>
    );
}

async function dispatchAssignment({ item, bankId, advisor, version, reason, signal }: { item: FollowUpItem; bankId: string; advisor: BankAdvisor | null; version: number; reason: string; signal: AbortSignal }, values?: BankFormValues): Promise<BankAdvisor | null> {
    if (values) return createBankAdvisor(bankId, { moduleCode: "formalizacion", name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim(), area: values.area.trim(), reason: values.reason.trim() }, signal);
    if (!advisor) throw new Error("Selecciona un ejecutivo.");
    await saveOrderBankAssignment(item, { bankPublicId: bankId, advisorPublicId: advisor.publicId, expectedVersion: version, reason: reason.trim() }, signal);
    return null;
}

function withSelected<T extends { publicId: string }>(items: readonly T[], selected: T | null): T[] {
    if (!selected) return [...items];
    return items.some((entry) => entry.publicId === selected.publicId) ? [...items] : [selected, ...items];
}
function isAccessFailure(failure: unknown) {
    return failure instanceof ApiClientError && [401, 403].includes(failure.status);
}

function canWrite(latest: IdentityProfile, original: IdentityProfile, creating: boolean) {
    const next = getCatalogPermissions(latest, bankCatalog, "formalizacion");
    return [canReadFormalizationOrder(latest.roles, latest.permissions), identityKey(latest) === identityKey(original), next.read, next.update, creating ? next.create : true].every(Boolean);
}

function writableAssignment({ busy, blocked, bank, snapshot, advisor, reason, creating }: { busy: boolean; blocked: boolean; bank: Bank | null; snapshot: OrderBankAssignment | null; advisor: BankAdvisor | null; reason: string; creating: boolean }) {
    const validSelection = creating || (Boolean(advisor) && reason.trim().length >= 3);
    return [!busy, !blocked, Boolean(bank), Boolean(snapshot), validSelection].every(Boolean);
}
