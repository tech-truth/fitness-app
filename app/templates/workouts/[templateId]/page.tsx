import { WorkoutTemplateBuilder } from "@/components/workout-template-builder";

export default async function EditWorkoutTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;

  return <WorkoutTemplateBuilder templateId={templateId} />;
}
