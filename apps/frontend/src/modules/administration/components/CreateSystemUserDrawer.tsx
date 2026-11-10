/**
 * Panel de alta y edición de un usuario.
 *
 * El mismo formulario crea o actualiza. Cerrar descarta los cambios pendientes
 * sin confirmación. El catálogo delimita los módulos seleccionables; Owner no
 * asigna áreas operativas porque su alcance es la empresa.
 */
import "./CreateSystemUserDrawer.css";

import PlusOutlined from "@ant-design/icons/PlusOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Checkbox from "antd/es/checkbox";
import Col from "antd/es/col";
import Collapse from "antd/es/collapse";
import Drawer from "antd/es/drawer";
import Form from "antd/es/form";
import Input from "antd/es/input";
import Row from "antd/es/row";
import Select from "antd/es/select";
import Space from "antd/es/space";
import { type ReactNode, useEffect } from "react";

import type { CreateSystemUserPayload, UpdateSystemUserPayload } from "../../../services/auth/identity-contracts";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration-theme";
import { ACCESS_METHOD_OPTIONS, buildCreateUserPayload, buildUpdateUserPayload, canAssignInitialPassword, createEditUserFormValues, createInitialUserFormValues, type CreateUserFormValues, type CreateUserModuleOption, type CreateUserRoleOption, type CreateUserRolePermissions, getRoleModules, hasOwnerRole, normalizeEmail } from "../create-system-user.model";
import type { SystemUserListItem } from "../system-users.model";
import { getUserModuleScope, hasSelectedModuleInheritance } from "../user-module-scope";
import { SystemUserStatusPill } from "./SystemUserBadges";

const FORM_NAME = "createSystemUser";

/** Propiedades del panel de alta y edición de usuarios. */
interface CreateSystemUserDrawerProps {
    readonly canAssignRoles?: boolean;
    readonly canAssignPassword?: boolean;
    readonly error: string | null;
    readonly initialUser?: SystemUserListItem | null;
    readonly isSaving: boolean;
    readonly mode?: "create" | "edit";
    readonly moduleOptions: readonly CreateUserModuleOption[];
    readonly onClose: () => void;
    readonly onSubmit: (payload: CreateSystemUserPayload | UpdateSystemUserPayload) => void;
    readonly open: boolean;
    readonly roleOptions: readonly CreateUserRoleOption[];
    readonly rolePermissions: CreateUserRolePermissions;
}

/** Sección numerada del formulario. */
function FormSection({ children, step, title }: { readonly children: ReactNode; readonly step: number; readonly title: string }) {
    const headingId = `create-user-section-${String(step)}`;

    return (
        <section className="create-user-drawer__section" aria-labelledby={headingId}>
            <header className="create-user-drawer__section-header">
                <span className="create-user-drawer__step" aria-hidden="true">
                    {step}
                </span>
                <h3 id={headingId}>{title}</h3>
            </header>
            {children}
        </section>
    );
}

/** Muestra los módulos que habilitan los roles elegidos; Owner tiene acceso total. */
function RoleScope({ isOwner, roleCount, roleModules }: { readonly isOwner: boolean; readonly roleCount: number; readonly roleModules: readonly CreateUserModuleOption[] }) {
    if (isOwner) {
        return <span className="create-user-drawer__scope">Alcance global: toda la empresa.</span>;
    }

    if (roleCount === 0 || roleModules.length === 0) {
        return null;
    }

    return (
        <span className="create-user-drawer__scope">
            Aplica en: <strong>{roleModules.map((module) => module.name).join(", ")}</strong>
        </span>
    );
}

/** Resumen del acceso que se concederá antes de guardar. */
function AccessSummary({ hasAssignedPassword, isEditMode, isOwner, moduleCount, roleCount }: { readonly hasAssignedPassword: boolean; readonly isEditMode: boolean; readonly isOwner: boolean; readonly moduleCount: number; readonly roleCount: number }) {
    const initialStatus = (
        <span className="create-user-drawer__initial-status">
            Estado inicial <SystemUserStatusPill status={hasAssignedPassword ? "active" : "pending"} />
        </span>
    );

    if (roleCount === 0) {
        return (
            <span className="create-user-drawer__summary create-user-drawer__summary--empty">
                Sin roles asignados
                {isEditMode ? null : initialStatus}
            </span>
        );
    }

    const roleLabel = `${String(roleCount)} ${roleCount === 1 ? "rol" : "roles"}`;
    const scopeLabel = isOwner ? "Alcance global" : `${String(moduleCount)} ${moduleCount === 1 ? "módulo" : "módulos"}`;

    return (
        <span className="create-user-drawer__summary" aria-live="polite">
            <strong>{roleLabel}</strong>
            <span aria-hidden="true">·</span>
            <strong>{scopeLabel}</strong>
            {isEditMode ? null : initialStatus}
        </span>
    );
}

/** Pie con errores, resumen y acciones de cancelar o guardar. */
function CreateUserDrawerFooter({ error, hasAssignedPassword, isEditMode, isOwner, isSaving, moduleCount, onCancel, onSubmit, roleCount }: { readonly error: string | null; readonly hasAssignedPassword: boolean; readonly isEditMode: boolean; readonly isOwner: boolean; readonly isSaving: boolean; readonly moduleCount: number; readonly onCancel: () => void; readonly onSubmit: () => void; readonly roleCount: number }) {
    const savingLabel = isEditMode ? "Guardando cambios..." : "Creando usuario...";
    const actionLabel = isEditMode ? "Guardar cambios" : "Crear usuario";

    return (
        <div className="create-user-drawer__footer">
            <div className="create-user-drawer__footer-status">{error ? <Alert type="error" showIcon title={error} role="alert" /> : <AccessSummary hasAssignedPassword={hasAssignedPassword} isEditMode={isEditMode} isOwner={isOwner} moduleCount={moduleCount} roleCount={roleCount} />}</div>
            <Space size={8}>
                <Button disabled={isSaving} onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="primary" icon={isEditMode ? <SaveOutlined aria-hidden="true" /> : <PlusOutlined aria-hidden="true" />} loading={isSaving} onClick={onSubmit}>
                    {isSaving ? savingLabel : actionLabel}
                </Button>
            </Space>
        </div>
    );
}

/** `Form.useWatch` devuelve `undefined` en el primer render, antes de conectar el formulario, aunque su tipo no lo diga. */
const toWatchedList = (value: readonly string[] | undefined): readonly string[] => value ?? [];

/** Contraseña inicial; solo se muestra cuando la cuenta local la requiere. */
function InitialPasswordField({ visible }: { readonly visible: boolean }) {
    if (!visible) return null;
    return (
        <Form.Item<CreateUserFormValues>
            label="Contraseña inicial"
            name="password"
            preserve={false}
            rules={[
                { min: 12, max: 128, message: "Usa entre 12 y 128 caracteres." },
                { whitespace: true, message: "La contraseña no puede contener solo espacios." },
            ]}
        >
            <Input.Password autoComplete="new-password" maxLength={128} />
        </Form.Item>
    );
}

/**
 * Alta de usuario en panel lateral.
 *
 * Orden de llenado: identificación, acceso y auditoría; las integraciones van
 * plegadas al final porque son opcionales. La herencia selected_modules exige
 * selección explícita de módulos; el API calcula los permisos efectivos al guardar.
 */
// eslint-disable-next-line complexity -- Creation/edit lifecycle and independent role/password gates share the same form state.
export function CreateSystemUserDrawer({ canAssignPassword, canAssignRoles, error, initialUser = null, isSaving, mode = "create", moduleOptions, onClose, onSubmit, open, roleOptions, rolePermissions }: CreateSystemUserDrawerProps) {
    const [form] = Form.useForm<CreateUserFormValues>();
    const isEditMode = mode === "edit";
    const roleCodes = toWatchedList(Form.useWatch("roleCodes", form));
    const isOwner = hasOwnerRole(roleCodes);
    const selectModules = getUserModuleScope(roleCodes, roleOptions, []) !== null;
    const selectedModules = toWatchedList(Form.useWatch("orgUnitCodes", form));
    const availableModules = getRoleModules(roleCodes, rolePermissions, moduleOptions, { roles: roleOptions });
    const roleModules = getRoleModules(roleCodes, rolePermissions, moduleOptions, { roles: roleOptions, selectedModules: selectModules ? selectedModules : undefined });
    const accessMethods = toWatchedList(Form.useWatch("accessMethods", form));
    const showPassword = canAssignInitialPassword(mode, open, canAssignPassword, accessMethods);
    const password = Form.useWatch("password", form);

    useEffect(() => {
        if (!showPassword) form.setFieldValue("password", undefined);
    }, [form, showPassword]);

    useEffect(() => {
        if (!open) {
            return;
        }

        form.setFieldsValue(isEditMode && initialUser ? createEditUserFormValues(initialUser) : { ...createInitialUserFormValues(), orgUnitCodes: [] });
    }, [form, initialUser, isEditMode, open]);

    /** Rechaza roles que no otorgan acciones en ningún módulo, salvo Owner, herencia por módulos seleccionados o edición sin permiso de asignar roles. */
    const validateRoleScope = (_: unknown, value: readonly string[] | undefined): Promise<void> => {
        if (isEditMode && !canAssignRoles) return Promise.resolve();
        const selectedRoles = value ?? [];

        if (selectedRoles.length === 0 || hasOwnerRole(selectedRoles) || hasSelectedModuleInheritance(selectedRoles, roleOptions) || getRoleModules(selectedRoles, rolePermissions, moduleOptions, { roles: roleOptions }).length > 0) {
            return Promise.resolve();
        }

        return Promise.reject(new Error("Los roles elegidos no tienen acciones en ningún módulo. Agrega un rol operativo."));
    };

    /** Cierra sin aviso de descarte y limpia la contraseña; espera si hay un guardado en curso. */
    const requestClose = (): void => {
        if (isSaving) {
            return;
        }

        form.setFieldValue("password", undefined);
        onClose();
    };

    /** Al cerrarse el panel se reinicia el formulario para no arrastrar datos entre usuarios. */
    const handleAfterOpenChange = (isOpen: boolean): void => {
        if (isOpen) {
            return;
        }

        form.resetFields();
    };

    /** `getFieldsValue(true)` incluye las integraciones aunque su panel siga plegado. */
    const handleFinish = (): void => {
        const values = form.getFieldsValue(true) as CreateUserFormValues;
        const submittedModules = getRoleModules(values.roleCodes, rolePermissions, moduleOptions, { roles: roleOptions, selectedModules: selectModules ? toWatchedList(values.orgUnitCodes) : undefined });
        const payload = isEditMode ? buildUpdateUserPayload(values, submittedModules) : buildCreateUserPayload(values, submittedModules, showPassword);
        // Una edición que no toca el alcance conserva las membresías guardadas. Solo un cambio deliberado de alcance las reemplaza.
        if (selectModules && isEditMode && !form.isFieldsTouched(["orgUnitCodes", "roleCodes"])) {
            onSubmit({ ...payload, orgUnitCodes: toWatchedList(values.orgUnitCodes) });
            return;
        }
        onSubmit(payload);
    };

    const footer = (
        <CreateUserDrawerFooter
            hasAssignedPassword={Boolean(password)}
            error={error}
            isEditMode={isEditMode}
            isOwner={isOwner}
            isSaving={isSaving}
            moduleCount={roleModules.length}
            roleCount={roleCodes.length}
            onCancel={requestClose}
            onSubmit={() => {
                form.submit();
            }}
        />
    );

    return (
        <Drawer {...ADMINISTRATION_DRAWER_PROPS} rootClassName="create-user-drawer catalog-items-modal--projects users-view-form" open={open} title={isEditMode ? "Editar usuario" : "Nuevo usuario"} closable={{ "aria-label": isEditMode ? "Cerrar edición de usuario" : "Cerrar creación de usuario", placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }} keyboard={!isSaving} mask={{ closable: !isSaving }} footer={footer} afterOpenChange={handleAfterOpenChange} onClose={requestClose}>
            <Form<CreateUserFormValues> form={form} name={FORM_NAME} layout="vertical" initialValues={createInitialUserFormValues()} scrollToFirstError={{ behavior: "smooth", block: "center" }} disabled={isSaving} onFinish={handleFinish}>
                <FormSection step={1} title="Identificación">
                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item<CreateUserFormValues>
                                label="Nombre completo"
                                name="displayName"
                                rules={[
                                    { message: "Ingresa el nombre completo.", required: true, whitespace: true },
                                    { message: "Usa al menos 2 caracteres.", min: 2 },
                                ]}
                            >
                                <Input autoComplete="name" placeholder="Laura Valverde" maxLength={120} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item<CreateUserFormValues>
                                label="Correo"
                                name="email"
                                normalize={normalizeEmail}
                                validateTrigger="onBlur"
                                rules={[
                                    { message: "Ingresa el correo.", required: true },
                                    { message: "Ingresa un correo válido.", type: "email" },
                                ]}
                            >
                                <Input type="email" inputMode="email" autoComplete="off" placeholder="nombre@empresa.com" spellCheck={false} autoCapitalize="off" maxLength={254} />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item<CreateUserFormValues> className="create-user-drawer__compact-item" label="Métodos de acceso" name="accessMethods" rules={[{ message: "Selecciona al menos un método de acceso.", min: 1, required: true, type: "array" }]}>
                                <Checkbox.Group options={[...ACCESS_METHOD_OPTIONS]} />
                            </Form.Item>
                            <InitialPasswordField visible={showPassword} />
                        </Col>
                    </Row>
                </FormSection>

                <FormSection step={2} title="Acceso y permisos">
                    <Form.Item<CreateUserFormValues> label="Roles asignados" name="roleCodes" extra={<RoleScope isOwner={isOwner} roleCount={roleCodes.length} roleModules={roleModules} />} rules={[{ message: "Selecciona al menos un rol.", min: 1, required: true, type: "array" }, { validator: validateRoleScope }]}>
                        <Select
                            disabled={isEditMode && !canAssignRoles}
                            mode="multiple"
                            allowClear
                            virtual={false}
                            // Una sección recortada del formulario se escapa y sigue por encima de la máscara del panel.
                            getPopupContainer={(trigger: HTMLElement) => trigger.closest<HTMLElement>(".ant-drawer-body") ?? trigger.parentElement ?? trigger}
                            placeholder="Selecciona uno o más roles"
                            showSearch={{ optionFilterProp: "label" }}
                            options={roleOptions.map((role) => ({ label: role.name, value: role.code }))}
                            optionRender={(option) => {
                                const role = roleOptions.find((currentRole) => currentRole.code === option.value);

                                return (
                                    <span className="create-user-drawer__role-option">
                                        <span>{option.label}</span>
                                        <small>{role?.locked ? "Rol protegido" : `${String(role?.users ?? 0)} usuarios`}</small>
                                    </span>
                                );
                            }}
                        />
                    </Form.Item>
                    {selectModules && (
                        <Form.Item<CreateUserFormValues> label="Módulos asignados" name="orgUnitCodes">
                            <Select mode="multiple" allowClear virtual={false} getPopupContainer={(trigger: HTMLElement) => trigger.closest<HTMLElement>(".ant-drawer-body") ?? trigger.parentElement ?? trigger} disabled={isEditMode && !canAssignRoles} placeholder="Sin módulos asignados" options={availableModules.map((module) => ({ label: module.name, value: module.code }))} />
                        </Form.Item>
                    )}
                </FormSection>
                <FormSection step={3} title="Auditoría">
                    <Form.Item<CreateUserFormValues>
                        label={isEditMode ? "Motivo de la edición" : "Motivo del alta"}
                        name="reason"
                        rules={[
                            { message: isEditMode ? "Indica el motivo de la edición." : "Indica el motivo del alta.", required: true, whitespace: true },
                            { message: "Usa al menos 5 caracteres.", min: 5 },
                        ]}
                    >
                        <Input.TextArea autoSize={{ maxRows: 4, minRows: 2 }} maxLength={500} placeholder={isEditMode ? "Cambio autorizado por jefatura." : "Alta autorizada por jefatura de ventas."} />
                    </Form.Item>
                </FormSection>

                <Collapse
                    className="create-user-drawer__advanced"
                    size="small"
                    items={[
                        {
                            children: (
                                <Row gutter={16}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item<CreateUserFormValues> label="ID NetSuite" name="netsuiteId">
                                            <Input autoComplete="off" maxLength={64} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item<CreateUserFormValues> label="ID Odoo" name="odooId">
                                            <Input autoComplete="off" maxLength={64} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            ),
                            key: "integrations",
                            label: (
                                <span className="create-user-drawer__advanced-label">
                                    Opciones avanzadas
                                    <small>Integraciones · opcional</small>
                                </span>
                            ),
                        },
                    ]}
                />
            </Form>
        </Drawer>
    );
}
