import { runDatabaseCheck } from '../src/database/database-check';

describe('runDatabaseCheck', () => {
  it('returns table readability and row count', async () => {
    const repository = {
      count: jest.fn().mockResolvedValue(3),
    };

    await expect(runDatabaseCheck(repository)).resolves.toEqual({
      canReadTable: true,
      integrationCount: 3,
    });
  });

  it('fails closed when the repository cannot read the table', async () => {
    const repository = {
      count: jest.fn().mockRejectedValue(new Error('connection failed')),
    };

    await expect(runDatabaseCheck(repository)).resolves.toEqual({
      canReadTable: false,
      integrationCount: null,
    });
  });
});
