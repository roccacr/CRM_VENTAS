/** Agrupa etiquetas repetidas sin perder los IDs nativos o legacy que filtran las órdenes. */
export function followUpProjectOptions(projects: readonly { id: string; name: string }[], selectedIds: readonly string[]) {
    const grouped = new Map<string, { value: string; label: string; ids: string[] }>();
    for (const project of [...projects, ...(selectedIds.includes("unassigned") ? [{ id: "unassigned", name: "Sin proyecto" }] : [])]) {
        const label = project.name.trim().replace(/\s+/g, " ");
        const key = label.toLocaleLowerCase("es");
        const existing = grouped.get(key);
        if (existing) {
            if (!existing.ids.includes(project.id)) existing.ids.push(project.id);
        } else grouped.set(key, { value: project.id, label, ids: [project.id] });
    }
    const options = [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true, sensitivity: "base" }));
    const selected = options.filter((option) => option.ids.some((id) => selectedIds.includes(id))).map((option) => option.value);
    return {
        options,
        selected,
        expand: (values: readonly string[]) => [...new Set(options.filter((option) => values.includes(option.value)).flatMap((option) => option.ids))],
    };
}
