import { redirect } from 'next/navigation';

/** Owner-only create lives under Portfolio → Owners. Owner + property uses Properties. */
export default function NewRentalOwnerPage() {
  redirect('/portfolio?section=owners&create=1');
}
