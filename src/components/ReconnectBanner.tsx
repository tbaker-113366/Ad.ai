import Link from "next/link";

/** Shown when Google access was revoked or expired (spec §9: banner in app). */
export function ReconnectBanner({ emails }: { emails: string[] }) {
  if (emails.length === 0) return null;
  return (
    <div role="alert" className="rounded-lg border border-warning-border bg-warning-bg p-4 text-sm text-warning">
      <p className="font-medium">Reconnect your Google Ads account</p>
      <p className="mt-1">
        We lost access to Google Ads for {emails.join(", ")}, so syncing and the autopilot are paused until you
        reconnect.
      </p>
      {emails.map((email) => (
        <Link
          key={email}
          href={`/api/google/connect?kind=ads&next=/dashboard&hint=${encodeURIComponent(email)}`}
          className="mt-3 mr-2 inline-block rounded-md bg-ink px-3 py-2 font-semibold text-white hover:bg-ink-2"
        >
          Reconnect {email}
        </Link>
      ))}
    </div>
  );
}
