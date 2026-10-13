import Checkbox from "antd/es/checkbox";
import { useState } from "react";

interface Permission {
    readonly code: string;
    readonly name: string;
    readonly description: string;
    readonly sensitive?: boolean;
}
interface View {
    readonly code: string;
    readonly name: string;
    readonly permissions: readonly Permission[];
}
interface Module {
    readonly code: string;
    readonly name: string;
    readonly views: readonly View[];
}
interface ScopedView extends View {
    readonly moduleCode: string;
}
export interface RolePermissionTarget {
    readonly moduleCode: string;
    readonly code: string;
}
interface Props {
    readonly modules: readonly Module[];
    readonly granted: Record<string, readonly string[]>;
    readonly locked: boolean;
    readonly busy: boolean;
    readonly onToggle: (code: string, moduleCode: string) => void;
    readonly onSetSection: (targets: readonly RolePermissionTarget[], enabled: boolean) => void;
}

const CATALOG_ORDER = ["catalog_project", "catalog_campaign", "catalog_class", "catalog_broker", "catalog_file", "catalog_subsidiary", "catalog_location"];
const ACTION_ORDER = ["read", "view_list", "view_detail", "create", "update", "activate", "deactivate", "delete"];
const actionOrder = (permission: Permission) => {
    const rank = ACTION_ORDER.indexOf(permission.code.split(".").pop() ?? "");
    return rank < 0 ? ACTION_ORDER.length : rank;
};

/** Presentation grouping only: retain the API module and permission codes for every mutation. */
function sections(module: Module, modules: readonly Module[]) {
    const scoped = (source: Module): ScopedView[] => source.views.map((view) => ({ ...view, permissions: [...view.permissions].sort((a, b) => actionOrder(a) - actionOrder(b)), moduleCode: source.code }));
    const views = scoped(module);
    const catalogs = views
        .filter((view) => view.code.startsWith("catalog_"))
        .sort((a, b) => {
            const first = CATALOG_ORDER.indexOf(a.code);
            const second = CATALOG_ORDER.indexOf(b.code);
            return (first < 0 ? CATALOG_ORDER.length : first) - (second < 0 ? CATALOG_ORDER.length : second);
        });
    const own = views.filter((view) => !view.code.startsWith("catalog_"));
    if (module.code !== "administration") return [...own.map((view) => ({ code: view.code, name: view.name, views: [view], inherited: false })), { code: "catalogs", name: "Catálogos", views: catalogs, inherited: false }].filter((section) => section.views.length);
    const user = modules.filter((item) => item.code === "user").flatMap(scoped);
    const role = modules.filter((item) => item.code === "role").flatMap(scoped);
    const audit = own.filter((view) => view.code.includes("audit"));
    return [
        { code: "users", name: "Usuarios", views: user, inherited: false },
        { code: "roles", name: "Roles y seguridad", views: role, inherited: false },
        // The audit API currently uses role.assign, not a separate audit permission.
        { code: "audit", name: "Auditoría", views: audit.length ? audit : role.map((view) => ({ ...view, name: "Auditoría", permissions: view.permissions.filter((permission) => permission.code === "role.assign").map((permission) => ({ ...permission, name: "Acceder a Auditoría" })) })), inherited: !audit.length },
        { code: "catalogs", name: "Catálogos", views: catalogs, inherited: false },
        ...own.filter((view) => !view.code.includes("audit")).map((view) => ({ code: view.code, name: view.name, views: [view], inherited: false })),
    ];
}

// Expanded view, shared audit access, selection and locked/partial checkboxes are independent UI states.
// eslint-disable-next-line complexity
function PermissionSection({ name, views, inherited, ...props }: Props & { readonly name: string; readonly views: readonly ScopedView[]; readonly inherited: boolean }) {
    const [selected, setSelected] = useState(views[0]?.code);
    const view = views.find((item) => item.code === selected) ?? views[0];
    const targets = views.flatMap((item) => item.permissions.map((permission) => ({ moduleCode: item.moduleCode, code: permission.code })));
    const allowed = (target: RolePermissionTarget) => props.locked || (props.granted[target.moduleCode] ?? []).includes(target.code);
    const count = targets.filter(allowed).length;
    const canView = targets.filter((target) => /(?:\.read|\.view_list|\.view_detail|^role\.assign)$/.test(target.code)).some(allowed);
    return (
        <details className="role-hierarchy-section" aria-label={name}>
            <summary>
                <strong>{name}</strong>
                <span className="role-hierarchy-access">{canView ? "Acceso permitido" : "Sin acceso"}</span>
            </summary>
            <div className="role-hierarchy-section-tools">
                <Checkbox
                    aria-label={`Todos los permisos de ${name}`}
                    checked={targets.length > 0 && count === targets.length}
                    indeterminate={count > 0 && count < targets.length}
                    disabled={props.locked || props.busy || inherited || !targets.length}
                    onChange={(event) => {
                        props.onSetSection(targets, event.target.checked);
                    }}
                >
                    Todos los permisos
                </Checkbox>
                <span>
                    {count} / {targets.length}
                </span>
            </div>
            {inherited ? <p className="role-hierarchy-note">Comparte el permiso de Roles y seguridad</p> : null}
            {view ? (
                <div className={`role-hierarchy-content${views.length > 1 ? " role-hierarchy-content--split" : ""}`}>
                    {views.length > 1 ? (
                        <nav aria-label={`Vistas de ${name}`}>
                            {views.map((item) => (
                                <button
                                    type="button"
                                    key={item.code}
                                    aria-pressed={item.code === view.code}
                                    onClick={() => {
                                        setSelected(item.code);
                                    }}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </nav>
                    ) : null}
                    <div className="role-hierarchy-matrix">
                        <h3>{view.name}</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th scope="col">Acción</th>
                                    <th scope="col">Permiso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {view.permissions.map((permission) => (
                                    <tr key={permission.code}>
                                        <th scope="row" title={permission.description}>
                                            {permission.name}
                                            {permission.sensitive ? <em> Sensible</em> : null}
                                        </th>
                                        <td>
                                            <Checkbox
                                                aria-label={permission.name}
                                                checked={allowed({ moduleCode: view.moduleCode, code: permission.code })}
                                                disabled={props.locked || props.busy || inherited}
                                                onChange={() => {
                                                    props.onToggle(permission.code, view.moduleCode);
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <p className="role-hierarchy-note">Sin acciones configuradas</p>
            )}
        </details>
    );
}

/** One primary module at a time, with separate sections, views and real API actions. */
export function RolePermissionHierarchy(props: Props) {
    const primary = props.modules.filter((module) => !["user", "role"].includes(module.code) && !module.code.startsWith("catalog_"));
    const ordered = [...primary].sort((a, b) => Number(b.code === "administration") - Number(a.code === "administration"));
    return (
        <section className="role-hierarchy" aria-label="Módulos del sistema">
            {ordered.map((module) => (
                <details className="role-hierarchy-module" key={module.code} open={module.code === "administration" || ordered.length === 1} aria-label={module.code === "administration" ? "Administración" : module.name}>
                    <summary>
                        <strong>{module.code === "administration" ? "Administración" : module.name}</strong>
                    </summary>
                    <div className="role-hierarchy-sections">
                        {sections(module, props.modules).map((section) => (
                            <PermissionSection {...props} key={section.code} name={section.name} views={section.views} inherited={section.inherited} />
                        ))}
                    </div>
                </details>
            ))}
        </section>
    );
}
