import { redirect } from 'next/navigation';

/** Create Deal is not a primary staff task — deals follow placement/lease. */
export default function BrokerageDealCreatePage() {
  redirect('/commercial/rental-brokerage/deals');
}
