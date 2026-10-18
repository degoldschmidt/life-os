import type { Metadata } from "next";
import { Tile } from "@/components/ui/tile";
import { Label, Rule } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { sendMagicLink, startOver, verifyCode } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "not-allowed": "That account isn't allowed here. Life OS is a single-user system.",
  "not-configured": "Supabase isn't configured yet. See docs/SETUP.md.",
  "link-invalid": "That sign-in link is invalid or expired. Request a new one.",
  "rate-limit": "Too many sign-in emails for now. Wait about an hour, or set up custom SMTP in Supabase.",
  "code-format": "Enter the 6-digit code from the email.",
  "code-invalid": "That code is wrong or expired. Check the latest email or start over.",
  "code-expired": "Your sign-in request expired. Enter your email again.",
  "send-failed": "Couldn't send the link. Check the email and try again.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const sent = sp.sent === "1";
  const next = typeof sp.next === "string" ? sp.next : "/today";
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto grid w-full max-w-[920px] flex-1 content-center gap-[14px] p-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <Tile className="flex min-h-[320px] flex-col">
        <div className="flex items-center gap-2 text-[15px] font-medium">
          <i aria-hidden="true" className="block h-[10px] w-[10px] rounded-full border-2 border-text" />
          Life OS
        </div>
        <h1 className="mt-10 text-[56px] font-normal leading-[0.9] tracking-[-0.035em] md:text-[72px]">
          PLAN.
          <br />
          REVIEW.
        </h1>
        <p className="mt-6 flex items-center gap-[10px] text-[15px]">
          <i aria-hidden="true" className="block h-[9px] w-[9px] rounded-full bg-orange" />
          One system for work and life.
        </p>
      </Tile>
      <Tile dark className="flex flex-col">
        <Label>Sign in</Label>
        <Rule dotted className="mt-3" />
        {sent ? (
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-[16px]">Check your email. Tap the link, or enter the code from the email below.</p>
            <form action={verifyCode} className="flex flex-col gap-4">
              <input type="hidden" name="next" value={next} />
              <label className="flex flex-col gap-2">
                <span className="label text-muted">Code</span>
                <input
                  name="code"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,10}"
                  placeholder="123456"
                  className="rounded-[8px] border border-line-dark bg-transparent px-3 py-[10px] text-[20px] tracking-[0.3em] text-on-ink placeholder:text-on-ink-muted"
                />
              </label>
              <Button type="submit" variant="fill" className="!border-on-ink !bg-on-ink !text-ink">
                Sign in
              </Button>
            </form>
            <form action={startOver}>
              <button type="submit" className="label text-muted underline">Use a different email</button>
            </form>
          </div>
        ) : (
          <form action={sendMagicLink} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />
            <label className="flex flex-col gap-2">
              <span className="label text-muted">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className="rounded-[8px] border border-line-dark bg-transparent px-3 py-[10px] text-[15px] text-on-ink placeholder:text-on-ink-muted"
              />
            </label>
            <Button type="submit" variant="fill" className="!border-on-ink !bg-on-ink !text-ink" disabled={!configured}>
              Send magic link
            </Button>
          </form>
        )}
        {error ? <p className="mt-4 text-[13px] text-orange">{error}</p> : null}
        <p className="label mt-auto pt-8 text-muted">Single user · magic link</p>
      </Tile>
    </main>
  );
}
