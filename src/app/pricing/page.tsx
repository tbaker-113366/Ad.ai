import Link from "next/link";
import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `Pricing · ${PRODUCT_NAME}` };

/** Prices are placeholders for the owner to confirm (spec §11). Checkout arrives in Phase 6. */
// v1 is about cutting wasted spend; automation features arrive later.
const PLANS = [
  { name: "Free", price: "£0", features: ["Waste audit when you connect", "Re-run monthly", "Full list of findings and fixes"] },
  {
    name: "Starter",
    price: "£79",
    features: ["1 ad account", "Weekly waste check", "Alerts when new waste appears", "Negative keyword lists ready to paste"],
  },
  {
    name: "Pro",
    price: "£149",
    features: ["Up to 3 ad accounts", "Everything in Starter", "Waste saved tracked over time", "Priority support"],
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← {PRODUCT_NAME}
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Simple monthly pricing</h1>
        <p className="mt-2 text-slate-600">
          A flat fee — never a percentage of your ad spend. Paid plans start with a 14-day free trial.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <section key={p.name} className="flex flex-col rounded-xl border border-slate-200 p-5">
            <h2 className="font-semibold">{p.name}</h2>
            <p className="mt-2 text-3xl font-bold">
              {p.price}
              <span className="text-base font-normal text-slate-500">/month</span>
            </p>
            <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-slate-700">
              {p.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
        Paid plans aren&apos;t open yet. Your free waste audit is available now. One-click fixes and automation are coming
        later.
      </p>
    </main>
  );
}
