import type { TermKey } from './types';

export const financePageTerms: Partial<
  Record<'invoices' | 'payments' | 'owner-statements' | 'owner-payouts' | 'expenses' | 'accounting', TermKey>
> = {
  invoices: 'invoice',
  payments: 'payment',
  'owner-statements': 'ownerStatement',
  'owner-payouts': 'ownerPayout',
  expenses: 'expense',
  accounting: 'journalEntry',
};

export const operationsPageTerms: Partial<
  Record<'maintenance' | 'work-orders' | 'inspections' | 'vendors', TermKey>
> = {
  maintenance: 'maintenanceRequest',
  'work-orders': 'workOrder',
  inspections: 'inspection',
  vendors: 'vendor',
};

export const commercialPageTerms: Partial<
  Record<'rental-brokerage' | 'full-management' | 'property-sales', TermKey>
> = {
  'rental-brokerage': 'rentalBrokerage',
  'full-management': 'fullManagement',
  'property-sales': 'saleBrokerage',
};

export const crmPageTerms: Partial<Record<'leads' | 'pipeline' | 'follow-ups', TermKey>> = {
  leads: 'lead',
  pipeline: 'pipeline',
  'follow-ups': 'followUp',
};
