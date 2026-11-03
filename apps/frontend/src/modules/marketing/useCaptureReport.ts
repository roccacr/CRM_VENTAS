import { useEffect, useRef, useState } from "react";

import { type CaptureApiPeriod, type CaptureApiReport, type CaptureQualification, getCaptureReport } from "../../services/marketing/lead-report-service";

/** Previous identity/period data never paints; only the current live request can publish a result. */
export function useCaptureReport(period: CaptureApiPeriod, userId: string, qualification: CaptureQualification) {
    const [attempt, setAttempt] = useState(0);
    const key = JSON.stringify([userId, period, qualification, attempt]);
    const [activeKey, setActiveKey] = useState(key);
    const [state, setState] = useState<{ readonly key: string; readonly value: CaptureApiReport | null; readonly failed: boolean } | null>(null);
    const flight = useRef<{ readonly key: string; readonly pending: Promise<CaptureApiReport> } | null>(null);
    if (activeKey !== key) {
        setActiveKey(key);
        setState(null);
    }
    useEffect(() => {
        let active = true;
        if (flight.current?.key !== key) flight.current = { key, pending: getCaptureReport(period, qualification) };
        const request = flight.current;
        void request.pending
            .then((value) => {
                if (active) setState({ key, value, failed: false });
            })
            .catch(() => {
                if (active) setState({ key, value: null, failed: true });
            })
            .finally(() => {
                if (flight.current === request) flight.current = null;
            });
        return () => {
            active = false;
        };
    }, [key, period, qualification]);
    const current = state?.key === key ? state : null;
    return {
        value: current?.value ?? null,
        failed: current?.failed ?? false,
        retry: () => {
            setAttempt((value) => value + 1);
        },
    };
}
