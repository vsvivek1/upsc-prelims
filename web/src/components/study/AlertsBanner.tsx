"use client";
import { useEffect, useState } from "react";
import type { Lang } from "@/engine";
import { t } from "@/lib/i18n";
import { enablePush, pushStatus, type PushStatus } from "@/lib/push";

/** "Alerts off — turn on" line. Hidden when alerts are on or the browser cannot do them. */
export function AlertsBanner({ lang }: { lang: Lang }) {
  const L = t(lang);
  const [status, setStatus] = useState<PushStatus | null>(null);
  useEffect(() => {
    pushStatus().then(setStatus);
  }, []);
  if (!status || status === "on" || status === "unsupported" || status === "unconfigured") return null;
  if (status === "denied") return <p className="text-sm text-muted">{L.alertsBlocked}</p>;
  return (
    <button onClick={async () => setStatus(await enablePush())} className="text-sm font-semibold text-saffron underline">
      🔔 {L.alertsOff}
    </button>
  );
}
