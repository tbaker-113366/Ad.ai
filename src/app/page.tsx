import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/config";

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
      <div>
        <Link
          href="/login"
          className="inline-block rounded-md bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700"
        >
          Connect Google Ads
        </Link>
      </div>
    </main>
  );
}
