import type { GlobalHomeCurrentUser } from "../../home/GlobalHomeShell";

const getDisplayName = (user: GlobalHomeCurrentUser): string => user.displayName.trim() || user.email.trim() || "Usuario";

/**
 * Saludo del módulo. No consulta usuarios ni permisos: eso lo resuelve el shell.
 */
export function AdministrationHomePage({ currentUser }: { readonly currentUser: GlobalHomeCurrentUser }) {
    return (
        <div className="global-home-dashboard">
            <section className="global-home-page-header" aria-labelledby="administration-home-page-title">
                <div>
                    <h1 id="administration-home-page-title">Hola {getDisplayName(currentUser)} al módulo Administración</h1>
                </div>
            </section>
        </div>
    );
}
