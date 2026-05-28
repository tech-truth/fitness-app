import { ClientDetail } from "@/components/client-detail";

type ClientDetailPageProps = {
  params: Promise<{
    trainerClientId: string;
  }>;
};

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { trainerClientId } = await params;

  return <ClientDetail trainerClientId={trainerClientId} />;
}
