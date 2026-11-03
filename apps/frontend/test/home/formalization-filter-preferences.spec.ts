import { afterEach, expect, it } from "vitest";

import { readFollowUpPreferences, saveFollowUpPreferences } from "../../src/modules/home/formalization-filter-preferences";
afterEach(() => {
    localStorage.clear();
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
