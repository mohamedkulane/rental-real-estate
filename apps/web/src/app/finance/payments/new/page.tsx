import { redirect } from 'next/navigation';

export default function PaymentCreatePage() {
  redirect('/finance/payments?create=1');
}
