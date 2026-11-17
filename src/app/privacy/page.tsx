import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

export const metadata = { title: "Privacy policy · Tally" };

/** Placeholder: the real Privacy policy must be written (and reviewed) before launch. */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-[36px] font-extrabold tracking-[-0.03em]">Privacy policy</h1>
        <p className="mt-4 text-muted-foreground">
          Our full privacy policy is being finalised and will be published here before launch.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>We ask for read-only access to Google Ads and, if you choose, Search Console.</li>
          <li>We use that data only to produce your audits and alerts, and never sell it.</li>
          <li>Disconnect any time: we stop immediately and delete your audit data 30 days later.</li>
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
