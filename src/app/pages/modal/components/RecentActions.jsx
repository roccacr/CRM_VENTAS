import React from "react";

const STATUS_LABELS = {
    "01-LEAD-INTERESADO": "Lead interesado",
    "02-LEAD-OPORTUNIDAD": "Oportunidad",
    "03-LEAD-PRE-RESERVA": "Pre-reserva",
    "04-LEAD-RESERVA": "Reserva",
    "05-LEAD-CONTRATO": "Contrato",
    "07-LEAD-PERDIDO": "Lead perdido",
    "08-LEAD-SEGUIMIENTO": "Seguimiento",
    "09-OPORTUNIDAD-INACTIVA": "Oportunidad inactiva",
    "10-OPORTUNIDAD-REACTIVADA": "Oportunidad reactivada",
};

const STATUS_THEME = {
    "01-LEAD-INTERESADO": { accent: "#64748b", pillBg: "#f1f5f9", pillColor: "#475569" },
    "02-LEAD-OPORTUNIDAD": { accent: "#2563eb", pillBg: "#eff6ff", pillColor: "#1d4ed8" },
    "03-LEAD-PRE-RESERVA": { accent: "#0891b2", pillBg: "#ecfeff", pillColor: "#0e7490" },
    "04-LEAD-RESERVA": { accent: "#059669", pillBg: "#ecfdf5", pillColor: "#047857" },
    "05-LEAD-CONTRATO": { accent: "#334155", pillBg: "#f8fafc", pillColor: "#1e293b" },
    "07-LEAD-PERDIDO": { accent: "#dc2626", pillBg: "#fef2f2", pillColor: "#b91c1c" },
    "08-LEAD-SEGUIMIENTO": { accent: "#d97706", pillBg: "#fffbeb", pillColor: "#b45309" },
    "09-OPORTUNIDAD-INACTIVA": { accent: "#dc2626", pillBg: "#fef2f2", pillColor: "#b91c1c" },
    "10-OPORTUNIDAD-REACTIVADA": { accent: "#059669", pillBg: "#ecfdf5", pillColor: "#047857" },
};

const DEFAULT_THEME = { accent: "#64748b", pillBg: "#f1f5f9", pillColor: "#475569" };

const DETAIL_TEXT_REPLACEMENTS = [
    [/hist\?rico/gi, "histórico"],
    [/histÃ³rico/gi, "histórico"],
    [/Se creo un un nuevo lead/gi, "Se creó un nuevo lead"],
    [/Se creo un nuevo lead/gi, "Se creó un nuevo lead"],
    [/Se creo/gi, "Se creó"],
    [/generadon/gi, "generado"],
    [/boton/gi, "botón"],
    [/automatico/gi, "automático"],
    [/Se Coloco/gi, "Se colocó"],
    [/Se coloco/gi, "Se colocó"],
    [/interaccion/gi, "interacción"],
    [/especificos/gi, "específicos"],
    [/creado el lead/gi, "creado el lead"],
    [/evento\.\s*:/g, "evento:"],
    [/\s{2,}/g, " "],
];

const getStatusLabel = (status) => STATUS_LABELS[status] || status?.replace(/^\d+-/, "").replace(/-/g, " ") || "Actividad";

const getStatusTheme = (status) => STATUS_THEME[status] || DEFAULT_THEME;

/**
 * Normaliza textos históricos de bitácora para mostrar ortografía correcta en UI.
 *
 * @param {string} text - Texto original del detalle.
 * @returns {string} Texto corregido para presentación.
 */
const normalizeDetailText = (text) => {
    if (!text) {
        return "Sin detalle";
    }

    let normalized = text.trim();

    DETAIL_TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => {
        normalized = normalized.replace(pattern, replacement);
    });

    return normalized;
};

const TimelineSkeleton = () => (
    <div className="recent-actions-timeline__skeleton" aria-hidden="true">
        {[0, 1, 2].map((item) => (
            <div key={item} className="recent-actions-timeline__skeleton-row">
                <div className="recent-actions-timeline__skeleton-time" />
                <div className="recent-actions-timeline__skeleton-line" />
                <div className="recent-actions-timeline__skeleton-card" />
            </div>
        ))}
    </div>
);

/**
 * Timeline de acciones recientes del lead con presentación profesional.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {boolean} props.showPreload - Indica si debe mostrarse el estado de carga.
 * @param {Array} props.sortedBitacora - Lista ordenada de acciones.
 * @param {Function} props.formatDate - Formatea fecha y hora del evento.
 * @returns {JSX.Element} Timeline renderizada.
 */
export const RecentActions = ({ showPreload, sortedBitacora, formatDate }) => (
    <div className="card latest-activity-card recent-actions-timeline">
        <div className="card-header recent-actions-timeline__header text-start">
            <div className="w-100">
                <h5 className="recent-actions-timeline__title mb-0">
                    <i className="ph-duotone ph-clock-counter-clockwise me-2" aria-hidden="true" />
                    Últimas acciones del lead
                </h5>
                <p className="recent-actions-timeline__subtitle mb-0">
                    Historial reciente de movimientos y seguimiento
                </p>
            </div>
        </div>

        {showPreload ? (
            <div className="card-body pt-2 pb-3 text-start">
                <p className="recent-actions-timeline__loading-text mb-3">Cargando últimas acciones...</p>
                <TimelineSkeleton />
            </div>
        ) : (
            <div className="card-body recent-actions-timeline__body text-start">
                {sortedBitacora.length > 0 ? (
                    <ol className="recent-actions-timeline__list mb-0">
                        {sortedBitacora.map((entry, idx) => {
                            const { formattedDate, formattedTime } = formatDate(entry.fecha_creado_bit);
                            const theme = getStatusTheme(entry.estado_bit);
                            const isLast = idx === sortedBitacora.length - 1;
                            const detail = normalizeDetailText(entry.detalle_bit);

                            return (
                                <li
                                    key={`${entry.id_bitacora_bit || idx}-${entry.estado_bit}-${entry.fecha_creado_bit}`}
                                    className="recent-actions-timeline__item"
                                >
                                    <div className="recent-actions-timeline__time" aria-label={`Hora ${formattedTime}`}>
                                        <span className="recent-actions-timeline__clock">{formattedTime}</span>
                                        <span className="recent-actions-timeline__date">{formattedDate}</span>
                                    </div>

                                    <div className="recent-actions-timeline__rail" aria-hidden="true">
                                        <span
                                            className="recent-actions-timeline__dot"
                                            style={{
                                                borderColor: theme.accent,
                                                backgroundColor: theme.accent,
                                            }}
                                        />
                                        {!isLast ? <span className="recent-actions-timeline__connector" /> : null}
                                    </div>

                                    <article
                                        className="recent-actions-timeline__card"
                                        style={{ borderLeftColor: theme.accent }}
                                    >
                                        <header className="recent-actions-timeline__card-header">
                                            <span
                                                className="recent-actions-timeline__pill"
                                                style={{
                                                    backgroundColor: theme.pillBg,
                                                    color: theme.pillColor,
                                                }}
                                            >
                                                {getStatusLabel(entry.estado_bit)}
                                            </span>
                                        </header>

                                        <p className="recent-actions-timeline__detail">{detail}</p>

                                        {entry.nombre_caida ? (
                                            <footer className="recent-actions-timeline__footer">
                                                <span className="recent-actions-timeline__motivo-label">Motivo</span>
                                                <span className="recent-actions-timeline__motivo-value">
                                                    {entry.nombre_caida}
                                                </span>
                                            </footer>
                                        ) : null}
                                    </article>
                                </li>
                            );
                        })}
                    </ol>
                ) : (
                    <div className="recent-actions-timeline__empty">
                        <i className="ph-duotone ph-note-blank" aria-hidden="true" />
                        <p className="mb-0">No hay acciones recientes para este lead.</p>
                    </div>
                )}
            </div>
        )}

        <style>{`
            .recent-actions-timeline {
                text-align: left;
            }

            .recent-actions-timeline__header {
                border-bottom: 1px solid #e2e8f0;
                padding-top: 0.9rem;
                padding-bottom: 0.9rem;
                padding-left: 1.1rem;
                padding-right: 1.1rem;
                text-align: left;
            }

            .recent-actions-timeline__title {
                font-size: 0.98rem;
                font-weight: 600;
                color: #0f172a;
                letter-spacing: -0.01em;
            }

            .recent-actions-timeline__subtitle {
                margin-top: 0.2rem;
                font-size: 0.78rem;
                color: #64748b;
            }

            .recent-actions-timeline__body {
                padding-top: 0.35rem;
                padding-bottom: 0.85rem;
                padding-left: 1.1rem;
                padding-right: 1rem;
            }

            .recent-actions-timeline__loading-text {
                font-size: 0.82rem;
                color: #64748b;
            }

            .recent-actions-timeline__list {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .recent-actions-timeline__item {
                display: grid;
                grid-template-columns: 98px 22px minmax(0, 1fr);
                column-gap: 14px;
                align-items: stretch;
                padding: 0.35rem 0;
            }

            .recent-actions-timeline__time {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                text-align: left;
                padding-left: 0.85rem;
                padding-top: 0.55rem;
            }

            .recent-actions-timeline__clock {
                font-size: 0.76rem;
                font-weight: 600;
                color: #334155;
                line-height: 1.2;
                white-space: nowrap;
            }

            .recent-actions-timeline__date {
                margin-top: 0.15rem;
                font-size: 0.7rem;
                color: #94a3b8;
                line-height: 1.2;
                white-space: nowrap;
            }

            .recent-actions-timeline__rail {
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 100%;
            }

            .recent-actions-timeline__dot {
                width: 9px;
                height: 9px;
                border-radius: 50%;
                margin-top: 0.62rem;
                flex-shrink: 0;
                box-shadow: 0 0 0 3px #fff;
            }

            .recent-actions-timeline__connector {
                width: 1px;
                flex: 1;
                min-height: 1.25rem;
                margin-top: 0.35rem;
                background: linear-gradient(180deg, #cbd5e1 0%, rgba(203, 213, 225, 0.15) 100%);
            }

            .recent-actions-timeline__card {
                background: #fff;
                border: 1px solid #e2e8f0;
                border-left-width: 3px;
                border-radius: 10px;
                padding: 0.7rem 0.85rem;
                margin-bottom: 0.45rem;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
                text-align: left;
            }

            .recent-actions-timeline__card-header {
                margin-bottom: 0.45rem;
                text-align: left;
            }

            .recent-actions-timeline__pill {
                display: inline-flex;
                align-items: center;
                border-radius: 999px;
                padding: 0.2rem 0.55rem;
                font-size: 0.68rem;
                font-weight: 600;
                letter-spacing: 0.01em;
                text-transform: capitalize;
            }

            .recent-actions-timeline__detail {
                margin: 0;
                font-size: 0.83rem;
                line-height: 1.5;
                font-weight: 500;
                color: #1e293b;
                word-break: break-word;
                text-align: left;
            }

            .recent-actions-timeline__footer {
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                justify-content: flex-start;
                gap: 0.35rem;
                margin-top: 0.55rem;
                padding-top: 0.5rem;
                border-top: 1px solid #f1f5f9;
            }

            .recent-actions-timeline__motivo-label {
                font-size: 0.68rem;
                font-weight: 600;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: #94a3b8;
            }

            .recent-actions-timeline__motivo-value {
                font-size: 0.78rem;
                color: #475569;
            }

            .recent-actions-timeline__empty {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0.55rem;
                padding: 0.85rem 0.25rem;
                color: #64748b;
                font-size: 0.84rem;
            }

            .recent-actions-timeline__empty i {
                font-size: 1.1rem;
                color: #94a3b8;
            }

            .recent-actions-timeline__skeleton {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }

            .recent-actions-timeline__skeleton-row {
                display: grid;
                grid-template-columns: 98px 22px 1fr;
                column-gap: 14px;
                align-items: center;
            }

            .recent-actions-timeline__skeleton-time,
            .recent-actions-timeline__skeleton-line,
            .recent-actions-timeline__skeleton-card {
                border-radius: 6px;
                background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
                background-size: 200% 100%;
                animation: recent-actions-shimmer 1.2s ease-in-out infinite;
            }

            .recent-actions-timeline__skeleton-time {
                height: 28px;
            }

            .recent-actions-timeline__skeleton-line {
                width: 9px;
                height: 9px;
                border-radius: 50%;
                justify-self: center;
            }

            .recent-actions-timeline__skeleton-card {
                height: 64px;
            }

            @keyframes recent-actions-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            @media (max-width: 575.98px) {
                .recent-actions-timeline__header {
                    padding-left: 0.85rem;
                    padding-right: 0.85rem;
                }

                .recent-actions-timeline__body {
                    padding-left: 0.85rem;
                    padding-right: 0.75rem;
                }

                .recent-actions-timeline__item {
                    grid-template-columns: 78px 18px minmax(0, 1fr);
                    column-gap: 10px;
                }

                .recent-actions-timeline__card {
                    padding: 0.62rem 0.7rem;
                }
            }
        `}</style>
    </div>
);
