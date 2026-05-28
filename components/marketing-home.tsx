import Link from "next/link";

export function MarketingHome() {
  return (
    <main className="min-h-screen bg-stone-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase text-emerald-700">FitnessOS MVP</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
            Client operations for personal trainers.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
            Manage clients, reusable workout templates, meal plans, weekly check-ins, progress photos, and AI-assisted
            reviews from one structured workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Start as trainer
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ["Template-first", "Reuse workout and diet structures instead of recreating plans for every client."],
            ["Weekly review", "Track weight, measurements, photos, adherence, and trainer notes in one cycle."],
            ["AI-assisted", "Use NVIDIA NIM for draft plans and progress summaries while trainers stay in control."],
          ].map(([title, detail]) => (
            <article key={title} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
