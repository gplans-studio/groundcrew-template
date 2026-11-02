export type HealthStatus = { status: "ok" };

export function healthStatus(): HealthStatus {
  return { status: "ok" };
}
