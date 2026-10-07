import { DevelopmentDetail } from '@/features/development/development-detail';

export default async function DevelopmentProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DevelopmentDetail projectId={id} />;
}
