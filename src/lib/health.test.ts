import { describe, expect, it } from "vitest";
import { healthStatus } from "./health";

describe("healthStatus", () => {
  it("reports ok", () => {
    expect(healthStatus()).toEqual({ status: "ok" });
  });
});
