import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { getCurrentUser } from "@/lib/auth";
import { buildVault, exportData } from "@/lib/services/export";
import { getSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await getSettings();
  const data = await exportData(user.id);
  const zip = zipSync(buildVault(data, settings.tz));
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="life-os-vault-${day}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
