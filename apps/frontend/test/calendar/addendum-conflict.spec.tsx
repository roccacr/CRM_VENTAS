import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAddendumConflict } from "../../src/modules/calendar/useAddendumConflict";
import { useCalendarEventForm } from "../../src/modules/calendar/useCalendarEventForm";
import { ApiClientError, apiRequest } from "../../src/services/api/api-client";
import type { CalendarDescriptor, CalendarEvent, CalendarLink } from "../../src/services/calendar/calendar-service";

vi.mock("../../src/services/api/api-client", () => ({
    ApiClientError: class extends Error {
        constructor(
            message: string,
            readonly status: number,
            readonly responseBody: unknown,
        ) {
            super(message);
        }
    },
    apiRequest: vi.fn(),
}));
const links: CalendarLink[] = [
    { entityType: "lead", source: "legacy", id: "20519" },
    { entityType: "sales_order", source: "legacy", id: "78" },
];
const clear = { schemaVersion: 1, source: "legacy", id: "78", blocked: false, existing: null };
const existing = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", start: "2027-01-15T15:00:00Z" };
beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(apiRequest).mockResolvedValue(clear);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.resetAllMocks();
});
async function check() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
    });
}

it("blocks saving while checking the full future window and excludes the edited event", async () => {
    const { result } = renderHook(() => useAddendumConflict(true, links, existing.id));
    expect(result.current.checking).toBe(true);
    expect(result.current.blocked).toBe(true);
    await check();
    expect(result.current.blocked).toBe(false);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith(`/formalization/orders/addendum/future?source=legacy&id=78&excludeEventId=${existing.id}`);
});
it.each([existing, null])("blocks an existing future Adéndum, including a restricted event", async (reference) => {
    vi.mocked(apiRequest).mockResolvedValue({ ...clear, blocked: true, existing: reference });
    const { result } = renderHook(() => useAddendumConflict(true, links));
    await check();
    expect(result.current.blocked).toBe(true);
    expect(result.current.message).toContain("Ya existe un Adéndum futuro para esta orden");
    expect(result.current.message).not.toContain("undefined");
    if (reference) expect(result.current.message).toContain("2027");
});
it.each([false, true])("does not query another module or an invalid order selection (enabled=%s)", async (enabled) => {
    const selection = enabled ? [...links, { entityType: "sales_order" as const, source: "legacy" as const, id: "79" }] : links;
    const { result } = renderHook(() => useAddendumConflict(enabled, selection));
    await check();
    expect(apiRequest).not.toHaveBeenCalled();
    expect(result.current.blocked).toBe(false);
});
it("fails closed without exposing errors, and explicitly retries the same selection", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("private provider error"));
    const { result } = renderHook(() => useAddendumConflict(true, links));
    await check();
    expect(result.current.failed).toBe(true);
    expect(result.current.blocked).toBe(true);
    expect(result.current.message).not.toContain("private");
    act(() => {
        result.current.retry();
    });
    expect(result.current.checking).toBe(true);
    await check();
    expect(result.current.blocked).toBe(false);
    expect(apiRequest).toHaveBeenCalledTimes(2);
});
it("ignores a late conflict for the previous order and avoids repeated queries for the same identity", async () => {
    let resolve: (value: unknown) => void = () => {};
    vi.mocked(apiRequest).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const { result, rerender } = renderHook(({ selected }) => useAddendumConflict(true, selected), { initialProps: { selected: links } });
    await check();
    const other = links.map((link) => (link.entityType === "sales_order" ? { ...link, id: "79" } : link));
    vi.mocked(apiRequest).mockResolvedValueOnce({ ...clear, id: "79" });
    rerender({ selected: other });
    await check();
    await act(async () => {
        resolve({ ...clear, blocked: true, existing });
        await Promise.resolve();
    });
    expect(result.current.blocked).toBe(false);
    rerender({ selected: [...other] });
    await check();
    expect(apiRequest).toHaveBeenCalledTimes(2);
});
it("checks again before enabling save when Adéndum is selected again for the same order", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useAddendumConflict(enabled, links), { initialProps: { enabled: true } });
    await check();
    expect(result.current.blocked).toBe(false);
    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(result.current.checking).toBe(true);
    expect(result.current.blocked).toBe(true);
    await check();
    expect(apiRequest).toHaveBeenCalledTimes(2);
});
it("shows the atomic backend conflict if another event is created after the preflight", async () => {
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path === "/calendar/events") return Promise.reject(new ApiClientError("private", 409, { code: "EXISTING_FUTURE_ADDENDUM", existing }));
        return Promise.resolve(clear);
    });
    const calendar: CalendarDescriptor = { moduleCode: "formalizacion", label: "Formalización", color: "#000", canCreate: true, canUpdate: true, types: [{ id: "adendum", code: "adendum", label: "Adéndum", color: "#000", formKey: "formalizacion.general.v1" }] };
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-03", { onSaved: vi.fn() }));
    act(() => {
        result.current.change("typeId", "adendum");
        result.current.change("title", "Adéndum");
        result.current.change("description", "Cambio solicitado");
        result.current.change("links", links);
    });
    await check();
    expect(result.current.addendumConflict.blocked).toBe(false);
    await act(async () => {
        await result.current.save();
    });
    expect(result.current.failure?.stale).toBe(true);
    expect(result.current.failure?.message).toContain("Ya existe un Adéndum futuro para esta orden");
    expect(result.current.failure?.message).toContain("2027");
    expect(result.current.failure?.message).not.toContain("private");
});

it.each(["", "  ", "ab", "a".repeat(2001)])("requires a reason for new calendar addendum", async (description) => {
    const calendar: CalendarDescriptor = { moduleCode: "formalizacion", label: "Formalización", color: "#000", canCreate: true, canUpdate: true, types: [{ id: "adendum", code: "adendum", label: "Adéndum", color: "#000", formKey: "formalizacion.general.v1" }] };
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-03", { onSaved: vi.fn() }));
    act(() => {
        result.current.change("typeId", "adendum");
        result.current.change("title", "Adéndum");
        result.current.change("description", "Cambio solicitado");
        result.current.change("links", links);
        result.current.change("description", description);
    });
    await check();
    await act(async () => {
        await result.current.save();
    });
    expect(result.current.failure?.message).toContain("motivo");
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path === "/calendar/events")).toBe(false);
});

it.each(["adendum", "tarea"])("preserves ordinary editing and requires reason on conversion from %s", async (typeCode) => {
    const calendar: CalendarDescriptor = { moduleCode: "formalizacion", label: "Formalizacion", color: "#000", canCreate: true, canUpdate: true, types: [{ id: "adendum", code: "adendum", label: "Adendum", color: "#000", formKey: "formalizacion.general.v1" }] };
    const event: CalendarEvent = { id: existing.id, source: "native", originModule: "formalizacion", typeId: typeCode, typeCode, title: "Adendum", description: null, location: null, start: "2026-11-03T15:00:00Z", end: "2026-11-03T16:00:00Z", allDay: false, status: "scheduled", version: 3, canEdit: true, formKey: "formalizacion.general.v1", details: {}, links };
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path.startsWith("/calendar/events/") ? { schemaVersion: 1, event: { ...event, typeId: "adendum", typeCode: "adendum" } } : clear));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useCalendarEventForm(event, calendar, "2026-11-03", { onSaved }));
    act(() => {
        result.current.change("typeId", "adendum");
    });
    await check();
    await act(async () => {
        await result.current.save();
    });
    if (typeCode === "adendum") {
        expect(onSaved).toHaveBeenCalledOnce();
        expect(result.current.requiresAddendumReason).toBe(false);
    } else {
        expect(onSaved).not.toHaveBeenCalled();
        expect(result.current.failure?.message).toContain("motivo");
    }
});
