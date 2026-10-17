import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogBackButton } from "@/routes/_authenticated/nomenclatoare.$kind";

const history = vi.hoisted(() => ({ back: vi.fn(), canGoBack: true }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useRouter: () => ({ history: { back: history.back } }),
  useCanGoBack: () => history.canGoBack,
}));

afterEach(() => {
  cleanup();
  history.back.mockClear();
  history.canGoBack = true;
});

describe("Revenire din nomenclator", () => {
  it("revine în istoricul paginilor, nu către o destinație fixă", () => {
    render(<CatalogBackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Înapoi" }));
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it("nu navighează când nu există o pagină precedentă", () => {
    history.canGoBack = false;
    render(<CatalogBackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Înapoi" }));
    expect(history.back).not.toHaveBeenCalled();
  });
});