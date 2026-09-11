import { KapsoProjectAssignmentService } from "../../src/kapso-integrations/kapso-project-assignment.service";

type RepositoryMock = {
    readonly listProjectOptions: jest.MockedFunction<(search?: string, idnetsuiteAdmin?: number) => Promise<{ readonly idproyectoLead: number; readonly proyectoLead: string | null }[]>>;
};

function createRepository(): RepositoryMock {
    return {
        listProjectOptions: jest.fn(),
    };
}

describe("KapsoProjectAssignmentService", () => {
    it("lists CRM project options", async () => {
        const repository = createRepository();
        repository.listProjectOptions.mockResolvedValue([{ idproyectoLead: 8, proyectoLead: "TerraViva" }]);
        const service = new KapsoProjectAssignmentService(repository);

        await expect(service.listProjectOptions("terra", 653055)).resolves.toEqual([{ idproyectoLead: 8, proyectoLead: "TerraViva" }]);
        expect(repository.listProjectOptions).toHaveBeenCalledWith("terra", 653055);
    });
});
