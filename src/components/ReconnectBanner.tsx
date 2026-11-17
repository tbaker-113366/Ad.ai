import Link from "next/link";

/** Shown when Google access was revoked or expired (spec §9: banner in app). */
export function ReconnectBanner({ emails }: { emails: string[] }) {
  if (emails.length === 0) return null;
  return (
    <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">Reconnect your Google Ads account</p>
      <p className="mt-1">
        We lost access to Google Ads for {emails.join(", ")}, so syncing and the autopilot are paused until you
        reconnect.
      </p>
      {emails.map((email) => (
        <Link
          key={email}
          href={`/api/google/connect?hint=${encodeURIComponent(email)}`}
          className="mt-3 mr-2 inline-block rounded-md bg-amber-900 px-3 py-2 font-medium text-white hover:bg-amber-800"
        >
          Reconnect {email}
        </Link>
      ))}
    </div>
  );
}
