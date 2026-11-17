import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/config";

/** Adiro mark: a green "A" on ink (placeholder until a logo is designed). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#171717" stroke="#3a3a3a" />
      <g fill="none" stroke="#40C98A" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 23 16 9l6.5 14M12 18h8" />
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
