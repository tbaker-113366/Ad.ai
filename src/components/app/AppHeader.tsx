import Link from "next/link";
import { Logo } from "@/components/brand";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/findings", label: "Findings" },
  { href: "/accounts", label: "Accounts" },
  { href: "/settings/profile", label: "Business" },
];

/** Header for signed-in pages. */
export function AppHeader({ businessName }: { businessName?: string }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-[1136px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <nav aria-label="App" className="hidden items-center gap-5 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm font-medium text-muted-foreground hover:text-ink">{n.label}</Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {businessName && <span className="hidden text-muted-foreground sm:inline">{businessName}</span>}
          <form action="/auth/signout" method="post">
            <button className="font-medium text-ink underline underline-offset-4">Sign out</button>
          </form>
        </div>
      </div>
      <nav aria-label="App" className="flex gap-5 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 text-sm font-medium text-muted-foreground">{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}
