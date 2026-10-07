'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { apiUrl } from '@/lib/phase3-api';
import toast from '@/lib/toast';

export function GeneratedPdfButton({
  path,
  label = 'Download PDF',
}: {
  path: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl(path), { credentials: 'include' });
      if (!response.ok) throw new Error('The PDF could not be generated.');
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = path.split('/').pop() + '.pdf';
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The PDF could not be generated.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="button secondary"
      type="button"
      disabled={loading}
      onClick={() => void download()}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {loading ? 'Preparing...' : label}
    </button>
  );
}
