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
   "01-LEAD-INTERESADO": {
      accent: "#64748b",
      pillBg: "#f1f5f9",
      pillColor: "#475569",
   },
   "02-LEAD-OPORTUNIDAD": {
      accent: "#2563eb",
      pillBg: "#eff6ff",
      pillColor: "#1d4ed8",
   },
   "03-LEAD-PRE-RESERVA": {
      accent: "#0891b2",
      pillBg: "#ecfeff",
      pillColor: "#0e7490",
   },
   "04-LEAD-RESERVA": {
      accent: "#059669",
      pillBg: "#ecfdf5",
      pillColor: "#047857",
   },
   "05-LEAD-CONTRATO": {
      accent: "#334155",
      pillBg: "#f8fafc",
      pillColor: "#1e293b",
   },
   "07-LEAD-PERDIDO": {
      accent: "#dc2626",
      pillBg: "#fef2f2",
      pillColor: "#b91c1c",
   },
   "08-LEAD-SEGUIMIENTO": {
      accent: "#d97706",
      pillBg: "#fffbeb",
      pillColor: "#b45309",
   },
   "09-OPORTUNIDAD-INACTIVA": {
      accent: "#7c3aed",
      pillBg: "#f5f3ff",
      pillColor: "#6d28d9",
   },
   "10-OPORTUNIDAD-REACTIVADA": {
      accent: "#0f766e",
      pillBg: "#f0fdfa",
      pillColor: "#0f766e",
   },
};

const getStatusLabel = (status) => STATUS_LABELS[status] || status || "Sin estado";

const getStatusTheme = (status) =>
   STATUS_THEME[status] || {
      accent: "#475569",
      pillBg: "#f8fafc",
      pillColor: "#334155",
   };

const TimelineSkeleton = () => (
   <div className="recent-actions-timeline__skeleton">
      {[0, 1, 2].map((item) => (
         <div key={item} className="recent-actions-timeline__skeleton-row">
            <div className="recent-actions-timeline__skeleton-time" />
            <div className="recent-actions-timeline__skeleton-line" />
            <div className="recent-actions-timeline__skeleton-card" />
         </div>
      ))}
   </div>
);

export const RecentActions = ({ showPreload, sortedBitacora, formatDate }) => (
   <div className="card latest-activity-card recent-actions-timeline">
      <div className="card-header recent-actions-timeline__header text-start">
         <div className="w-100">
            <h5 className="recent-actions-timeline__title mb-0">
               <i
                  className="ph-duotone ph-clock-counter-clockwise me-2"
                  aria-hidden="true"
               />
               Últimas acciones del lead
            </h5>
            <p className="recent-actions-timeline__subtitle mb-0">
               Historial reciente de movimientos y seguimiento
            </p>
         </div>
      </div>

      {showPreload ? (
         <div className="card-body pt-2 pb-3 text-start">
            <p className="recent-actions-timeline__loading-text mb-3">
               Cargando últimas acciones...
            </p>
            <TimelineSkeleton />
         </div>
      ) : (
         <div className="card-body recent-actions-timeline__body text-start">
            {sortedBitacora.length > 0 ? (
               <ol className="recent-actions-timeline__list mb-0">
                  {sortedBitacora.map((entry, idx) => {
                     const { formattedDate, formattedTime } = formatDate(
                        entry.fecha_creado_bit
                     );
                     const theme = getStatusTheme(entry.estado_bit);
                     const isLast = idx === sortedBitacora.length - 1;
                     const detail =
                        entry.detalle_bit?.trim() || "Sin detalle";

                     return (
                        <li
                           key={`${
                              entry.id_bitacora_bit || idx
                           }-${entry.estado_bit}-${entry.fecha_creado_bit}`}
                           className="recent-actions-timeline__item"
                        >
                           <div
                              className="recent-actions-timeline__time"
                              aria-label={`Hora ${formattedTime}`}
                           >
                              <span className="recent-actions-timeline__clock">
                                 {formattedTime}
                              </span>
                              <span className="recent-actions-timeline__date">
                                 {formattedDate}
                              </span>
                           </div>

                           <div
                              className="recent-actions-timeline__rail"
                              aria-hidden="true"
                           >
                              <span
                                 className="recent-actions-timeline__dot"
                                 style={{
                                    borderColor: theme.accent,
                                    backgroundColor: theme.accent,
                                 }}
                              />
                              {!isLast ? (
                                 <span className="recent-actions-timeline__connector" />
                              ) : null}
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

                              <p className="recent-actions-timeline__detail">
                                 {detail}
                              </p>

                              {entry.motivo_bit ? (
                                 <p className="recent-actions-timeline__reason">
                                    <strong>Motivo</strong> {entry.motivo_bit}
                                 </p>
                              ) : null}
                           </article>
                        </li>
                     );
                  })}
               </ol>
            ) : (
               <div className="recent-actions-timeline__empty">
                  No hay acciones registradas para este lead.
               </div>
            )}
         </div>
      )}

      <style>{`
         .recent-actions-timeline {
            margin: 0 18px 18px;
            border: 1px solid #e5eaf1;
            border-radius: 16px;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
            overflow: hidden;
            text-align: left;
         }

         .recent-actions-timeline__header {
            border-bottom: 1px solid #e2e8f0;
            padding-top: 0.85rem;
            padding-bottom: 0.85rem;
            padding-left: 1rem;
            padding-right: 1rem;
            text-align: left;
            background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
         }

         .recent-actions-timeline__title {
            font-size: 0.95rem;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: -0.01em;
         }

         .recent-actions-timeline__subtitle {
            margin-top: 0.2rem;
            font-size: 0.76rem;
            color: #64748b;
         }

         .recent-actions-timeline__body {
            padding-top: 0.4rem;
            padding-bottom: 0.85rem;
            padding-left: 1rem;
            padding-right: 0.95rem;
            background: #ffffff;
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
            padding-left: 0.65rem;
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
            width: 10px;
            height: 10px;
            border-radius: 999px;
            margin-top: 0.75rem;
            border: 2px solid;
            box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.08);
         }

         .recent-actions-timeline__connector {
            flex: 1;
            width: 1px;
            margin-top: 0.45rem;
            background: linear-gradient(180deg, rgba(148, 163, 184, 0.45) 0%, rgba(226, 232, 240, 0.9) 100%);
         }

         .recent-actions-timeline__card {
            padding: 0.72rem 0.9rem;
            border: 1px solid #e2e8f0;
            border-left-width: 3px;
            border-radius: 12px;
            background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
         }

         .recent-actions-timeline__card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            margin-bottom: 0.55rem;
         }

         .recent-actions-timeline__pill {
            display: inline-flex;
            align-items: center;
            padding: 0.28rem 0.58rem;
            border-radius: 999px;
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.01em;
         }

         .recent-actions-timeline__detail {
            margin: 0;
            font-size: 0.9rem;
            line-height: 1.45;
            color: #1e293b;
         }

         .recent-actions-timeline__reason {
            margin: 0.65rem 0 0;
            padding-top: 0.65rem;
            border-top: 1px solid #e2e8f0;
            font-size: 0.76rem;
            line-height: 1.45;
            color: #475569;
         }

         .recent-actions-timeline__reason strong {
            margin-right: 0.35rem;
            font-size: 0.68rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #94a3b8;
         }

         .recent-actions-timeline__empty {
            padding: 1rem;
            border: 1px dashed #cbd5e1;
            border-radius: 12px;
            font-size: 0.82rem;
            color: #64748b;
            text-align: center;
            background: #fbfdff;
         }

         .recent-actions-timeline__skeleton-row {
            display: grid;
            grid-template-columns: 98px 22px minmax(0, 1fr);
            column-gap: 14px;
            align-items: start;
            padding: 0.35rem 0;
         }

         .recent-actions-timeline__skeleton-time,
         .recent-actions-timeline__skeleton-line,
         .recent-actions-timeline__skeleton-card {
            border-radius: 10px;
            background: linear-gradient(90deg, #e2e8f0 0%, #f8fafc 50%, #e2e8f0 100%);
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
            0% {
               background-position: 200% 0;
            }

            100% {
               background-position: -200% 0;
            }
         }

         @media (max-width: 575.98px) {
            .recent-actions-timeline {
               margin: 0 12px 12px;
               border-radius: 14px;
            }

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
