import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportData } from "@/lib/services/export";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await exportData(user.id);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="life-os-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
