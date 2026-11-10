import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import CloudOutlined from "@ant-design/icons/CloudOutlined";
import type { ReactNode } from "react";

import { ProfileCard } from "./LeadProfileFields";

interface PreparedProps {
    readonly title: string;
    readonly icon: ReactNode;
    readonly heading: string;
    readonly description: string;
    readonly columns: readonly string[];
    readonly note: string;
}

/**
 * Una sección cuyos datos todavía no están conectados. Conserva su lugar y su estructura, qué se listará y en qué columnas,
 * dice con claridad que nada está cargado y no muestra filas inventadas.
 */
function PreparedSection({ title, icon, heading, description, columns, note }: PreparedProps) {
    return (
        <ProfileCard title={title} aside={<span className="profile-chip">En preparación</span>} className="profile-card--prepared">
            <div className="profile-prepared">
                <span className="profile-prepared__icon" aria-hidden="true">
                    {icon}
                </span>
                <div>
                    <h3>{heading}</h3>
                    <p>{description}</p>
                </div>
            </div>
            <div className="profile-table-wrap">
                <table className="profile-table profile-table--ghost">
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th key={column} scope="col">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colSpan={columns.length}>Sin registros para mostrar todavía.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p className="profile-hint profile-hint--note">{note}</p>
        </ProfileCard>
    );
}

/** Eventos todavía no conectados. Conserva las columnas y no inventa filas. */
export function EventsPrepared() {
    return <PreparedSection title="Lista de eventos" icon={<CalendarOutlined />} heading="Eventos del cliente" description="Citas, reuniones y tareas agendadas con este cliente se listarán aquí, con su fecha, tipo y responsable." columns={["Fecha", "Tipo", "Evento", "Responsable", "Estado"]} note="Esta sección todavía no está conectada: queda lista para cargar los eventos del cliente por separado, sin afectar al resto del perfil." />;
}
/** Documentos todavía no conectados. Conserva las columnas y no inventa filas. */
export function FilesPrepared() {
    return <PreparedSection title="OneDrive" icon={<CloudOutlined />} heading="Documentos del cliente" description="Contratos, reservas y archivos del cliente guardados en OneDrive se listarán aquí." columns={["Nombre", "Tipo", "Modificado", "Tamaño"]} note="Esta sección todavía no está conectada: queda lista para cargar los documentos por separado, sin afectar al resto del perfil." />;
}
