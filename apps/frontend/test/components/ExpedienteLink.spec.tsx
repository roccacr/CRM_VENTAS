import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { ExpedienteLink } from "../../src/components/ExpedienteLink";
afterEach(cleanup);
it.each(["https://rocca.box.com/s/example", "  https://rocca.box.com/s/example  ", "http://example.com/file"])("links a valid URL: %s", (value) => {
    render(<ExpedienteLink value={value} />);
    const link = screen.getByRole("link", { name: "Ver expediente" });
    expect(link).toHaveAttribute("href", value.trim());
    expect(link).toHaveAttribute("title", value.trim());
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
});
it.each([null, undefined, "", "   "])("handles empty values: %s", (value) => {
    render(<ExpedienteLink value={value} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
});
it.each(["not a URL", "javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//example.com", "https://", "<iframe src='https://example.com' />"])("keeps invalid values as text: %s", (value) => {
    render(<ExpedienteLink value={value} />);
    expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.querySelector("iframe,script")).toBeNull();
});
