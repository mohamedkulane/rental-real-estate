import { DevelopmentDetail } from '@/features/construction/development-detail';

export default async function DevelopmentProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DevelopmentDetail projectId={id} />;
}
