import { redirect } from 'next/navigation';

/** Detail pages belong under Portfolio → Properties. */
export default async function RentalPropertyDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { propertyId } = await params;
  const query = await searchParams;
  const tab = typeof query.tab === 'string' ? query.tab : undefined;
  const manage = typeof query.manage === 'string' ? query.manage : undefined;
  const qs = new URLSearchParams();
  if (tab) qs.set('tab', tab);
  if (manage) qs.set('manage', manage);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  redirect(`/portfolio/properties/${propertyId}${suffix}`);
}
