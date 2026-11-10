import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useNetsuiteOrderConsole } from "../../src/modules/home/useNetsuiteOrderConsole";
import { ApiClientError, apiRequest } from "../../src/services/api/api-client";
import { getDatabaseOrder } from "../../src/services/formalization/database-order-service";
import { getNetsuiteOrder, type NetsuiteOrderIdentity } from "../../src/services/formalization/netsuite-order-service";

vi.mock("../../src/services/formalization/database-order-service", () => ({ getDatabaseOrder: vi.fn().mockResolvedValue({ schemaVersion: 1, source: "legacy", order: { id: "legacy:208" } }) }));
vi.mock("../../src/services/api/api-client", async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), apiRequest: vi.fn() }));
const result = { schemaVersion: 1, order: { source: "legacy", id: "legacy:208", netsuiteId: "123" }, data: { status: 200, data: { id: "123", type: "salesorder", fields: { initialtranid: "RDR673" } } } };
function Harness({ record = null, enabled = true, refreshVersion = 0 }: { record?: NetsuiteOrderIdentity | null; enabled?: boolean; refreshVersion?: number }) {
    const read = useNetsuiteOrderConsole(record, enabled, refreshVersion);
    return (
        <div>
            Sin campos nuevos<output>{read.status}</output>
            <span data-testid="provider-order">{read.primary?.fields["N.º de pedido"]}</span>
            <span data-testid="load-error">{read.errorMessage}</span>
        </div>
    );
}
beforeEach(() => {
    window.history.replaceState({}, "", "/home/formalization");
    vi.stubEnv("DEV", true);
    vi.mocked(apiRequest).mockReset().mockResolvedValue(result);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});
it("distinguishes a confirmed missing provider order from a temporary connection failure", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("missing", 404, { code: "NETSUITE_SALES_ORDER_NOT_FOUND", message: "private" }));
    render(<Harness record={{ source: "legacy", id: "208" }} />);
    await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe("error");
    });
    expect(screen.getByTestId("load-error").textContent).toBe("La orden de venta no existe en NetSuite en el entorno configurado.");
    expect(screen.getByTestId("provider-order").textContent).toBe("");
});
it("logs once under StrictMode and adds Habita identity and resolved NetSuite reference to URL only", async () => {
    render(
        <StrictMode>
            <Harness record={{ source: "legacy", id: "legacy:208" }} />
        </StrictMode>,
    );
    await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith("[NetSuite: orden de venta]", result);
        expect(vi.mocked(console.log).mock.calls.filter(([label]) => label === "[NetSuite: orden de venta]")).toHaveLength(1);
    });
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/orders/legacy/208/netsuite");
    const query = new URLSearchParams(window.location.search);
    expect(query.get("orderId")).toBe("208");
    expect(query.get("netsuiteId")).toBe("123");
    expect(screen.queryByRole("textbox")).toBeNull();
});
it("loads from Habita identity on refresh and ignores an untrusted provider ID in URL", async () => {
    window.history.replaceState({}, "", "/home/formalization?orderSource=legacy&orderId=208&netsuiteId=999");
    render(<Harness />);
    await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith("[NetSuite: orden de venta]", result);
    });
    expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/legacy/208/netsuite");
    expect(new URLSearchParams(window.location.search).get("netsuiteId")).toBe("123");
});
it("does not request without permission", () => {
    render(<Harness record={{ source: "legacy", id: "208" }} enabled={false} />);
    expect(apiRequest).not.toHaveBeenCalled();
});
it("loads authorized production data but keeps diagnostic logs DEV only", async () => {
    vi.stubEnv("DEV", false);
    render(<Harness record={{ source: "legacy", id: "208" }} />);
    await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe("success");
    });
    expect(screen.getByTestId("provider-order").textContent).toBe("RDR673");
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(console.log).not.toHaveBeenCalled();
});
it("rejects invalid identities before invoking the API", async () => {
    await expect(getNetsuiteOrder({ source: "legacy", id: "../1" })).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
});
it("does not display or persist failure details", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("private upstream detail"));
    render(<Harness record={{ source: "legacy", id: "208" }} />);
    await waitFor(() => {
        expect(console.error).toHaveBeenCalledOnce();
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private");
    expect(screen.getByText("Sin campos nuevos", { exact: false })).toBeInTheDocument();
});

it("exposes loading until the request resolves", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiRequest).mockReturnValue(
        new Promise((done) => {
            resolve = done;
        }),
    );
    render(<Harness record={{ source: "legacy", id: "208" }} />);
    expect(screen.getByRole("status").textContent).toBe("loading");
    resolve(result);
    await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe("success");
    });
});

it("reloads the same transaction and returns to loading without navigating", async () => {
    const record: NetsuiteOrderIdentity = { source: "legacy", id: "208" };
    const view = render(<Harness record={record} />);
    await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe("success");
    });
    let resolve!: (value: unknown) => void;
    vi.mocked(apiRequest).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    view.rerender(<Harness record={record} refreshVersion={1} />);
    expect(screen.getByRole("status").textContent).toBe("loading");
    expect(window.location.pathname).toBe("/home/formalization");
    expect(screen.getByTestId("provider-order").textContent).toBe("");
    expect(apiRequest).toHaveBeenCalledTimes(2);
    resolve(result);
    await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe("success");
    });
    expect(new URLSearchParams(window.location.search).get("orderId")).toBe("208");
});

it("logs the database snapshot even when NetSuite fails", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("provider down"));
    render(<Harness record={{ source: "legacy", id: "208" }} />);
    await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith("[Base de datos: orden de venta]", expect.objectContaining({ source: "legacy" }));
    });
    await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe("error");
    });
});
it("logs NetSuite independently if the database endpoint fails", async () => {
    vi.mocked(getDatabaseOrder).mockRejectedValueOnce(new Error("db read failed"));
    render(<Harness record={{ source: "legacy", id: "208" }} />);
    await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith("[NetSuite: orden de venta]", result);
    });
    await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe("error");
    });
    expect(vi.mocked(console.log).mock.calls.some(([label]) => label === "[Base de datos: orden de venta]")).toBe(false);
});
