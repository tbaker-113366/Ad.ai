import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

/** Shared UI building blocks in the Tally design (shadcn-style API). */

type Variant = "primary" | "outline" | "dark" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  outline: "border border-input bg-card text-ink hover:bg-muted",
  dark: "bg-ink text-white hover:bg-ink-2",
  ghost: "text-ink hover:bg-muted",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-[var(--radius-card)] border border-border bg-card", className)} {...props} />;
}

type Tone = "waste" | "warning" | "neutral" | "saved" | "info";
const tones: Record<Tone, string> = {
  waste: "border-waste-border bg-waste-bg text-waste",
  warning: "border-warning-border bg-warning-bg text-warning",
  neutral: "border-border bg-muted text-muted-foreground",
  saved: "border-saved-border bg-saved-bg text-saved",
  info: "border-info-border bg-info-bg text-info",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground", className)}>{children}</p>;
}

export const inputClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3.5 text-[15px] text-ink placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: Tone | "error"; children: ReactNode }) {
  const t =
    tone === "error"
      ? "border-destructive-border bg-destructive-bg text-destructive"
      : tones[tone as Tone];
  return <div role={tone === "error" ? "alert" : "status"} className={clsx("rounded-lg border px-4 py-3 text-sm", t)}>{children}</div>;
}
