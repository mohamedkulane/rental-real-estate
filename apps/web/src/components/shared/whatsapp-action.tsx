import { MessageCircle } from 'lucide-react';

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  return value.includes('*') || digits.length < 7 ? null : digits;
}

export function WhatsAppAction({
  phone,
  message,
}: {
  phone?: string | null | undefined;
  message: string;
}) {
  const number = phone ? whatsappNumber(phone) : null;
  if (!number) return null;
  return (
    <a
      className="button secondary inline-flex"
      href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Open WhatsApp conversation"
      title="Open WhatsApp conversation"
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      WhatsApp
    </a>
  );
}
