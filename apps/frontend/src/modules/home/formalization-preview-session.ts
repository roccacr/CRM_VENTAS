import { createContext, type Dispatch, type SetStateAction, useContext } from "react";

import type { FormalizationCalendarEvent } from "./formalization-calendar.model";
import type { FormalizationExample } from "./formalization-preview.model";
import type { FormalizationScenario } from "./formalization-scenario.model";

export interface PreviewSession {
    readonly scenarios: Readonly<Record<string, FormalizationScenario>>;
    readonly orders: readonly FormalizationExample[];
    readonly updateScenario: (id: string, scenario: FormalizationScenario) => void;
    readonly events: readonly FormalizationCalendarEvent[];
    readonly setEvents: Dispatch<SetStateAction<readonly FormalizationCalendarEvent[]>>;
    readonly calendarOrderId: string;
    readonly setCalendarOrderId: Dispatch<SetStateAction<string>>;
}
export const PreviewContext = createContext<PreviewSession | null>(null);

/** Comparte el recorrido ficticio; no representa una sesión de autenticación. */
export function useFormalizationPreview(): PreviewSession {
    const session = useContext(PreviewContext);
    if (!session) throw new Error("La maqueta debe estar dentro de FormalizationPreviewBoundary.");
    return session;
}
