import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand";
import { Notice } from "@/components/ui";

const STEPS = ["Business", "Questions", "Google Ads", "Search Console"];

/** Onboarding layout: logo, 4-step progress, save and exit. */
export function OnboardingShell({
  step,
  eyebrow,
  title,
  intro,
  error,
  children,
  wide = false,
}: {
  step: 1 | 2 | 3 | 4;
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  error?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
          <Logo height={26} />
          <ol className="hidden items-center gap-3 text-sm md:flex" aria-label="Progress">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              const now = n === step;
              return (
                <li key={s} className="flex items-center gap-3">
                  {i > 0 && <span className="h-px w-8 bg-border" aria-hidden />}
                  <span className="flex items-center gap-2" aria-current={now ? "step" : undefined}>
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                        done ? "bg-primary text-primary-foreground" : now ? "border-2 border-primary text-ink" : "border border-input text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="size-3.5" aria-hidden /> : n}
                    </span>
                    <span className={now ? "font-semibold text-ink" : "text-muted-foreground"}>{s}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <Link href="/dashboard" className="text-sm font-medium text-link underline underline-offset-4">Save and exit</Link>
        </div>
      </header>
      <main className={`mx-auto px-4 py-10 sm:px-6 sm:py-14 ${wide ? "max-w-[640px]" : "max-w-[560px]"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow ?? `Step ${step} of 4`}</p>
        <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[40px]">{title}</h1>
        {intro && <div className="mt-2 text-muted-foreground">{intro}</div>}
        {error && <div className="mt-5"><Notice tone="error">{error}</Notice></div>}
        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}

/** A tappable radio / checkbox row in the design's style. */
export function ChoiceRow({ type, name, value, label, defaultChecked }: { type: "radio" | "checkbox"; name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-[15px] has-[:checked]:border-primary has-[:checked]:bg-secondary">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="size-4 accent-[var(--saved)]" />
      {label}
    </label>
  );
}
