import { redirect } from 'next/navigation';

/** Canonical company settings live under Administration → Settings → Company. */
export default async function SettingsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const params = await searchParams;
  const settingsSection =
    params.section === 'company' || !params.section ? 'company' : params.section;
  redirect(`/admin?section=settings&settingsSection=${encodeURIComponent(settingsSection)}`);
}
