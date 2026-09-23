import { redirect } from 'next/navigation';

export default function NewRentalPropertyPage() {
  redirect('/rental/properties?create=1');
}
