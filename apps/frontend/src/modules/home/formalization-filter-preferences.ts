import { useEffect, useMemo, useState } from "react";

import { FOLLOW_UP_QUEUES, type FollowUpQueue } from "../../services/formalization/follow-up-service";
import type { PreviewQueue } from "./formalization-preview.model";
import { canReadOrderAddendum } from "./order-addendum-permissions";
export type FollowUpSelection = Exclude<FollowUpQueue, "all"> | "bank_not_started" | "bank_in_progress";
export interface FollowUpFilterRequest {
    readonly selection: FollowUpSelection;
    readonly version: number;
}
export interface FollowUpPreferences {
    projectIds: string[];
    selections: FollowUpSelection[];
}
const prefix = "crm:follow-up:v1:";
/**
 *
 */
export function isFollowUpSelection(value: unknown): value is FollowUpSelection {
    return typeof value === "string" && value !== "all" && [...FOLLOW_UP_QUEUES, "bank_not_started", "bank_in_progress"].includes(value);
}
/** Las preferencias locales guardan solo ids de filtro. No conceden acceso a una orden. */
function validProjects(value: unknown): value is string[] {
    return Array.isArray(value) && value.length <= 50 && value.every((id: unknown) => typeof id === "string" && /^(?:[0-9A-HJKMNP-TV-Z]{26}|legacy-project:[1-9][0-9]{0,19})$/.test(id));
}
function validSelections(value: unknown): value is FollowUpSelection[] {
    return Array.isArray(value) && value.length <= 14 && value.every(isFollowUpSelection);
}
function parsePreferences(value: unknown): FollowUpPreferences | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const projects: unknown = Reflect.get(value, "projectIds"),
        selections: unknown = Reflect.get(value, "selections");
    if (!validProjects(projects) || !validSelections(selections)) return null;
    return { projectIds: [...new Set(projects)], selections: [...new Set(selections)] };
}
/**
 *
 */
export function readFollowUpPreferences(key: string | undefined): FollowUpPreferences | null {
    if (!key) return null;
    try {
        return parsePreferences(JSON.parse(localStorage.getItem(prefix + key) ?? "null"));
    } catch {
        return null;
    }
}
/**
 *
 */
export function saveFollowUpPreferences(key: string | undefined, value: FollowUpPreferences): void {
    if (!key) return;
    try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
    } catch {
        /* Un almacenamiento privado o bloqueado no impide filtrar. */
    }
}
/**
 *
 */
export function selectedQueueFilters(selections: readonly FollowUpSelection[]) {
    const queues = [...new Set(selections.map((value) => (value.startsWith("bank_") ? "bank" : value)))] as Exclude<FollowUpQueue, "all">[];
    const bankStages = selections.includes("bank") ? [] : selections.filter((value) => value.startsWith("bank_")).map((value) => (value === "bank_not_started" ? ("bank_management" as const) : ("bank_management_in_progress" as const)));
    return { queues, bankStages };
}

interface FilterOptions {
    readonly filterRequest?: FollowUpFilterRequest | undefined;
    readonly scope: PreviewQueue;
    readonly tableOnly: boolean;
    readonly canViewApprovals: boolean;
    readonly filterStorageKey?: string | undefined;
    readonly allowedQueues?: readonly FollowUpQueue[] | undefined;
    readonly stagePermissions?: readonly { code: string; effect: string }[] | undefined;
}
function initialPreferences(key: string | undefined, scope: PreviewQueue): FollowUpPreferences {
    return readFollowUpPreferences(key) ?? { projectIds: scope.project ? [scope.project] : [], selections: scope.filter === "all" ? [] : [scope.filter] };
}
/** El estado del filtro lo comparten las dos superficies de lista. El almacenamiento queda en el usuario y la vista actuales. */
export function useFollowUpFilters({ scope, tableOnly, canViewApprovals, filterStorageKey, allowedQueues, stagePermissions, filterRequest }: FilterOptions) {
    const surface = tableOnly ? "orders" : "home";
    const storageKey = filterStorageKey ? `${filterStorageKey}:${surface}:${scope.filter}:${scope.project ?? ""}` : undefined;
    const [initial] = useState(() => initialPreferences(storageKey, scope));
    const [projectIds, setProjects] = useState(initial.projectIds);
    const [storedSelections, setSelections] = useState(initial.selections);
    const queues = useMemo(() => {
        const available = allowedQueues ?? FOLLOW_UP_QUEUES.filter((value) => canViewApprovals || value !== "approvals");
        return available.filter((value) => value !== "addendum" || canReadOrderAddendum(stagePermissions));
    }, [allowedQueues, canViewApprovals, stagePermissions]);
    const selectedSelections = useMemo(() => storedSelections.filter((value) => queues.includes(value.startsWith("bank_") ? "bank" : (value as FollowUpQueue))), [storedSelections, queues]);
    const [appliedRequest, setAppliedRequest] = useState<FollowUpFilterRequest>();
    if (filterRequest !== appliedRequest) {
        setAppliedRequest(filterRequest);
        if (filterRequest && queues.includes(filterRequest.selection.startsWith("bank_") ? "bank" : (filterRequest.selection as FollowUpQueue))) setSelections((current) => (current.includes(filterRequest.selection) ? current : [...current, filterRequest.selection]));
    }
    const filters = useMemo(() => selectedQueueFilters(selectedSelections), [selectedSelections]);
    useEffect(() => {
        saveFollowUpPreferences(storageKey, { projectIds, selections: selectedSelections });
    }, [storageKey, projectIds, selectedSelections]);
    return { projectIds, setProjects, selectedSelections, setSelections, queues, selectedQueues: filters.queues, bankStages: filters.bankStages };
}
