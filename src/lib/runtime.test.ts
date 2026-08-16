import { describe, expect, it } from "vitest";
import { resolveRuntimeMode } from "./runtime";

describe("runtime demo vs production", () => {
  it("por defecto es demo sin infraestructura", () => {
    expect(
      resolveRuntimeMode({
        strictAuth: false,
        allowDemoAuth: true,
        supabaseConfigured: false,
      }),
    ).toBe("demo");
  });

  it("producción explícita o auth estricta cierra la demo", () => {
    expect(
      resolveRuntimeMode({
        explicit: "production",
        strictAuth: false,
        allowDemoAuth: true,
        supabaseConfigured: true,
      }),
    ).toBe("production");
    expect(
      resolveRuntimeMode({
        strictAuth: true,
        allowDemoAuth: true,
        supabaseConfigured: true,
      }),
    ).toBe("production");
  });
});
