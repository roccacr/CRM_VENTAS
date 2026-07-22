// ============================================================================
// IMPORTS
// ============================================================================

import { DataSource } from "typeorm";

import { KapsoFlowProjectMediaRepository } from "../../src/modules/kapso/repositories/kapso-flow-project-media.repository";

// ============================================================================
// SUITE
// ============================================================================

describe("KapsoFlowProjectMediaRepository", () => {
  const dataSourceMock = {
    query: jest.fn(),
  };

  let repository: KapsoFlowProjectMediaRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    repository = new KapsoFlowProjectMediaRepository(dataSourceMock as unknown as DataSource);
  });

  it("lista solo adjuntos activos para evitar que reaparezcan archivos retirados", async () => {
    dataSourceMock.query.mockResolvedValue([]);

    await repository.listFlowProjectMedia("flow-uuid", 38, "intro");

    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining("AND media.status = 1"), ["flow-uuid", 38, "intro"]);
  });

  it("prefiere la asociacion activa mas reciente cuando existen filas duplicadas del proyecto", async () => {
    dataSourceMock.query.mockResolvedValue([{ id: 7, enabled: 1 }]);

    const result = await repository.findBusinessFlowProject("flow-uuid", 38);

    expect(result).toMatchObject({ id: 7, enabled: 1 });
    expect(dataSourceMock.query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY project.enabled DESC, project.id_kapso_business_flow_project DESC"),
      ["flow-uuid", 38],
    );
  });

  it("elimina la asociacion flow-proyecto en vez de solo marcarla inactiva", async () => {
    dataSourceMock.query
      .mockResolvedValueOnce([
        {
          idProyecto: 38,
          idProNetsuite: 38,
          nombreProyecto: "Andira",
          status: 1,
        },
      ])
      .mockResolvedValueOnce({ affectedRows: 2 });

    const result = await repository.deleteBusinessFlowProject("flow-uuid", 38);

    expect(result).toEqual({
      ok: true,
      flowUuid: "flow-uuid",
      idProyecto: 38,
      idProyectoNetsuite: 38,
      deletedProjects: 2,
    });
    expect(dataSourceMock.query).toHaveBeenLastCalledWith(expect.stringContaining("DELETE FROM kapso_business_flow_projects"), [
      "flow-uuid",
      38,
    ]);
  });

  it("elimina metadata de adjuntos por flujo y proyecto", async () => {
    dataSourceMock.query.mockResolvedValue({ affectedRows: 4 });

    const result = await repository.deleteFlowProjectMediaForProject("flow-uuid", 38);

    expect(result).toEqual({
      flowUuid: "flow-uuid",
      idProyectoNetsuite: 38,
      deletedMedia: 4,
    });
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM kapso_flow_project_media"), ["flow-uuid", 38]);
  });
});
