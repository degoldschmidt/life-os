import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCronRequest, JOBS } from "@/lib/jobs";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { job: name } = await params;
  const job = JOBS[name];
  if (!job) return NextResponse.json({ error: "unknown job", jobs: Object.keys(JOBS) }, { status: 404 });

  const started = Date.now();
  try {
    const result = await job.run();
    return NextResponse.json({ job: name, ...result, ms: Date.now() - started });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ job: name, ok: false, error: message, ms: Date.now() - started }, { status: 500 });
  }
}

export { handle as GET, handle as POST };
