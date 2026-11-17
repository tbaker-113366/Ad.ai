import { ArrowRight } from "lucide-react";
import { buttonClass } from "@/components/ui";

/** Hero form: the website goes straight into sign-up. */
export function WebsiteForm({ className = "" }: { className?: string }) {
  return (
    <form action="/start" method="get" className={`flex max-w-[600px] flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-2 sm:flex-row ${className}`}>
      <label htmlFor="hero-website" className="sr-only">Your website</label>
      <input
        id="hero-website"
        name="website"
        inputMode="url"
        autoComplete="url"
        placeholder="yourbusiness.co.uk"
        className="h-12 w-full rounded-lg border border-white/10 bg-ink px-4 sm:flex-1 text-white placeholder:text-white/40 focus:border-primary focus:outline-none"
      />
      <button className={buttonClass("primary", "md", "h-12")}>
        Get my free audit <ArrowRight className="size-4" aria-hidden />
      </button>
    </form>
  );
}
