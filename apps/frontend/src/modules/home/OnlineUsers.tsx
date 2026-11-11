import TeamOutlined from "@ant-design/icons/TeamOutlined";
import Alert from "antd/es/alert";
import Drawer from "antd/es/drawer";
import { useEffect, useState } from "react";

import { apiRequest } from "../../services/api/api-client";
import type { IdentityProfile } from "../../services/auth/identity-contracts";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";

interface OnlinePerson {
    readonly publicId: string;
    readonly displayName: string;
}
interface Presence {
    readonly users: readonly OnlinePerson[];
    readonly observedAt: string;
}

/** El mismo texto accesible identifica la cantidad en el icono y en el panel. */
function presenceCount(data: Presence | null) {
    if (!data) return { value: "—", label: "Cantidad de personas no disponible" };
    return { value: String(data.users.length), label: `${String(data.users.length)} ${data.users.length === 1 ? "persona en línea" : "personas en línea"}` };
}

/** Todos anuncian su propia actividad; solo Owner puede abrir el directorio. El API vuelve a autorizar. */
export function OnlineUsers({ roles = [], enabled = true }: { readonly roles?: IdentityProfile["roles"] | undefined; readonly enabled?: boolean }) {
    const owner = roles.some((role) => role.code === "owner" && role.status === "active");
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<Presence | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!enabled) return;
        let lastActivity = Date.now();
        let busy = false;
        const controller = new AbortController();
        const activity = () => {
            lastActivity = Date.now();
        };
        const beat = () => {
            if (busy || document.visibilityState === "hidden" || Date.now() - lastActivity >= 300000) return;
            busy = true;
            void apiRequest("/identity/presence/heartbeat", { method: "POST", signal: controller.signal })
                .catch(() => {
                    // La presencia es auxiliar: una desconexión no bloquea el CRM ni fabrica usuarios conectados.
                })
                .finally(() => {
                    busy = false;
                });
        };
        const visible = () => {
            if (document.visibilityState !== "hidden") {
                activity();
                beat();
            }
        };
        window.addEventListener("pointerdown", activity, { passive: true });
        window.addEventListener("keydown", activity);
        window.addEventListener("scroll", activity, { passive: true });
        document.addEventListener("visibilitychange", visible);
        beat();
        const timer = setInterval(beat, 30000);
        return () => {
            controller.abort();
            clearInterval(timer);
            window.removeEventListener("pointerdown", activity);
            window.removeEventListener("keydown", activity);
            window.removeEventListener("scroll", activity);
            document.removeEventListener("visibilitychange", visible);
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !owner) return;
        const controller = new AbortController();
        let busy = false;
        const read = () => {
            if (busy || document.visibilityState === "hidden") return;
            busy = true;
            void apiRequest<Presence | null>("/identity/presence", { signal: controller.signal })
                .then((result) => {
                    if (!result || !Array.isArray(result.users)) throw new Error("Respuesta de presencia inválida.");
                    if (!controller.signal.aborted) {
                        setData(result);
                        setFailed(false);
                    }
                })
                .catch(() => {
                    if (!controller.signal.aborted) {
                        setData(null);
                        setFailed(true);
                    }
                })
                .finally(() => {
                    busy = false;
                });
        };
        read();
        const timer = setInterval(read, 15000);
        return () => {
            controller.abort();
            clearInterval(timer);
        };
    }, [enabled, owner]);

    if (!owner) return null;
    const count = presenceCount(data);
    return (
        <>
            <button
                className="global-home-header__icon-button online-users-button"
                type="button"
                aria-label="Personas en línea"
                title="Personas en línea"
                onClick={() => {
                    setOpen(true);
                }}
            >
                <TeamOutlined aria-hidden="true" />
                <span className="online-users-button__count" aria-label={count.label}>
                    {count.value}
                </span>
            </button>
            <Drawer
                {...ADMINISTRATION_DRAWER_PROPS}
                rootClassName="user-detail-drawer online-users-drawer"
                closable={{ placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
                title="Personas en línea"
                open={open}
                onClose={() => {
                    setOpen(false);
                }}
            >
                <p>Personas con actividad reciente en Habita. Actualización cada 15 segundos; una desconexión puede tardar hasta 90 segundos en reflejarse.</p>
                {failed ? (
                    <Alert type="warning" showIcon title="No fue posible consultar las personas en línea. Reintentaremos automáticamente." />
                ) : data ? (
                    <>
                        <p role="status">{count.label}</p>
                        {data.users.length ? (
                            <ul className="online-users-list" aria-label="Usuarios conectados">
                                {data.users.map((user) => (
                                    <li key={user.publicId}>
                                        <span className="online-users-list__dot" aria-label="En línea" /> {user.displayName}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No hay personas en línea en este momento.</p>
                        )}
                    </>
                ) : (
                    <p role="status">Consultando personas en línea…</p>
                )}
            </Drawer>
        </>
    );
}
import "../administration/components/UserDetailDrawer.css";
