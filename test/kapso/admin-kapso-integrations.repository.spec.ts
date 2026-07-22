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
});
