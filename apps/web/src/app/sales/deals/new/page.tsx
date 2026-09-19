import { redirect } from 'next/navigation';

export default function NewSalesDealPage() {
  redirect('/workflows/new?type=PROPERTY_SALE');
}
