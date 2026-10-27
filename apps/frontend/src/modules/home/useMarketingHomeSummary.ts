import { useEffect, useRef, useState } from "react";

import { getMarketingHomeSummary, type MarketingApiPeriod, type MarketingApiSummary } from "../../services/marketing/home-summary-service";

/** Only the current user/period may publish results; stale requests and previous-period counters stay hidden. */
export function useMarketingHomeSummary(period: MarketingApiPeriod, userId: string) {
    const key = JSON.stringify([userId, period]);
    const [state, setState] = useState<{ key: string; value: MarketingApiSummary | null; failed: boolean } | null>(null);
    const [activeKey, setActiveKey] = useState(key);
    const [attempt, setAttempt] = useState(0);
    const flight = useRef<{ key: string; pending: Promise<MarketingApiSummary> } | null>(null);
    if (activeKey !== key) {
        setActiveKey(key);
        setState(null);
    }
    useEffect(() => {
        let active = true;
        if (flight.current?.key !== key) flight.current = { key, pending: getMarketingHomeSummary(period) };
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
    }, [key, period, attempt]);
    const current = state?.key === key ? state : null;
    return {
        value: current?.value ?? null,
        failed: current?.failed ?? false,
        retry: () => {
            flight.current = null;
            setState(null);
            setAttempt((value) => value + 1);
        },
    };
}
