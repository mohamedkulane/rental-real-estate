import { redirect } from 'next/navigation';

/** Canonical start lives on Rental → Full Management workspace drawer. */
export default function StartFullManagementPage() {
  redirect('/commercial/full-management?create=1');
}
