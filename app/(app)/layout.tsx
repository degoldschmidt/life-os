import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { countInbox } from "@/lib/services/tasks";

// Every screen depends on the session cookie; never prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let inboxCount = 0;
  try {
    inboxCount = await countInbox(user.id);
  } catch {
    // Database unreachable: still render the shell.
  }
  return (
    <AppShell email={user.email} inboxCount={inboxCount}>
      {children}
    </AppShell>
  );
}
