import { redirect } from 'next/navigation';

/** Canonical start lives on Rental → Brokerage workspace drawer. */
export default function StartRentalBrokeragePage() {
  redirect('/commercial/rental-brokerage?create=1');
}
