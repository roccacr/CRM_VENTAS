import Alert from "antd/es/alert";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Drawer from "antd/es/drawer";
import Form from "antd/es/form";
import Input from "antd/es/input";
import esES from "antd/es/locale/es_ES";
import Space from "antd/es/space";
import { useEffect, useRef, useState } from "react";

import { ApiClientError, subscribeToSessionRefresh } from "../../services/api/api-client";
import { getIdentityProfile } from "../../services/auth/auth-service";
import type { IdentityProfile } from "../../services/auth/identity-contracts";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { type OrderBankAssignment, unlinkOrderBankAssignment } from "../../services/formalization/order-bank-assignment-service";
import { ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { Section } from "../administration/banks/BankFormDrawer";
import { ADMINISTRATION_CATALOGS } from "../administration/catalogs/catalog-definitions";
import { getCatalogPermissions } from "../administration/catalogs/catalog-permissions";
import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
import { canReadFormalizationOrder } from "./formalization-read-policy";
import { FormAssignBank } from "./FormAssignBank";
const catalog = ADMINISTRATION_CATALOGS.find((entry) => entry.code === "banks");
if (!catalog) throw new Error("Falta catálogo Bancos.");
const bankCatalog = catalog;
function allowed(profile: IdentityProfile) {
    const permissions = getCatalogPermissions(profile, bankCatalog, "formalizacion");
    return permissions.read && permissions.update && canReadFormalizationOrder(profile.roles, profile.permissions);
}
type Props = { readonly item: FollowUpItem; readonly assignment: OrderBankAssignment; readonly onChanged?: (() => void) | undefined };
/** Actions use fresh effective grants; a session refresh closes only this order's confirmation. */
export function FormalizationBankAssignmentActions({ item, assignment, onChanged }: Props) {
    const [profile, setProfile] = useState<IdentityProfile | null>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        let active = true;
        let epoch = 0;
        const authorize = () => {
            const token = ++epoch;
            setProfile(null);
            setOpen(false);
            void getIdentityProfile()
                .then((result) => {
                    if (active && epoch === token) setProfile(result);
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
    if (!profile || !allowed(profile) || !assignment.bank || !assignment.advisor) return null;
    return (
        <>
            <Space wrap>
                <FormAssignBank item={item} label="Cambiar banco" onAssigned={onChanged} />
                <Button
                    danger
                    onClick={() => {
                        setOpen(true);
                    }}
                >
                    Desvincular banco
                </Button>
            </Space>
            {open ? (
                <UnlinkDrawer
                    item={item}
                    assignment={assignment}
                    profile={profile}
                    onChanged={onChanged}
                    onClose={() => {
                        setOpen(false);
                    }}
                />
            ) : null}
        </>
    );
}
function UnlinkDrawer({ item, assignment, profile, onChanged, onClose }: Props & { readonly profile: IdentityProfile; readonly onClose: () => void }) {
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const alive = useRef(true);
    const busy = useRef(false);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            controller.current?.abort();
        };
    }, []);
    const isCurrent = () => alive.current;
    const close = () => {
        if ([busy.current, blocked].some(Boolean)) onChanged?.();
        onClose();
    };
    const fail = (failure: unknown) => {
        if (!isCurrent()) return;
        if (failure instanceof ApiClientError && [401, 403].includes(failure.status)) {
            onClose();
            return;
        }
        const uncertain = failure instanceof ApiClientError ? failure.status >= 500 : true;
        const conflict = failure instanceof ApiClientError ? failure.status === 409 : false;
        setBlocked([uncertain, conflict].some(Boolean));
        setError(conflict ? "La asignación cambió. Conservamos tu motivo; cierra este panel para actualizar los datos bancarios antes de continuar." : uncertain ? "No pudimos confirmar el resultado. Conservamos tu motivo; cierra este panel para actualizar los datos bancarios antes de otra operación." : "No fue posible desvincular el banco. Revisa el motivo e inténtalo de nuevo.");
    };
    const submit = async () => {
        const trimmed = reason.trim();
        if ([busy.current, blocked, trimmed.length < 3, trimmed.length > 255].some(Boolean)) return;
        busy.current = true;
        setSaving(true);
        controller.current = new AbortController();
        try {
            const latest = await getIdentityProfile();
            if (!isCurrent()) return;
            if ([!allowed(latest), latest.user.publicId !== profile.user.publicId, latest.session.publicId !== profile.session.publicId].some(Boolean)) {
                onClose();
                return;
            }
            await unlinkOrderBankAssignment(item, { expectedVersion: assignment.version, reason: trimmed }, controller.current.signal);
            if (!isCurrent()) return;
            onChanged?.();
            onClose();
        } catch (failure) {
            fail(failure);
        } finally {
            if (isCurrent()) {
                busy.current = false;
                setSaving(false);
            }
        }
    };
    return (
        <ConfigProvider locale={esES} theme={PROJECTS_THEME}>
            <Drawer
                {...ADMINISTRATION_DRAWER_PROPS}
                open
                rootClassName="create-user-drawer catalog-items-modal--projects users-view-form catalog-form-drawer banks-form"
                title={`Desvincular banco · ${item.number}`}
                onClose={close}
                footer={
                    <div className="create-user-drawer__footer">
                        <span className="create-user-drawer__summary">La desvinculación quedará registrada en la bitácora de esta orden.</span>
                        <Space>
                            <Button onClick={close}>Cancelar</Button>
                            <Button
                                danger
                                type="primary"
                                loading={saving}
                                disabled={blocked || reason.trim().length < 3 || reason.trim().length > 255}
                                onClick={() => {
                                    void submit();
                                }}
                            >
                                Confirmar desvinculación
                            </Button>
                        </Space>
                    </div>
                }
            >
                {error ? <Alert type="warning" showIcon title={error} /> : null}
                <Form layout="vertical" disabled={saving}>
                    <Section step={1} title="Confirmar desvinculación">
                        <p className="banks-detail__lead">
                            Se retirarán {assignment.bank?.name} y {assignment.advisor?.name} como contactos bancarios de esta orden. El banco y el ejecutivo permanecerán en el catálogo.
                        </p>
                        <Form.Item label="Motivo de la desvinculación" required>
                            <Input.TextArea
                                aria-label="Motivo de la desvinculación"
                                value={reason}
                                rows={3}
                                maxLength={255}
                                showCount
                                onChange={(event) => {
                                    setReason(event.target.value);
                                }}
                            />
                        </Form.Item>
                    </Section>
                </Form>
            </Drawer>
        </ConfigProvider>
    );
}
