import { DietTemplateBuilder } from "@/components/diet-template-builder";

export default async function EditDietTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;

  return <DietTemplateBuilder templateId={templateId} />;
}
