import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

type SignUpPageProps = {
  searchParams?: Promise<{
    invite?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolvedSearchParams = await searchParams;
  const inviteCode = resolvedSearchParams?.invite;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-700">FitnessOS</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Start with email auth, then complete your profile role.
          {inviteCode ? " Your trainer invite will be applied during onboarding." : ""}
        </p>
        <div className="mt-6">
          <AuthForm mode="sign-up" inviteCode={inviteCode} />
        </div>
        <p className="mt-5 text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-zinc-950 underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
