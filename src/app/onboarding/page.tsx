import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createBusiness } from "./actions";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { business } = await getCurrentBusiness();
  if (business) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-24">
      <h1 className="text-2xl font-semibold">Tell us about your business</h1>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form action={createBusiness} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Business name
          <input name="name" required maxLength={200} className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Website <span className="text-slate-500">(optional)</span>
          <input name="website" type="url" placeholder="https://" className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Industry <span className="text-slate-500">(optional)</span>
          <input name="industry" placeholder="e.g. plumbing" className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <button className="rounded-md bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-700">Continue</button>
      </form>
    </main>
  );
}
