import { describe, expect, it } from 'vitest';
import { createTextPdf } from './simple-pdf';

describe('simple generated PDF documents', () => {
  it('creates a valid single-page PDF with escaped and wrapped text', () => {
    const pdf = createTextPdf('Lease (agreement)', [
      'Tenant: Amina \\ Hassan',
      'A long line '.repeat(20),
    ]);

    expect(pdf.subarray(0, 8).toString('ascii')).toBe('%PDF-1.4');
    expect(pdf.toString('ascii')).toContain('%%EOF');
    expect(pdf.toString('ascii')).toContain('Lease \\(agreement\\)');
    expect(pdf.length).toBeGreaterThan(300);
  });
});
