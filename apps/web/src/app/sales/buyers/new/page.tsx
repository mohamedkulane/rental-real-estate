import { redirect } from 'next/navigation';

export default function NewBuyerPage() {
  redirect('/sales/buyers?create=1');
}
