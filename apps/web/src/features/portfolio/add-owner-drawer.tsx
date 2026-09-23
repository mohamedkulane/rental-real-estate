'use client';

import { useId, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from '@/lib/toast';
import {
  WorkspaceFormDrawer,
  WorkspaceFormDrawerFooter,
} from '@/components/shared/workspace-form-drawer';
import { ChoiceGroup, ChoiceOption } from '@/components/shared/choice-option';
import { BranchSelect } from '@/features/finance/finance-forms';
import { api, type Principal, userFacingError } from '@/lib/phase3-api';

const FORM_ID = 'add-owner-drawer-form';
const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-[#215E61] focus:outline-none focus:ring-2 focus:ring-[#215E61]/15';

type PartyKind = 'PERSON' | 'ORGANIZATION';

function BranchField({
  principal,
  value,
  onChange,
}: {
  principal: Principal;
  value: string;
  onChange: (value: string) => void;
}) {
  if (principal.branches.length <= 1) return null;
  return (
    <div>
      <BranchSelect
        branches={principal.branches}
        value={value}
        onChange={onChange}
        optional
        label="Branch (optional — leave empty for company headquarters)"
      />
    </div>
  );
}

/**
 * Workspace create drawer: new person/organization + owner profile in one submit.
 * Uses POST /rental/commands/add-owner (party.create + owner.create).
 */
export function AddOwnerDrawer({
  open,
  onClose,
  onCreated,
  principal,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  principal: Principal;
}) {
  const formId = useId();
  const [branchId, setBranchId] = useState('');
  const [kind, setKind] = useState<PartyKind>('PERSON');

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/rental/commands/add-owner', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Owner created.');
      resetLocal();
      onCreated();
    },
    onError: (cause) => toast.error(userFacingError(cause)),
  });

  function resetLocal() {
    setBranchId('');
    setKind('PERSON');
  }

  function close() {
    if (mutation.isPending) return;
    resetLocal();
    onClose();
  }

  return (
    <WorkspaceFormDrawer
      open={open}
      eyebrow="Portfolio"
      title="Add Owner"
      description="Register a new person or organization and create their owner profile together."
      onClose={close}
      size="md"
      footer={
        <WorkspaceFormDrawerFooter
          formId={formId || FORM_ID}
          onCancel={close}
          submitLabel="Save Owner"
          isPending={mutation.isPending}
        />
      }
    >
      <form
        id={formId || FORM_ID}
        className="space-y-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          mutation.mutate({
            name: String(form.get('name') ?? '').trim(),
            phone: String(form.get('phone') ?? '').trim(),
            kind,
            ...(branchId ? { branchId } : {}),
          });
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-4">
          <BranchField principal={principal} value={branchId} onChange={setBranchId} />
          <ChoiceGroup legend="Record type">
            <ChoiceOption
              name="kind"
              value="PERSON"
              label="Person"
              selected={kind === 'PERSON'}
              onSelect={() => setKind('PERSON')}
            />
            <ChoiceOption
              name="kind"
              value="ORGANIZATION"
              label="Organization"
              selected={kind === 'ORGANIZATION'}
              onSelect={() => setKind('ORGANIZATION')}
            />
          </ChoiceGroup>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            {kind === 'ORGANIZATION' ? 'Organization name' : 'Full name'}
            <input
              name="name"
              required
              minLength={2}
              className={inputClass}
              placeholder={kind === 'ORGANIZATION' ? 'Horizon Holdings' : 'Ahmed Ali'}
              autoFocus
            />
          </label>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
            Phone number
            <input
              name="phone"
              required
              minLength={5}
              className={inputClass}
              placeholder="+25261..."
            />
          </label>
        </fieldset>
      </form>
    </WorkspaceFormDrawer>
  );
}
