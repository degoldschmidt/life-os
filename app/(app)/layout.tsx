import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";

// Every screen depends on the session cookie; never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AppShell email={user.email}>{children}</AppShell>;
}
