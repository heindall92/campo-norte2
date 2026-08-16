import { describe, expect, it } from "vitest";
import { wmsMode } from "./runtime";

describe("wmsMode", () => {
  it("sin Supabase es demo (tests / build sin .env)", () => {
    expect(wmsMode()).toBe("demo");
  });
});
