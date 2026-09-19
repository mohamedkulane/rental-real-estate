'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import toast from '@/lib/toast';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { api, hasPermission, type CursorPage, type Principal, userFacingError } from '@/lib/phase3-api';

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15';

type OwnerOption = { partyId: string; ownerNumber: string; party: { displayName: string } };

type PropertyRow = {
  id: string;
  propertyCode: string;
  name: string;
  propertyType: string;
  status: string;
  city: string;
};

export function StartRentalBrokerageDrawer({
  open,
  onClose,
  principal,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  principal: Principal | null;
  onStarted?: () => void;
}) {
  const formId = useId();
  const queryClient = useQueryClient();
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const [ownerFeeMethod, setOwnerFeeMethod] = useState<'FIXED' | 'PERCENT'>('PERCENT');
  const [tenantFeeMethod, setTenantFeeMethod] = useState<'FIXED' | 'PERCENT'>('PERCENT');
  const owners = useQuery({
    queryKey: ['rental-brokerage-owners'],
    enabled: Boolean(open && principal && hasPermission(principal, 'owner.read')),
    queryFn: () => api<CursorPage<OwnerOption>>('/owners?limit=50'),
  });
  const properties = useQuery({
    queryKey: ['rental-brokerage-properties', ownerPartyId],
    enabled: Boolean(
      open && principal && hasPermission(principal, 'portfolio.property.read') && ownerPartyId,
    ),
    queryFn: () =>
      api<CursorPage<PropertyRow>>(
        `/properties?limit=50&status=ACTIVE&ownerPartyId=${encodeURIComponent(ownerPartyId)}`,
      ),
  });
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/rental/commands/start-rental-brokerage', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Rental brokerage started.');
      void queryClient.invalidateQueries({ queryKey: ['commercial-service-engagements'] });
      setOwnerPartyId('');
      onStarted?.();
      onClose();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Rental"
      title="Put property under brokerage"
      description="Choose the owner first. Only that owner's properties are shown. Fees are optional for finding a tenant."
      onClose={() => {
        if (!mutation.isPending) {
          setOwnerPartyId('');
          onClose();
        }
      }}
      size="lg"
      footer={
        <WorkspaceFormDrawerFooter
          formId={formId}
          onCancel={() => {
            setOwnerPartyId('');
            onClose();
          }}
          submitLabel="Start Brokerage"
          loadingLabel="Starting…"
          isPending={mutation.isPending}
        />
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const ownerAmount = String(form.get('ownerFeeAmount') ?? '').trim();
          const tenantAmount = String(form.get('tenantFeeAmount') ?? '').trim();
          const fees = [
            ...(ownerAmount
              ? [{ party: 'OWNER', method: ownerFeeMethod, amount: ownerAmount }]
              : []),
            ...(tenantAmount
              ? [{ party: 'TENANT', method: tenantFeeMethod, amount: tenantAmount }]
              : []),
          ];
          mutation.mutate({
            ownerPartyId,
            propertyId: String(form.get('propertyId') ?? ''),
            monthlyRent: String(form.get('monthlyRent') ?? '').trim(),
            ...(fees.length ? { fees } : {}),
            ...(ownerFeeMethod === 'PERCENT' && ownerAmount
              ? { commissionPercent: ownerAmount }
              : {}),
          });
        }}
      >
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Owner
          <select
            name="ownerPartyId"
            required
            className={inputClass}
            value={ownerPartyId}
            onChange={(event) => setOwnerPartyId(event.target.value)}
          >
            <option value="">Select owner</option>
            {(owners.data?.items ?? []).map((owner) => (
              <option key={owner.partyId} value={owner.partyId}>
                {owner.party.displayName} — {owner.ownerNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Property
          <select name="propertyId" required className={inputClass} disabled={!ownerPartyId}>
            <option value="">
              {ownerPartyId
                ? properties.isLoading
                  ? 'Loading properties…'
                  : properties.data?.items.length
                    ? 'Select property'
                    : 'No properties for this owner'
                : 'Select an owner first'}
            </option>
            {(properties.data?.items ?? []).map((property) => (
              <option key={property.id} value={property.id}>
                {property.propertyCode} — {property.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Monthly rent
          <input name="monthlyRent" required inputMode="decimal" className={inputClass} />
        </label>
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">Owner brokerage fee</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Method
              <select
                className={inputClass}
                value={ownerFeeMethod}
                onChange={(event) => setOwnerFeeMethod(event.target.value as 'FIXED' | 'PERCENT')}
              >
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              {ownerFeeMethod === 'PERCENT' ? 'Percent' : 'Amount'}
              <input
                name="ownerFeeAmount"
                required
                inputMode="decimal"
                className={inputClass}
                placeholder={ownerFeeMethod === 'PERCENT' ? '10' : '300'}
              />
            </label>
          </div>
        </fieldset>
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">Tenant brokerage fee</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Method
              <select
                className={inputClass}
                value={tenantFeeMethod}
                onChange={(event) => setTenantFeeMethod(event.target.value as 'FIXED' | 'PERCENT')}
              >
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              {tenantFeeMethod === 'PERCENT' ? 'Percent' : 'Amount'}
              <input
                name="tenantFeeAmount"
                inputMode="decimal"
                className={inputClass}
                placeholder={tenantFeeMethod === 'PERCENT' ? '5' : '150'}
              />
            </label>
          </div>
        </fieldset>
      </form>
    </WorkspaceFormDrawer>
  );
}

export function StartFullManagementDrawer({
  open,
  onClose,
  principal,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  principal: Principal | null;
  onStarted?: () => void;
}) {
  const formId = useId();
  const queryClient = useQueryClient();
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const [tenantBrokerageMethod, setTenantBrokerageMethod] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const owners = useQuery({
    queryKey: ['rental-management-owners'],
    enabled: Boolean(open && principal && hasPermission(principal, 'owner.read')),
    queryFn: () => api<CursorPage<OwnerOption>>('/owners?limit=50'),
  });
  const properties = useQuery({
    queryKey: ['rental-management-properties', ownerPartyId],
    enabled: Boolean(
      open && principal && hasPermission(principal, 'portfolio.property.read') && ownerPartyId,
    ),
    queryFn: () =>
      api<CursorPage<PropertyRow>>(
        `/properties?limit=50&status=ACTIVE&ownerPartyId=${encodeURIComponent(ownerPartyId)}`,
      ),
  });
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/rental/commands/start-full-management', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Full management started.');
      void queryClient.invalidateQueries({ queryKey: ['commercial-service-engagements'] });
      setOwnerPartyId('');
      onStarted?.();
      onClose();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Rental"
      title="Start Full Management"
      description="Choose the owner first. Only that owner's properties are shown. Owner pays management fee; tenant brokerage is optional."
      onClose={() => {
        if (!mutation.isPending) {
          setOwnerPartyId('');
          onClose();
        }
      }}
      size="lg"
      footer={
        <WorkspaceFormDrawerFooter
          formId={formId}
          onCancel={() => {
            setOwnerPartyId('');
            onClose();
          }}
          submitLabel="Start Management"
          loadingLabel="Starting…"
          isPending={mutation.isPending}
        />
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const tenantBrokerageFee = String(form.get('tenantBrokerageFee') ?? '').trim();
          mutation.mutate({
            ownerPartyId,
            propertyId: String(form.get('propertyId') ?? ''),
            monthlyRent: String(form.get('monthlyRent') ?? '').trim(),
            managementFeePercent: String(form.get('managementFeePercent') ?? '').trim(),
            startDate: String(form.get('startDate') ?? ''),
            ...(tenantBrokerageFee ? { tenantBrokerageFee, tenantBrokerageMethod } : {}),
          });
        }}
      >
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Owner
          <select
            name="ownerPartyId"
            required
            className={inputClass}
            value={ownerPartyId}
            onChange={(event) => setOwnerPartyId(event.target.value)}
          >
            <option value="">Select owner</option>
            {(owners.data?.items ?? []).map((owner) => (
              <option key={owner.partyId} value={owner.partyId}>
                {owner.party.displayName} — {owner.ownerNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Property
          <select name="propertyId" required className={inputClass} disabled={!ownerPartyId}>
            <option value="">
              {ownerPartyId
                ? properties.isLoading
                  ? 'Loading properties…'
                  : properties.data?.items.length
                    ? 'Select property'
                    : 'No properties for this owner'
                : 'Select an owner first'}
            </option>
            {(properties.data?.items ?? []).map((property) => (
              <option key={property.id} value={property.id}>
                {property.propertyCode} — {property.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Monthly rent
          <input name="monthlyRent" required inputMode="decimal" className={inputClass} />
        </label>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Management fee (%)
          <input
            name="managementFeePercent"
            required
            inputMode="decimal"
            className={inputClass}
            placeholder="10"
          />
        </label>
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">
            Tenant brokerage fee (optional)
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              Method
              <select
                className={inputClass}
                value={tenantBrokerageMethod}
                onChange={(event) =>
                  setTenantBrokerageMethod(event.target.value as 'FIXED' | 'PERCENT')
                }
              >
                <option value="FIXED">Fixed amount</option>
                <option value="PERCENT">Percentage</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
              {tenantBrokerageMethod === 'PERCENT' ? 'Percent' : 'Amount'}
              <input
                name="tenantBrokerageFee"
                inputMode="decimal"
                className={inputClass}
                placeholder={tenantBrokerageMethod === 'PERCENT' ? '5' : '300'}
              />
            </label>
          </div>
        </fieldset>
        <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
          Start date
          <input name="startDate" type="date" required className={inputClass} />
        </label>
      </form>
    </WorkspaceFormDrawer>
  );
}
