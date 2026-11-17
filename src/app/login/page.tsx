import { PRODUCT_NAME } from "@/lib/config";
import { signInWithEmail, signInWithGoogle } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; sent?: string }>;
}) {
  const { next = "/dashboard", error, sent } = await searchParams;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-24">
      <h1 className="text-2xl font-semibold">Sign in to {PRODUCT_NAME}</h1>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {sent && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">Check your email for a sign-in link.</p>}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button className="w-full rounded-md bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-700">
          Continue with Google
        </button>
      </form>

      <div className="text-center text-sm text-slate-500">or</div>

      <form action={signInWithEmail} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" required className="rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <button className="rounded-md border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50">
          Email me a sign-in link
        </button>
      </form>
    </main>
  );
}
