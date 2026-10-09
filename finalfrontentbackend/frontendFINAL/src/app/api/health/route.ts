import type { HealthResponse } from "@/types";

export const dynamic = "force-dynamic";

export function GET() {
  const body: HealthResponse = { status: "ok" };
  return Response.json(body);
}
