import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseOutlookDescription } from "../../src/modules/calendar/calendar-outlook-detail";
import { OutlookEventPopover } from "../../src/modules/calendar/OutlookEventPopover";
import type { CalendarEvent } from "../../src/services/calendar/calendar-service";

const JOIN = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%22Tid%22%7d";
const body = `.Seguimiento semanal.\n________________\nMicrosoft Teams meeting Join on your computer Click here to join the meeting<${JOIN}> Meeting ID: 245 938 952 817 Passcode: sEGGt7 Download Teams`;
const event = { id: "o1", source: "outlook", originModule: null, typeId: "", typeCode: "", title: "RMP Globe / Mercadeo", description: body, location: "Microsoft Teams Meeting", start: "2026-10-27T13:30:00Z", end: "2026-10-27T14:00:00Z", allDay: false, status: "scheduled", version: 1, canEdit: false, formKey: "outlook.readonly", details: {} } as unknown as CalendarEvent;

afterEach(cleanup);
describe("Outlook description", () => {
    it("separates the human note from the Teams block and extracts the join data", () => {
        expect(parseOutlookDescription(body)).toEqual({ summary: "Seguimiento semanal.", joinUrl: JOIN, meetingId: "245 938 952 817", passcode: "sEGGt7", reference: null });
    });
    it("never trusts a link outside teams.microsoft.com", () => {
        expect(parseOutlookDescription("https://evil.example/l/meetup-join/x Microsoft Teams meeting").joinUrl).toBeNull();
        expect(parseOutlookDescription(null).joinUrl).toBeNull();
    });
});
describe("Outlook event card", () => {
    it("offers expand, close and joining the Teams meeting", () => {
        const onExpand = vi.fn();
        render(<OutlookEventPopover event={event} anchor={null} onClose={vi.fn()} onExpand={onExpand} />);
        expect(screen.getByRole("link", { name: /Unirse a la reunión/ })).toHaveAttribute("href", JOIN);
        fireEvent.click(screen.getByRole("button", { name: "Ver detalle completo" }));
        expect(onExpand).toHaveBeenCalledOnce();
        expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    });
});
