import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business/current";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_NAME } from "@/lib/config";
import { runTestJob } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, business } = await getCurrentBusiness();
  if (!user) redirect("/login");
  if (!business) redirect("/onboarding");

  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("job_runs")
    .select("id, job_name, status, started_at, finished_at, error")
    .eq("business_id", business.id)
    .order("started_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{PRODUCT_NAME}</p>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-slate-600 underline">Sign out</button>
        </form>
      </header>

      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="font-medium">Background jobs</h2>
        <p className="mt-1 text-sm text-slate-600">Run a test job to check the job runner is working.</p>
        <form action={runTestJob} className="mt-4">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Run test job
          </button>
        </form>

        <ul className="mt-5 divide-y divide-slate-100 text-sm">
          {(runs ?? []).length === 0 && <li className="py-2 text-slate-500">No job runs yet.</li>}
          {(runs ?? []).map((run) => (
            <li key={run.id} className="flex justify-between gap-4 py-2">
              <span className="font-mono">{run.job_name}</span>
              <span
                className={
                  run.status === "succeeded"
                    ? "text-green-700"
                    : run.status === "failed"
                      ? "text-red-700"
                      : "text-slate-500"
                }
              >
                {run.status}
              </span>
              <time className="text-slate-500" dateTime={run.started_at}>
                {new Date(run.started_at).toLocaleString("en-GB")}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
