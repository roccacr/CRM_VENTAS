import { isValidTcpPort, parseTcpPort } from "../../../src/common/net/is-valid-tcp-port";

describe("isValidTcpPort", () => {
    it.each([1, 80, 8002, 65535])("accepts usable port %s", (port) => {
        expect(isValidTcpPort(port)).toBe(true);
    });

    it.each([0, -1, 65536, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects unusable port %s", (port) => {
        expect(isValidTcpPort(port)).toBe(false);
    });
});

describe("parseTcpPort", () => {
    it("parses a valid integer string", () => {
        expect(parseTcpPort("3306")).toBe(3306);
    });

    it.each(["0", "65536", "abc", "80.1", ""])("returns undefined for invalid string %s", (port) => {
        expect(parseTcpPort(port)).toBeUndefined();
    });
});
