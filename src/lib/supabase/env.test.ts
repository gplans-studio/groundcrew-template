import { describe, expect, it } from "vitest";
import { getSupabaseEnv } from "./env";

describe("getSupabaseEnv", () => {
  it("returns the settings when both are present", () => {
    expect(
      getSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_test",
    });
  });

  it("names every missing variable", () => {
    expect(() => getSupabaseEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});
