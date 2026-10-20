import { type ReactNode, useContext, useState } from "react";

import { calendarDateKey, type FormalizationCalendarEvent, initialCalendarEvents } from "./formalization-calendar.model";
import { FORMALIZATION_EXAMPLES } from "./formalization-preview.model";
import { PreviewContext } from "./formalization-preview-session";
import { createScenario, type FormalizationScenario, scenarioOrder } from "./formalization-scenario.model";

function PreviewProvider({ children }: { readonly children: ReactNode }) {
    const [scenarios, setScenarios] = useState<Readonly<Record<string, FormalizationScenario>>>(() => Object.fromEntries(FORMALIZATION_EXAMPLES.map((order) => [order.id, createScenario(order)])));
    const [events, setEvents] = useState<readonly FormalizationCalendarEvent[]>(() => initialCalendarEvents(calendarDateKey(new Date())));
    const [calendarOrderId, setCalendarOrderId] = useState("all");
    const orders = FORMALIZATION_EXAMPLES.map((order) => scenarioOrder(order, scenarios[order.id] ?? createScenario(order)));
    return (
        <PreviewContext.Provider
            value={{
                scenarios,
                orders,
                events,
                setEvents,
                calendarOrderId,
                setCalendarOrderId,
                updateScenario: (id, scenario) => {
                    setScenarios((current) => ({ ...current, [id]: scenario }));
                },
            }}
        >
            {children}
        </PreviewContext.Provider>
    );
}

/** Una sesión visual en memoria por usuario y módulo. Recargar/cerrar sesión la descarta. */
export function FormalizationPreviewBoundary({ children }: { readonly children: ReactNode }) {
    const existing = useContext(PreviewContext);
    return existing ? children : <PreviewProvider>{children}</PreviewProvider>;
}
