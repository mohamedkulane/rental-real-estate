import { redirect } from 'next/navigation';

/** Legacy portfolio property register → canonical Portfolio Properties workspace. */
export default function PortfolioPropertiesIndexPage() {
  redirect('/rental/properties');
}
