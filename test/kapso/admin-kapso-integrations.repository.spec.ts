// ============================================================================
// IMPORTS
// ============================================================================

import { DataSource, Repository } from "typeorm";

import { AdminKapsoIntegrationEntity } from "../../src/modules/kapso/entities/admin-kapso-integration.entity";
import { AdminKapsoIntegrationsRepository } from "../../src/modules/kapso/repositories/admin-kapso-integrations.repository";

// ============================================================================
// SUITE
// ============================================================================

describe("AdminKapsoIntegrationsRepository", () => {
  const dataSourceMock = {
    query: jest.fn(),
  };

  let repository: AdminKapsoIntegrationsRepository;

  beforeEach(() => {
    jest.clearAllMocks();

    repository = new AdminKapsoIntegrationsRepository(
      dataSourceMock as unknown as DataSource,
      {} as Repository<AdminKapsoIntegrationEntity>,
    );
  });

  it("lista solo adjuntos activos para evitar que reaparezcan archivos retirados", async () => {
    dataSourceMock.query.mockResolvedValue([]);

    await repository.listFlowProjectMedia("flow-uuid", 38, "intro");

    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining("AND media.status = 1"), ["flow-uuid", 38, "intro"]);
  });
});
