export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

/**
 * Reads the public Supabase settings. Throws a clear error when they are
 * missing, instead of failing later with an opaque network error.
 */
export function getSupabaseEnv(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabaseEnv {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !publishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase environment variables: ${missing.join(", ")}. Copy .env.example to .env.local and fill them in.`,
    );
  }
  return { url: url!, publishableKey: publishableKey! };
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
