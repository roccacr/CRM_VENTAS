import { bucketMarketingSample, horizonLeads, type MarketingPreviewFilters, type MarketingView, projectsForSeller, relativeChange, summarizeMarketingSample } from "./marketing-home-preview.model";

/** One card per project: leads in the displayed period with their trend, plus the four time horizons. */
export function buildProjectCards(filters: MarketingPreviewFilters, view: MarketingView) {
    return projectsForSeller(filters.seller)
        .map((name) => {
            const leads = summarizeMarketingSample(view.rows.filter((row) => row.project === name)).leads;
            const before = summarizeMarketingSample(view.previousRows.filter((row) => row.project === name)).leads;
            const series = bucketMarketingSample(
                view,
                view.windowRows.filter((row) => row.project === name),
            ).map((bucket) => bucket.leads);
            return { name, leads, change: relativeChange(leads, before), isNew: before === 0 && leads > 0, series, horizons: horizonLeads({ ...filters, project: name }, view.today) };
        })
        .sort((first, second) => second.leads - first.leads || first.name.localeCompare(second.name, "es"));
}

export type ProjectCard = ReturnType<typeof buildProjectCards>[number];
