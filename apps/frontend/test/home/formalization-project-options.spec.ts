import { expect, it } from "vitest";

import { followUpProjectOptions } from "../../src/modules/home/formalization-project-options";

it("agrupa nombres repetidos y selecciona todos sus IDs sin perder órdenes", () => {
    const projects = [
        { id: "native-a", name: "Amara" },
        { id: "legacy-project:7", name: " Amara " },
        { id: "native-b", name: "AMARA" },
        { id: "legacy-project:8", name: "Andira" },
    ];
    const model = followUpProjectOptions(projects, ["legacy-project:7"]);
    expect(model.options.map(({ label }) => label)).toEqual(["Amara", "Andira"]);
    expect(model.selected).toEqual(["native-a"]);
    expect(model.expand(["native-a"])).toEqual(["native-a", "legacy-project:7", "native-b"]);
    expect(model.expand([])).toEqual([]);
    expect(model.expand(["native-a", "legacy-project:8"])).toEqual(["native-a", "legacy-project:7", "native-b", "legacy-project:8"]);
});

it("no duplica IDs ni mezcla proyectos de nombres diferentes", () => {
    const model = followUpProjectOptions(
        [
            { id: "a", name: "Amara" },
            { id: "a", name: "Amara" },
            { id: "b", name: "Amara Norte" },
        ],
        [],
    );
    expect(model.expand(["a"])).toEqual(["a"]);
    expect(model.options).toHaveLength(2);
});

it("shows the selected unassigned project without expanding to all projects", () => {
    const model = followUpProjectOptions([{ id: "legacy-project:1", name: "BC Lofts" }], ["unassigned"]);
    expect(model.selected).toEqual(["unassigned"]);
    expect(model.expand(["unassigned"])).toEqual(["unassigned"]);
    expect(model.options.find((option) => option.value === "unassigned")?.label).toBe("Sin proyecto");
});
