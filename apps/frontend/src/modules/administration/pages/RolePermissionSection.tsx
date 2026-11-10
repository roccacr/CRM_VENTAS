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

/** Resumen concedidos/total que se muestra junto a módulos y secciones. */
export interface PermissionCoverage {
    readonly granted: number;
    readonly total: number;
}

/** Formato «concedidos/total». */
const formatCoverage = ({ granted, total }: PermissionCoverage): string => `${String(granted)}/${String(total)}`;

/** Propiedades del selector de módulo y sección. */
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
                <Select<string> aria-label="Módulo" disabled={disabled} value={activeModule.key} options={[...modules].sort((first, second) => first.name.localeCompare(second.name, "es")).map((module) => ({ label: module.name, value: module.key }))} optionRender={(option) => <OptionWithCoverage label={option.label} coverage={moduleCoverage.get(String(option.value))} />} onChange={onModuleChange} />
            </div>
            <div className="roles-security-field">
                <span className="roles-security-field__label">Sección</span>
                <Select<string> aria-label="Sección" disabled={disabled} value={activeSection.key} options={[...activeModule.sections].sort((first, second) => first.name.localeCompare(second.name, "es")).map((section) => ({ label: section.name, value: section.key }))} optionRender={(option) => <OptionWithCoverage label={option.label} coverage={sectionCoverage.get(String(option.value))} />} onChange={onSectionChange} />
            </div>
        </section>
    );
}

/** Opción de selector que muestra su cobertura al lado. */
function OptionWithCoverage({ coverage, label }: { readonly coverage: string | undefined; readonly label: ReactNode }) {
    return (
        <span className="roles-security-option">
            <span>{label}</span>
            <small>{coverage}</small>
        </span>
    );
}

/** Interruptor que decide si el módulo aparece en el menú del empleado o del rol. */
export interface MenuVisibilityControl {
    readonly checked: boolean;
    readonly moduleName: string;
    readonly onToggle: () => void;
    readonly isAccessScope?: boolean;
    readonly isRoleTemplate?: boolean;
}

/** Propiedades de la tabla de permisos de una sección. */
interface RolePermissionSectionProps {
    readonly isModuleAssigned?: boolean;
    readonly activeView: PermissionSectionView;
    readonly getGrantedCodes: (view: PermissionSectionView) => ReadonlySet<string>;
    /** Solo en modo empleado: de dónde sale cada permiso. */
    readonly getOrigin?: ((code: string) => string) | undefined;
    readonly isBusy: boolean;
    /** Plantilla protegida: solo lectura. Los permisos concedidos siguen saliendo del catálogo del API. */
    readonly isLocked: boolean;
    readonly menuVisibility?: MenuVisibilityControl | undefined;
    readonly moduleName: string;
    readonly onSelectView: (key: string) => void;
    readonly onSetViewPermissions: (view: PermissionSectionView, codes: ReadonlySet<string>) => void;
    readonly section: PermissionSection;
}

/** Tarjeta de la sección activa: acceso, cobertura y una fila por acción. */
export function RolePermissionSection({ activeView, getGrantedCodes, getOrigin, isBusy, isLocked, isModuleAssigned = true, menuVisibility, moduleName, onSelectView, onSetViewPermissions, section }: RolePermissionSectionProps) {
    const grantedCodes = getGrantedCodes(activeView);
    const enabledCodes = new Set(activeView.permissions.map((permission) => permission.code).filter((code) => grantedCodes.has(code)));
    const isReadOnly = isLocked || isBusy || !isModuleAssigned;
    /** Concede o revoca un permiso concreto; en solo lectura no tiene efecto. */
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
                isBannerSection={activeView.moduleCode === "formalizacion" && activeView.code === "home"}
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

/** Interruptor de visibilidad del módulo en el menú. */
function MenuVisibilitySwitch({ control, disabled }: { readonly control: MenuVisibilityControl; readonly disabled: boolean }) {
    if (control.isRoleTemplate)
        return (
            <span className="roles-security-visibility">
                <Switch size="small" checked={control.checked} disabled={disabled} aria-label={`Módulo ${control.moduleName} habilitado en plantilla`} onChange={control.onToggle} />
                <span>
                    {control.moduleName} {control.checked ? "habilitado en plantilla" : "deshabilitado en plantilla"}
                </span>
            </span>
        );
    const stateLabel = control.isAccessScope ? (control.checked ? "asignado" : "no asignado") : control.checked ? "visible en el menú" : "oculto del menú";
    const accessibleLabel = control.isAccessScope ? `Módulo ${control.moduleName} asignado` : `Módulo ${control.moduleName} visible en el menú`;
    return (
        <span className="roles-security-visibility">
            <Switch size="small" checked={control.checked} disabled={disabled} aria-label={accessibleLabel} onChange={control.onToggle} />
            <span>
                {control.moduleName} {stateLabel}
            </span>
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

/** Propiedades de la barra de acceso de una sección. */
interface SectionAccessBarProps {
    readonly enabledCount: number;
    readonly isBannerSection: boolean;
    readonly isReadOnly: boolean;
    readonly onGrantAll: () => void;
    readonly onToggleAccess: (isOn: boolean) => void;
    readonly total: number;
}

/** Enciende o apaga el acceso de la sección completa y permite conceder todo. */
function SectionAccessBar({ enabledCount, isBannerSection, isReadOnly, onGrantAll, onToggleAccess, total }: SectionAccessBarProps) {
    const hasAccess = enabledCount > 0;
    const stateLabel = isBannerSection ? (hasAccess ? "Banners visibles" : "Banners ocultos") : hasAccess ? "Acceso permitido" : "Sin acceso";

    return (
        <div className="roles-security-access">
            <span className="roles-security-access__state">
                <Switch checked={hasAccess} disabled={isReadOnly} aria-label={isBannerSection ? "Visibilidad de banners" : "Acceso a la sección"} onChange={onToggleAccess} />
                <strong>{stateLabel}</strong>
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

/** Propiedades de la tabla de permisos de una vista. */
interface PermissionTableProps {
    readonly enabledCodes: ReadonlySet<string>;
    readonly getOrigin?: ((code: string) => string) | undefined;
    readonly isReadOnly: boolean;
    readonly onToggle: (code: string) => void;
    readonly view: PermissionSectionView;
}

/** Tabla de permisos de una vista; muestra el origen (rol o excepción) de cada permiso. */
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
