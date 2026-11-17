import Link from "next/link";
import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui";
import { PRODUCT_NAME } from "@/lib/config";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/audit/sample", label: "Sample audit" },
  { href: "/pricing", label: "Pricing" },
  { href: "/login", label: "Sign in" },
];

/** Marketing header: dark on the homepage hero, light elsewhere. */
export function SiteHeader({ dark = false }: { dark?: boolean }) {
  return (
    <header className={dark ? "border-b border-white/10 bg-ink" : "border-b border-border bg-background"}>
      <div className="mx-auto flex h-16 max-w-[1136px] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo dark={dark} />
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`text-sm font-medium ${dark ? "text-white/90 hover:text-white" : "text-ink hover:text-link"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <LinkButton href="/start" size="sm">
          Get free audit
        </LinkButton>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto flex max-w-[1136px] flex-col gap-4 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-lg font-extrabold text-white">{PRODUCT_NAME.toLowerCase()}</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm">
            <Link href="/pricing" className="underline underline-offset-4 hover:text-white">Pricing</Link>
            <Link href="/audit/sample" className="underline underline-offset-4 hover:text-white">Sample audit</Link>
            <Link href="/privacy" className="underline underline-offset-4 hover:text-white">Privacy</Link>
            <Link href="/terms" className="underline underline-offset-4 hover:text-white">Terms</Link>
          </nav>
        </div>
        <p className="text-xs">The sample audit uses a made-up business. Not affiliated with Google.</p>
      </div>
    </footer>
  );
}
