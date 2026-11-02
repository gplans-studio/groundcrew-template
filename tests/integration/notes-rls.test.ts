/**
 * Proves the default security posture against a real local Supabase:
 * row level security blocks anonymous access and isolates users.
 *
 * Requires a running local stack (`npm run db:start`) and its settings in the
 * environment: API_URL plus PUBLISHABLE_KEY (or ANON_KEY) and SECRET_KEY (or
 * SERVICE_ROLE_KEY), as printed by `npx supabase status -o env`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `Missing ${names.join(" or ")}. Start Supabase with \`npm run db:start\` and export \`npx supabase status -o env\`.`,
  );
}

const url = requireEnv("API_URL");
const publishableKey = requireEnv("PUBLISHABLE_KEY", "ANON_KEY");
const secretKey = requireEnv("SECRET_KEY", "SERVICE_ROLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, noSession);
const password = "integration-test-password";
const runId = Date.now();
const userIds: string[] = [];

async function createUser(label: string) {
  const email = `${label}-${runId}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  userIds.push(data.user.id);
  return { id: data.user.id, email };
}

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(url, publishableKey, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe("notes row level security", () => {
  let alice: { id: string; email: string };
  let bob: { id: string; email: string };

  beforeAll(async () => {
    alice = await createUser("alice");
    bob = await createUser("bob");
    const { error } = await admin
      .from("notes")
      .insert({ user_id: alice.id, content: "alice's private note" });
    if (error) throw error;
  });

  afterAll(async () => {
    for (const id of userIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("returns no rows to an anonymous client", async () => {
    const anon = createClient(url, publishableKey, noSession);
    const { data, error } = await anon.from("notes").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rejects inserts from an anonymous client", async () => {
    const anon = createClient(url, publishableKey, noSession);
    const { error } = await anon
      .from("notes")
      .insert({ user_id: alice.id, content: "anonymous write" });
    expect(error).not.toBeNull();
  });

  it("lets a user read only their own notes", async () => {
    const asAlice = await signedInClient(alice.email);
    const { data, error } = await asAlice.from("notes").select("content");
    expect(error).toBeNull();
    expect(data).toEqual([{ content: "alice's private note" }]);

    const asBob = await signedInClient(bob.email);
    const bobView = await asBob.from("notes").select("*");
    expect(bobView.error).toBeNull();
    expect(bobView.data).toEqual([]);
  });

  it("rejects writing a note on behalf of another user", async () => {
    const asBob = await signedInClient(bob.email);
    const { error } = await asBob
      .from("notes")
      .insert({ user_id: alice.id, content: "forged note" });
    expect(error).not.toBeNull();
  });
});
