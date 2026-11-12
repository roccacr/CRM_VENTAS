import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { type FollowUpFilterRequest, readFollowUpPreferences, saveFollowUpPreferences, selectedQueueFilters, useFollowUpFilters } from "../../src/modules/home/formalization-filter-preferences";
afterEach(() => {
    localStorage.clear();
    cleanup();
});
it("restores several selections for this user and view only", () => {
    saveFollowUpPreferences("a:home", { projectIds: ["legacy-project:7", "legacy-project:8"], selections: ["send", "bank_in_progress"] });
    expect(readFollowUpPreferences("a:home")).toEqual({ projectIds: ["legacy-project:7", "legacy-project:8"], selections: ["send", "bank_in_progress"] });
    expect(readFollowUpPreferences("b:home")).toBeNull();
    expect(readFollowUpPreferences("a:orders")).toBeNull();
});
it("ignores corrupt or unbounded saved preferences", () => {
    localStorage.setItem("crm:follow-up:v1:a", "{");
    expect(readFollowUpPreferences("a")).toBeNull();
    localStorage.setItem("crm:follow-up:v1:a", JSON.stringify({ projectIds: Array(51).fill("x"), selections: [] }));
    expect(readFollowUpPreferences("a")).toBeNull();
});

it("conserva las cuatro bandejas de finiquito junto con los filtros comerciales", () => {
    const selections = ["balance", "finiquito_validation", "finiquito_pending", "finiquito_signed", "finiquito_formalized"] as const;
    saveFollowUpPreferences("a:home", { projectIds: ["legacy-project:7"], selections: [...selections] });
    expect(readFollowUpPreferences("a:home")?.selections).toEqual(selections);
    expect(selectedQueueFilters(selections)).toEqual({ queues: selections, bankStages: [] });
});

it("replaces old projects and selections atomically for a distribution segment", () => {
    const hook = renderHook((request: FollowUpFilterRequest | undefined) => useFollowUpFilters({ scope: { filter: "all" }, tableOnly: false, canViewApprovals: false, allowedQueues: ["all", "send", "finiquito_validation"], filterRequest: request }), { initialProps: undefined as FollowUpFilterRequest | undefined });
    act(() => {
        hook.result.current.setProjects(["legacy-project:99"]);
        hook.result.current.setSelections(["send"]);
    });
    hook.rerender({ selection: "finiquito_validation", projectId: "legacy-project:1", version: 1 });
    expect(hook.result.current.projectIds).toEqual(["legacy-project:1"]);
    expect(hook.result.current.selectedQueues).toEqual(["finiquito_validation"]);
});
it("persists the explicit unassigned filter", () => {
    saveFollowUpPreferences("missing", { projectIds: ["unassigned"], selections: ["finiquito_validation"] });
    expect(readFollowUpPreferences("missing")?.projectIds).toEqual(["unassigned"]);
});
