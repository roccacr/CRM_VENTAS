import { bucketMarketingSample, horizonLeads, type MarketingPreviewFilters, type MarketingView, projectsForSeller, relativeChange, summarizeMarketingSample } from "./marketing-home-preview.model";

/** Una tarjeta por proyecto: leads del periodo mostrado con su tendencia, más los cuatro horizontes de tiempo. */
export function buildProjectCards(filters: MarketingPreviewFilters, view: MarketingView) {
    return projectsForSeller(filters.sellers ?? filters.seller, view.source)
        .filter((name) => (filters.projects ? filters.projects.length === 0 || filters.projects.includes(name) : !filters.project || name === filters.project))
        .map((name) => {
            const leads = summarizeMarketingSample(view.rows.filter((row) => row.project === name)).leads;
            const before = summarizeMarketingSample(view.previousRows.filter((row) => row.project === name)).leads;
            const series = bucketMarketingSample(
                view,
                view.windowRows.filter((row) => row.project === name),
            ).map((bucket) => bucket.leads);
            return { name, label: view.source.find((row) => row.project === name)?.projectName ?? name, leads, previousLeads: before, change: relativeChange(leads, before), isNew: before === 0 && leads > 0, series, horizons: horizonLeads({ ...filters, project: name, projects: [name] }, view.today, view.source) };
        })
        .sort((first, second) => second.leads - first.leads || first.name.localeCompare(second.name, "es"));
}

export type ProjectCard = ReturnType<typeof buildProjectCards>[number];
