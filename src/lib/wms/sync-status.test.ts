import { describe, expect, it } from "vitest";
import {
  clearWmsSyncError,
  peekWmsSyncError,
  publishWmsSyncError,
  subscribeWmsSyncError,
  wmsSyncMessage,
} from "./sync-status";

describe("wms sync status", () => {
  it("extrae el mensaje del Error y notifica a los listeners", () => {
    clearWmsSyncError();
    const seen: Array<string | null> = [];
    const stop = subscribeWmsSyncError((n) => seen.push(n?.message ?? null));
    publishWmsSyncError("save", new Error("wms_forbidden_org"));
    expect(wmsSyncMessage(new Error("  boom  "))).toBe("boom");
    expect(peekWmsSyncError()?.kind).toBe("save");
    expect(peekWmsSyncError()?.message).toBe("wms_forbidden_org");
    clearWmsSyncError();
    expect(peekWmsSyncError()).toBeNull();
    stop();
    expect(seen).toEqual([null, "wms_forbidden_org", null]);
  });
});
