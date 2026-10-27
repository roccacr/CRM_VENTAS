import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { SellerChip } from "../../src/modules/marketing/SellerAvatar";
afterEach(cleanup);
it("uses only the exact public ID and preserves the illustration when it is missing or broken", () => {
    const view = render(<SellerChip publicId={null} name="Ana Solís" />);
    expect(document.querySelector('img[src*="rocca-marketing-generated.png"]')).not.toBeNull();
    expect(document.querySelector('img[src*="/vendedores/"]')).toBeNull();
    view.rerender(<SellerChip publicId="01M5NC1CME889R260NYS7ASM7C" name="Identidad API" />);
    const photo = screen.getByRole("img", { name: "Foto de Identidad API" });
    expect(photo.getAttribute("src")).toContain("01M5NC1CME889R260NYS7ASM7C");
    fireEvent.error(photo);
    expect(document.querySelector('img[src*="rocca-marketing-generated.png"]')).not.toBeNull();
    view.rerender(<SellerChip publicId="01M5NC1DC90QQK5GG5ETJYC3YT" name="Otra identidad API" />);
    expect(screen.getByRole("img", { name: "Foto de Otra identidad API" }).getAttribute("src")).toContain("01M5NC1DC90QQK5GG5ETJYC3YT");
});
