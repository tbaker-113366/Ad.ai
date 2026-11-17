import Image from "next/image";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/config";

/**
 * Adiro logo (designer's files in /public/brand): three bars getting
 * shorter, the last one green — waste being cut.
 */
export function LogoMark({ size = 28, white = false }: { size?: number; white?: boolean }) {
  return (
    <Image
      src={white ? "/brand/adiro-mark-white.svg" : "/brand/adiro-mark.svg"}
      alt=""
      width={Math.round((size * 20) / 18)}
      height={size}
      unoptimized
      priority
    />
  );
}

/** Full wordmark. `dark` = on a dark background (white version). */
export function Logo({ dark = false, href = "/", height = 28 }: { dark?: boolean; href?: string | null; height?: number }) {
  const img = (
    <Image
      src={dark ? "/brand/adiro-logo-white.svg" : "/brand/adiro-logo.svg"}
      alt={PRODUCT_NAME}
      width={Math.round((height * 315) / 79)}
      height={height}
      unoptimized
      priority
    />
  );
  return href === null ? img : <Link href={href} aria-label={`${PRODUCT_NAME} home`} className="inline-flex shrink-0">{img}</Link>;
}
