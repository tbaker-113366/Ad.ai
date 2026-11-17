import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/config";

/** Tally mark: a tally (four strokes and a slash) in green on ink. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#171717" stroke="#3a3a3a" />
      <g stroke="#40C98A" strokeWidth="2" strokeLinecap="round">
        <path d="M10 10v12M14 10v12M18 10v12M22 10v12M8 19l16-6" />
      </g>
    </svg>
  );
}

export function Logo({ dark = false, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label={`${PRODUCT_NAME} home`}>
      <LogoMark />
      <span className={`text-xl font-extrabold tracking-tight ${dark ? "text-white" : "text-ink"}`}>{PRODUCT_NAME.toLowerCase()}</span>
    </Link>
  );
}
