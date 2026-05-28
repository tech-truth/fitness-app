import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-700">FitnessOS</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Continue to your trainer or member workspace.</p>
        <div className="mt-6">
          <AuthForm mode="sign-in" />
        </div>
        <p className="mt-5 text-sm text-zinc-600">
          New here?{" "}
          <Link href="/sign-up" className="font-medium text-zinc-950 underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
