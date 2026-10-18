"use client";

import { useEffect, useState, useTransition } from "react";
import { Mono } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on";

/** Turn notifications on or off for this device. On iPhone and iPad it only works from the Home Screen app. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iOS Safari tabs expose none of these; the installed app does.
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
        setState(ios ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") { setState("denied"); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  const enable = () =>
    start(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
        await savePushSubscription(sub.toJSON(), navigator.userAgent);
        setState("on");
        setMessage("Notifications are on for this device.");
      } catch (e) {
        console.error(e);
        setMessage("Couldn't turn notifications on. Is the app installed and reloaded?");
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint).catch(() => undefined); await sub.unsubscribe(); }
      setState("off");
      setMessage("Notifications are off for this device.");
    });

  if (state === "checking") return <Mono className="text-muted">CHECKING THIS DEVICE…</Mono>;
  if (state === "unsupported") return <p className="text-[13px] text-muted">This browser can&apos;t receive push notifications.</p>;
  if (state === "needs-install")
    return <p className="text-[13px] text-muted">On iPhone and iPad, notifications only work from the Home Screen app. Share → Add to Home Screen, open it from there, then come back to this screen.</p>;
  if (state === "denied") return <p className="text-[13px] text-orange">Notifications are blocked for this site. Allow them in your browser or system settings, then reload.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {state === "on" ? (
          <>
            <Button variant="quiet" disabled={pending} onClick={() => start(async () => { const r = await sendTestPush(); setMessage(r.message); })}>Send a test</Button>
            <Button variant="quiet" disabled={pending} onClick={disable}>Turn off here</Button>
          </>
        ) : (
          <Button variant="fill" disabled={pending} onClick={enable}>Turn on for this device</Button>
        )}
        <Mono className="text-muted">{state === "on" ? "ON" : "OFF"}</Mono>
      </div>
      {message ? <p className="mt-3 text-[13px] text-muted">{message}</p> : null}
    </div>
  );
}
