import { healthStatus } from "@/lib/health";

export function GET() {
  return Response.json(healthStatus());
}
