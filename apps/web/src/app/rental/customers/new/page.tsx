import { redirect } from 'next/navigation';

export default function NewRentalCustomerPage() {
  redirect('/rental/customers?create=1');
}
