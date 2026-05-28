import { JoinTrainerCard } from "@/components/join-trainer-card";

type JoinPageProps = {
  params: Promise<{
    inviteCode: string;
  }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { inviteCode } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-5 py-10">
      <JoinTrainerCard inviteCode={inviteCode} />
    </main>
  );
}
