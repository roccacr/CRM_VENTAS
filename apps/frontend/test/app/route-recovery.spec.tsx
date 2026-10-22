import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { RouteErrorBoundary } from "../../src/components/feedback/RouteErrorBoundary";
import { createLazyRoute } from "../../src/routes/LazyRoute";
import { installBrowserApiDoubles } from "../support/browser";

beforeAll(installBrowserApiDoubles);

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("route recovery", () => {
    it("sanitizes rendering errors and retries only on request", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        let broken = true;
        function Page() {
            if (broken) throw new Error("secret SQL stack trace");
            return <h1>Recovered page</h1>;
        }
        render(
            <RouteErrorBoundary>
                <Page />
            </RouteErrorBoundary>,
        );
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudo mostrar esta vista");
        expect(screen.queryByText(/secret SQL/)).not.toBeInTheDocument();
        broken = false;
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(screen.getByRole("heading", { name: "Recovered page" })).toBeInTheDocument();
    });

    it("shows pending work, catches chunk rejection and creates a fresh lazy attempt on retry", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        let rejectLoad!: (reason: Error) => void;
        const loader = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise((_, reject) => {
                        rejectLoad = reject;
                    }),
            )
            .mockResolvedValue({ default: () => <h1>Loaded page</h1> });
        const Page = createLazyRoute(loader);
        render(<Page />);
        expect(screen.getByRole("status", { name: "Cargando vista" })).toBeInTheDocument();
        rejectLoad(new Error("Failed to fetch dynamically imported module: private-host"));
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo mostrar esta vista");
        expect(loader).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(await screen.findByRole("heading", { name: "Loaded page" })).toBeInTheDocument();
        expect(loader).toHaveBeenCalledTimes(2);
    });
});
