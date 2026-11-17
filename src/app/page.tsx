import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/config";
import { CHECK_COUNT } from "@/lib/audit";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-24">
      <p className="text-sm font-medium text-slate-500">{PRODUCT_NAME}</p>
      <h1 className="text-4xl font-semibold tracking-tight">
        See how much your Google Ads are wasting — free, in 60 seconds.
      </h1>
      <p className="text-lg text-slate-600">
        Stop wasting ad spend. Get more leads and sales for the same budget. See exactly what changed and why.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/login"
          className="inline-block rounded-md bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700"
        >
          Connect Google Ads
        </Link>
        <Link href="/audit/sample" className="font-medium text-slate-700 underline">
          See a sample audit
        </Link>
      </div>
      <ul className="mt-6 grid gap-4 text-sm text-slate-700 sm:grid-cols-3">
        <li>
          <p className="font-medium text-slate-900">Free 60-second audit</p>
          {CHECK_COUNT} checks find the searches, places, settings and fake clicks wasting your money.
        </li>
        <li>
          <p className="font-medium text-slate-900">A £ figure, not jargon</p>
          See exactly which searches, places, devices and settings are costing you — with the data behind every number.
        </li>
        <li>
          <p className="font-medium text-slate-900">Fixes you can make today</p>
          Plain-English steps and ready-to-paste negative keyword lists. Nothing changes in your account unless you do it.
        </li>
      </ul>
      <p className="text-sm text-slate-500">
        <Link href="/pricing" className="underline">
          Pricing
        </Link>
      </p>
    </main>
  );
}
