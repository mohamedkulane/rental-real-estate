import { ConstructionDetail } from '@/features/construction/construction-detail';

export default async function ConstructionProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConstructionDetail projectId={id} />;
}
