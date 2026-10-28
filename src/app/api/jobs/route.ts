import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { runJobs } from "@/server/jobs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!cronAuthorized(request.headers.get("authorization"), expected))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runJobs(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Job failed" }, { status: 503 });
  }
}
