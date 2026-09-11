/**
 * Último argumento de la última llamada a un jest.Mock.
 * Centralizado: los specs de repository/service no reimplementan indexing de calls.
 */
export function getLastMockArg(mock: jest.Mock): unknown {
    const calls = mock.mock.calls as readonly (readonly unknown[])[];
    return calls.at(-1)?.[0];
}
