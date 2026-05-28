import { OnboardingForm } from "@/components/onboarding-form";
import type { UserRole } from "@/lib/auth/types";

type OnboardingPageProps = {
  searchParams?: Promise<{
    invite?: string;
    role?: UserRole;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const resolvedSearchParams = await searchParams;
  const inviteCode = resolvedSearchParams?.invite;
  const initialRole = resolvedSearchParams?.role === "member" ? "member" : undefined;

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-10">
      <section className="mx-auto max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-700">Profile setup</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Tell us how you will use FitnessOS</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          This creates the core role record that all client, template, and check-in permissions depend on.
        </p>
        <div className="mt-6">
          <OnboardingForm inviteCode={inviteCode} initialRole={initialRole} />
        </div>
      </section>
    </main>
  );
}
