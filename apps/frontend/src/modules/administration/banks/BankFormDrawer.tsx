import PlusOutlined from "@ant-design/icons/PlusOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Drawer from "antd/es/drawer";
import Form from "antd/es/form";
import Input from "antd/es/input";
import Space from "antd/es/space";
import { type ReactNode, useEffect, useRef } from "react";

import type { Bank, BankAdvisor } from "../../../services/catalogs/banks-service";
import { ADMINISTRATION_DRAWER_PROPS, ADMINISTRATION_MODAL_Z_INDEX } from "../administration-theme";

export type BankDialog = { readonly kind: "bank"; readonly item: Bank | null } | { readonly kind: "advisor"; readonly item: BankAdvisor | null; readonly bankId: string } | { readonly kind: "status"; readonly item: Bank | BankAdvisor; readonly bankId?: string };
export interface BankFormValues {
    name: string;
    email: string;
    phone: string;
    area: string;
    reason: string;
}
/** La misma sección numerada de los paneles de alta y edición de los demás catálogos. */
export function Section({ step, title, children }: { readonly step: number; readonly title: string; readonly children: ReactNode }) {
    return (
        <section className="create-user-drawer__section">
            <header className="create-user-drawer__section-header">
                <span className="create-user-drawer__step" aria-hidden="true">
                    {step}
                </span>
                <h3>{title}</h3>
            </header>
            <div className="catalog-form-section__body">{children}</div>
        </section>
    );
}
/** Nombre de hasta 250. El ejecutivo agrega correo de 254, teléfono de 40 y área de 120. El banco no pide esos datos. */
function BankFields({ advisor }: { readonly advisor: boolean }) {
    return (
        <Section step={1} title={`Información ${advisor ? "del ejecutivo" : "del banco"}`}>
            <Form.Item
                name="name"
                label="Nombre"
                rules={[
                    { required: true, whitespace: true, message: "El nombre es obligatorio." },
                    { max: 250, message: "El nombre admite hasta 250 caracteres." },
                ]}
            >
                <Input maxLength={250} />
            </Form.Item>
            {advisor ? (
                <>
                    <Form.Item name="email" label="Correo electrónico" rules={[{ required: true, whitespace: true, message: "El correo es obligatorio." }, { type: "email", message: "Agrega un correo válido." }, { max: 254 }]}>
                        <Input type="email" maxLength={254} />
                    </Form.Item>
                    <Form.Item name="phone" label="Teléfono" rules={[{ required: true, whitespace: true, message: "El teléfono es obligatorio." }, { max: 40 }]}>
                        <Input type="tel" maxLength={40} />
                    </Form.Item>
                    <Form.Item name="area" label="Área" rules={[{ required: true, whitespace: true, message: "El área es obligatoria." }, { max: 120 }]}>
                        <Input maxLength={120} />
                    </Form.Item>
                </>
            ) : null}
        </Section>
    );
}
const SubmitIcon = ({ saving }: { readonly saving: boolean }) => (saving ? <SaveOutlined aria-hidden="true" /> : <PlusOutlined aria-hidden="true" />);
function dialogTitle(dialog: BankDialog): string {
    const status = dialog.kind === "status";
    const advisor = dialog.kind === "advisor";
    return status ? `${dialog.item.status === "active" ? "Inactivar" : "Reactivar"} ${"bankPublicId" in dialog.item ? "ejecutivo" : "banco"}` : `${dialog.item ? "Editar" : "Nuevo"} ${advisor ? "ejecutivo" : "banco"}`;
}
/**
 * El motivo se vacía en cada apertura y exige de 3 a 255 caracteres.
 * Cambiar el estado no reenvía el nombre. Inactivar un banco no cambia el estado de sus ejecutivos.
 */
export function BankFormDrawer({ dialog, saving, error, blocked, onClose, onSubmit }: { readonly dialog: BankDialog; readonly saving: boolean; readonly error: string | null; readonly blocked: boolean; readonly onClose: () => void; readonly onSubmit: (values: BankFormValues) => void }) {
    const [form] = Form.useForm<BankFormValues>();
    const status = dialog.kind === "status";
    const advisor = dialog.kind === "advisor";
    const title = dialogTitle(dialog);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useEffect(() => {
        form.resetFields();
        if (!status && dialog.item) form.setFieldsValue({ ...dialog.item, reason: "" });
    }, [dialog, form, status]);
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            zIndex={ADMINISTRATION_MODAL_Z_INDEX}
            rootClassName="create-user-drawer catalog-items-modal--projects users-view-form catalog-form-drawer banks-form"
            title={title}
            open
            onClose={onClose}
            footer={
                <div className="create-user-drawer__footer banks-form__footer">
                    <span className="create-user-drawer__summary">{saving ? "Solicitud en curso. Cerrar no revierte un cambio ya recibido por el servidor." : "Todo cambio queda en auditoría."}</span>
                    <Space>
                        <Button onClick={onClose}>Cancelar</Button>
                        <Button
                            type="primary"
                            loading={saving}
                            disabled={blocked}
                            onClick={() => {
                                void form
                                    .validateFields()
                                    .then((values) => {
                                        if (mounted.current) onSubmit(values);
                                    })
                                    .catch(() => undefined);
                            }}
                        >
                            <SubmitIcon saving={Boolean(dialog.item) && !status} />
                            Guardar
                        </Button>
                    </Space>
                </div>
            }
        >
            {error ? <Alert type="warning" title={error} showIcon /> : null}
            {status ? (
                <p>
                    El cambio afecta a <strong>{dialog.item.name}</strong>. {"advisorCount" in dialog.item ? "Los ejecutivos conservan su estado." : "El ejecutivo permanece vinculado a su banco."}
                </p>
            ) : null}
            <Form form={form} layout="vertical" disabled={saving}>
                {!status ? <BankFields advisor={advisor} /> : null}
                <Section step={status ? 1 : 2} title="Motivo del cambio">
                    <Form.Item name="reason" label="Motivo" rules={[{ required: true, whitespace: true, message: "El motivo es obligatorio." }, { min: 3, message: "Describe el motivo con al menos 3 caracteres." }, { max: 255 }]}>
                        <Input.TextArea rows={3} maxLength={255} showCount />
                    </Form.Item>
                </Section>
            </Form>
        </Drawer>
    );
}
