/**
 * Selectores en cascada y tarjeta de permisos de una sección.
 *
 * No guarda nada: recibe el estado efectivo y devuelve la intención de cambio a
 * la página, que conserva la matriz, las excepciones y el guardado auditado.
 */
import Segmented from "antd/es/segmented";
import Select from "antd/es/select";
import Switch from "antd/es/switch";
import type { ReactNode } from "react";

import { getAccessPermissionCodes, getAllPermissionCodes, getPermissionLevel, PERMISSION_LEVEL_LABELS, type PermissionDisplayModule, type PermissionSection, type PermissionSectionView } from "./roles-security-sections";

export interface PermissionCoverage {
    readonly granted: number;
    readonly total: number;
}

const formatCoverage = ({ granted, total }: PermissionCoverage): string => `${String(granted)}/${String(total)}`;

interface RolesSecurityNavigatorProps {
    readonly activeModule: PermissionDisplayModule;
    readonly activeSection: PermissionSection;
    readonly disabled: boolean;
    readonly getModuleCoverage: (module: PermissionDisplayModule) => PermissionCoverage;
    readonly getSectionCoverage: (section: PermissionSection) => PermissionCoverage;
    readonly modules: readonly PermissionDisplayModule[];
    readonly onModuleChange: (key: string) => void;
    readonly onSectionChange: (key: string) => void;
}

/** Módulo y sección: la segunda lista depende de la primera. Cada opción muestra su cobertura. */
export function RolesSecurityNavigator({ activeModule, activeSection, disabled, getModuleCoverage, getSectionCoverage, modules, onModuleChange, onSectionChange }: RolesSecurityNavigatorProps) {
    const moduleCoverage = new Map(modules.map((module) => [module.key, formatCoverage(getModuleCoverage(module))]));
    const sectionCoverage = new Map(activeModule.sections.map((section) => [section.key, formatCoverage(getSectionCoverage(section))]));

    return (
        <section className="roles-security-navigator" aria-label="Navegación de permisos">
            <div className="roles-security-field">
                <span className="roles-security-field__label">Módulo</span>
                <Select<string> aria-label="Módulo" disabled={disabled} value={activeModule.key} options={modules.map((module) => ({ label: module.name, value: module.key }))} optionRender={(option) => <OptionWithCoverage label={option.label} coverage={moduleCoverage.get(String(option.value))} />} onChange={onModuleChange} />
            </div>
            <div className="roles-security-field">
                <span className="roles-security-field__label">Sección</span>
                <Select<string> aria-label="Sección" disabled={disabled} value={activeSection.key} options={activeModule.sections.map((section) => ({ label: section.name, value: section.key }))} optionRender={(option) => <OptionWithCoverage label={option.label} coverage={sectionCoverage.get(String(option.value))} />} onChange={onSectionChange} />
            </div>
        </section>
    );
}

function OptionWithCoverage({ coverage, label }: { readonly coverage: string | undefined; readonly label: ReactNode }) {
    return (
        <span className="roles-security-option">
            <span>{label}</span>
            <small>{coverage}</small>
        </span>
    );
}

export interface MenuVisibilityControl {
    readonly checked: boolean;
    readonly moduleName: string;
    readonly onToggle: () => void;
}

interface RolePermissionSectionProps {
    readonly activeView: PermissionSectionView;
    readonly getGrantedCodes: (view: PermissionSectionView) => ReadonlySet<string>;
    /** Solo en modo empleado: de dónde sale cada permiso. */
    readonly getOrigin?: ((code: string) => string) | undefined;
    readonly isBusy: boolean;
    /** Rol protegido: se muestra todo concedido y nada se puede cambiar. */
    readonly isLocked: boolean;
    readonly menuVisibility?: MenuVisibilityControl | undefined;
    readonly moduleName: string;
    readonly onSelectView: (key: string) => void;
    readonly onSetViewPermissions: (view: PermissionSectionView, codes: ReadonlySet<string>) => void;
    readonly section: PermissionSection;
}

/** Tarjeta de la sección activa: acceso, cobertura y una fila por acción. */
export function RolePermissionSection({ activeView, getGrantedCodes, getOrigin, isBusy, isLocked, menuVisibility, moduleName, onSelectView, onSetViewPermissions, section }: RolePermissionSectionProps) {
    const grantedCodes = getGrantedCodes(activeView);
    const enabledCodes = new Set(activeView.permissions.map((permission) => permission.code).filter((code) => grantedCodes.has(code)));
    const isReadOnly = isLocked || isBusy;
    const togglePermission = (code: string) => {
        const next = new Set(enabledCodes);

        if (next.has(code)) {
            next.delete(code);
        } else {
            next.add(code);
        }

        onSetViewPermissions(activeView, next);
    };

    return (
        <section className="roles-security-section" aria-labelledby="roles-security-section-title">
            <header className="roles-security-section__header">
                <h2 id="roles-security-section-title">
                    <span>{moduleName}</span>
                    <span aria-hidden="true">/</span>
                    <span>{section.name}</span>
                </h2>
                {menuVisibility ? <MenuVisibilitySwitch control={menuVisibility} disabled={isBusy} /> : null}
            </header>
            {section.isCatalog ? <CatalogTabs activeView={activeView} getGrantedCodes={getGrantedCodes} section={section} onSelectView={onSelectView} /> : null}
            <SectionAccessBar
                enabledCount={enabledCodes.size}
                isReadOnly={isReadOnly}
                total={activeView.permissions.length}
                onGrantAll={() => {
                    onSetViewPermissions(activeView, getAllPermissionCodes(activeView));
                }}
                onToggleAccess={(isOn) => {
                    onSetViewPermissions(activeView, isOn ? getAccessPermissionCodes(activeView) : new Set());
                }}
            />
            <PermissionTable enabledCodes={enabledCodes} getOrigin={getOrigin} isReadOnly={isReadOnly} view={activeView} onToggle={togglePermission} />
        </section>
    );
}

function MenuVisibilitySwitch({ control, disabled }: { readonly control: MenuVisibilityControl; readonly disabled: boolean }) {
    return (
        <span className="roles-security-visibility">
            <Switch size="small" checked={control.checked} disabled={disabled} aria-label={`Módulo ${control.moduleName} visible en el menú`} onChange={control.onToggle} />
            <span>{control.checked ? `${control.moduleName} visible en el menú` : `${control.moduleName} oculto del menú`}</span>
        </span>
    );
}

/** Una pestaña por catálogo compartido, con su cobertura; solo se ve el catálogo activo. */
function CatalogTabs({ activeView, getGrantedCodes, onSelectView, section }: { readonly activeView: PermissionSectionView; readonly getGrantedCodes: (view: PermissionSectionView) => ReadonlySet<string>; readonly onSelectView: (key: string) => void; readonly section: PermissionSection }) {
    return (
        <Segmented<string>
            className="roles-security-catalog-tabs"
            aria-label="Catálogo"
            value={activeView.key}
            options={section.views.map((view) => {
                const granted = getGrantedCodes(view);
                const coverage = { granted: view.permissions.filter((permission) => granted.has(permission.code)).length, total: view.permissions.length };

                return {
                    label: (
                        <span className="roles-security-catalog-tab">
                            <span>{view.name}</span>
                            <small>{formatCoverage(coverage)}</small>
                        </span>
                    ),
                    value: view.key,
                };
            })}
            onChange={onSelectView}
        />
    );
}

interface SectionAccessBarProps {
    readonly enabledCount: number;
    readonly isReadOnly: boolean;
    readonly onGrantAll: () => void;
    readonly onToggleAccess: (isOn: boolean) => void;
    readonly total: number;
}

function SectionAccessBar({ enabledCount, isReadOnly, onGrantAll, onToggleAccess, total }: SectionAccessBarProps) {
    const hasAccess = enabledCount > 0;

    return (
        <div className="roles-security-access">
            <span className="roles-security-access__state">
                <Switch checked={hasAccess} disabled={isReadOnly} aria-label="Acceso a la sección" onChange={onToggleAccess} />
                <strong>{hasAccess ? "Acceso permitido" : "Sin acceso"}</strong>
            </span>
            <span className="roles-security-access__coverage">
                Permisos
                <strong>
                    {enabledCount} / {total}
                </strong>
                activos
            </span>
            <button className="roles-security-secondary-action" type="button" disabled={isReadOnly || enabledCount === total} onClick={onGrantAll}>
                Marcar todos
            </button>
        </div>
    );
}

interface PermissionTableProps {
    readonly enabledCodes: ReadonlySet<string>;
    readonly getOrigin?: ((code: string) => string) | undefined;
    readonly isReadOnly: boolean;
    readonly onToggle: (code: string) => void;
    readonly view: PermissionSectionView;
}

function PermissionTable({ enabledCodes, getOrigin, isReadOnly, onToggle, view }: PermissionTableProps) {
    return (
        <table className="roles-security-permission-table">
            <caption>Permisos de {view.name}</caption>
            <thead>
                <tr>
                    <th scope="col">Acción / Permiso</th>
                    <th scope="col">Nivel</th>
                    <th scope="col">Estado</th>
                </tr>
            </thead>
            <tbody>
                {view.permissions.map((permission) => {
                    const level = getPermissionLevel(permission);
                    const isEnabled = enabledCodes.has(permission.code);

                    return (
                        <tr key={permission.code} className={isEnabled ? "" : "is-off"}>
                            <td data-label="Acción">
                                <strong>{permission.name}</strong>
                                {permission.description ? <small>{permission.description}</small> : null}
                            </td>
                            <td data-label="Nivel">
                                <span className={`roles-security-level roles-security-level--${level}`}>{PERMISSION_LEVEL_LABELS[level]}</span>
                            </td>
                            <td data-label="Estado">
                                <span className="roles-security-permission-state">
                                    <Switch
                                        size="small"
                                        checked={isEnabled}
                                        disabled={isReadOnly}
                                        aria-label={permission.name}
                                        onChange={() => {
                                            onToggle(permission.code);
                                        }}
                                    />
                                    <span>
                                        {isEnabled ? "Habilitado" : "Deshabilitado"}
                                        {getOrigin ? <small>{getOrigin(permission.code)}</small> : null}
                                    </span>
                                </span>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
