import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { LeadIntent, LeadStage, Prisma, type Lead } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { CrmContactService } from './crm-contact.service';
import {
  CrmSupportService,
  ack,
  correlation,
  dateValue,
  textValue,
  type CrmTx,
} from './crm-support.service';
import type {
  AssignmentDto,
  BranchTransferDto,
  ContactedTransitionDto,
  ConvertedTransitionDto,
  CorrectLeadIntentDto,
  CreateLeadDto,
  LeadPreferenceDto,
  LinkPartyDto,
  LostTransitionDto,
  MatchingTransitionDto,
  NurturingTransitionDto,
  StageTransitionDto,
  UpdateLeadDto,
  VersionedReasonDto,
} from './crm.dto';

const ACTIVE = new Set<LeadStage>(['QUALIFIED', 'MATCHING', 'NURTURING']);
const TERMINAL = new Set<LeadStage>(['CONVERTED', 'LOST']);
const COMMON = ['preferredAreaText', 'notes', 'desiredByDate'];
export const preferenceFields: Record<LeadIntent, string[]> = {
  RENT: [
    'propertyTypeCodes',
    'rentableSpaceTypeCodes',
    'minRent',
    'maxRent',
    'currency',
    'rentPeriod',
    'minBedrooms',
    'maxBedrooms',
    'minBathrooms',
    'maxBathrooms',
    'minArea',
    'maxArea',
    'areaUnit',
    'moveInDate',
    'furnishedPreference',
    'parkingRequired',
    'rentableSpaceId',
  ],
  BUY: [
    'propertyTypeCodes',
    'minBudget',
    'maxBudget',
    'currency',
    'minBedrooms',
    'maxBedrooms',
    'minBathrooms',
    'maxBathrooms',
    'minArea',
    'maxArea',
    'areaUnit',
    'targetPurchaseDate',
    'financingReadiness',
    'propertyId',
  ],
  SELL: [
    'propertyId',
    'subjectDescription',
    'subjectLocation',
    'expectedMinPrice',
    'askingPrice',
    'currency',
    'desiredSaleDate',
    'sellerRelationship',
  ],
  CONSTRUCTION_SERVICE: [
    'projectBrief',
    'propertyId',
    'siteLocation',
    'category',
    'estimatedMinBudget',
    'estimatedMaxBudget',
    'currency',
    'targetStartDate',
    'targetCompletionDate',
    'plotArea',
    'floorArea',
    'areaUnit',
    'bedrooms',
    'floors',
    'siteControl',
  ],
};
const DATES = new Set([
  'desiredByDate',
  'moveInDate',
  'targetPurchaseDate',
  'desiredSaleDate',
  'targetStartDate',
  'targetCompletionDate',
]);
const MONEY = [
  'minRent',
  'maxRent',
  'minBudget',
  'maxBudget',
  'expectedMinPrice',
  'askingPrice',
  'estimatedMinBudget',
  'estimatedMaxBudget',
];
const AREAS = ['minArea', 'maxArea', 'plotArea', 'floorArea'];
const FIELDS = (preference: LeadPreferenceDto) => preference as Record<string, unknown>;

export function validatePreference(intent: LeadIntent, preference: LeadPreferenceDto) {
  if (!preference || typeof preference !== 'object' || Array.isArray(preference))
    throw new BadRequestException('CRM_VALIDATION_FAILED');
  const value = FIELDS(preference);
  const allowed = new Set([...COMMON, ...preferenceFields[intent]]);
  for (const [key, field] of Object.entries(value)) {
    if (field === undefined) continue;
    if (!allowed.has(key) || field === null) throw new BadRequestException('CRM_VALIDATION_FAILED');
    if (
      DATES.has(key) &&
      (typeof field !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(field) ||
        Number.isNaN(Date.parse(field)) ||
        new Date(field).toISOString().slice(0, 10) !== field)
    )
      throw new BadRequestException('CRM_VALIDATION_FAILED');
    if (
      Array.isArray(field) &&
      (field.length > 20 || field.some((entry) => typeof entry !== 'string' || !entry.trim()))
    )
      throw new BadRequestException('CRM_VALIDATION_FAILED');
    if (
      MONEY.includes(key) &&
      (typeof field !== 'string' || !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/.test(field))
    )
      throw new BadRequestException('CRM_VALIDATION_FAILED');
    if (
      AREAS.includes(key) &&
      (typeof field !== 'string' ||
        !/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(field) ||
        new Prisma.Decimal(field).lte(0))
    )
      throw new BadRequestException('CRM_VALIDATION_FAILED');
    if (
      (key === 'minBathrooms' || key === 'maxBathrooms') &&
      (typeof field !== 'string' || !/^\d{1,3}(?:\.\d)?$/.test(field))
    )
      throw new BadRequestException('CRM_VALIDATION_FAILED');
  }
  for (const [min, max] of [
    ['minRent', 'maxRent'],
    ['minBudget', 'maxBudget'],
    ['expectedMinPrice', 'askingPrice'],
    ['estimatedMinBudget', 'estimatedMaxBudget'],
    ['minArea', 'maxArea'],
    ['minBathrooms', 'maxBathrooms'],
    ['minBedrooms', 'maxBedrooms'],
  ]) {
    if (
      value[min!] !== undefined &&
      value[max!] !== undefined &&
      new Prisma.Decimal(String(value[min!])).gt(String(value[max!]))
    )
      throw new BadRequestException('CRM_VALIDATION_FAILED');
  }
  if (MONEY.some((key) => value[key] !== undefined) && !preference.currency)
    throw new BadRequestException('CRM_VALIDATION_FAILED');
  if (AREAS.some((key) => value[key] !== undefined) && !preference.areaUnit)
    throw new BadRequestException('CRM_VALIDATION_FAILED');
  if (
    intent === 'CONSTRUCTION_SERVICE' &&
    (!preference.projectBrief?.trim() || !preference.category)
  )
    throw new BadRequestException('CRM_VALIDATION_FAILED');
  if (
    preference.targetStartDate &&
    preference.targetCompletionDate &&
    preference.targetCompletionDate < preference.targetStartDate
  )
    throw new BadRequestException('CRM_VALIDATION_FAILED');
}

export function qualified(intent: LeadIntent, value: Record<string, unknown>) {
  const has = (key: string) =>
    value[key] !== null &&
    value[key] !== undefined &&
    (typeof value[key] !== 'string' || Boolean(value[key].trim()));
  const area = Array.isArray(value.preferredAreaText) && value.preferredAreaText.length > 0;
  if (intent === 'RENT')
    return (
      (area || has('rentableSpaceId')) &&
      ['maxRent', 'currency', 'rentPeriod', 'moveInDate'].every(has)
    );
  if (intent === 'BUY')
    return (
      (area || has('propertyId')) && ['maxBudget', 'currency', 'targetPurchaseDate'].every(has)
    );
  if (intent === 'SELL')
    return (
      (has('propertyId') || (has('subjectDescription') && has('subjectLocation'))) &&
      ['askingPrice', 'currency', 'desiredSaleDate', 'sellerRelationship'].every(has)
    );
  return (
    has('projectBrief') &&
    (has('propertyId') || has('siteLocation')) &&
    ['estimatedMaxBudget', 'currency', 'targetStartDate'].every(has)
  );
}

@Injectable()
export class CrmLeadService {
  constructor(
    private readonly support: CrmSupportService,
    private readonly contacts: CrmContactService,
  ) {}
  private async currentPreference(tx: CrmTx, lead: Lead) {
    const current = await tx.leadPreferenceVersion.findFirst({
      where: { leadId: lead.id, lead: { companyId: lead.companyId }, effectiveTo: null },
      include: { rent: true, buy: true, sell: true, constructionService: true },
    });
    if (!current) throw new ConflictException('CRM_DATA_CONFLICT');
    const variant = current.rent ?? current.buy ?? current.sell ?? current.constructionService!;
    const value: Record<string, unknown> = {
      preferredAreaText: current.preferredAreaText,
      notes: current.notes,
      desiredByDate: current.desiredByDate,
      ...variant,
    };
    delete value.preferenceVersionId;
    return { row: current, value };
  }
  private async preference(
    tx: CrmTx,
    principal: AuthenticatedPrincipal,
    lead: Lead,
    input: LeadPreferenceDto,
    replace: boolean,
    reason: string,
    correlationId?: string,
  ) {
    validatePreference(lead.intent, input);
    await this.support.asset(
      principal,
      lead.intent,
      input.propertyId,
      input.rentableSpaceId,
      tx,
      true,
    );
    const prior = replace ? await this.currentPreference(tx, lead) : null;
    if (prior) {
      const oldProperty = prior.value.propertyId as string | null | undefined;
      const oldSpace = prior.value.rentableSpaceId as string | null | undefined;
      if (
        (oldProperty && oldProperty !== input.propertyId) ||
        (oldSpace && oldSpace !== input.rentableSpaceId)
      ) {
        const readable = await this.support.asset(
          principal,
          lead.intent,
          oldProperty,
          oldSpace,
          tx,
          false,
        );
        if (!readable) throw new BadRequestException('CRM_CAPABILITY_DENIED');
      }
    }
    if (ACTIVE.has(lead.stage) && !qualified(lead.intent, FIELDS(input)))
      throw new BadRequestException('CRM_QUALIFICATION_REQUIRED');
    const now = await this.support.instant(tx);
    if (prior)
      await tx.leadPreferenceVersion.update({
        where: { id: prior.row.id },
        data: { effectiveTo: now },
      });
    const scalar = Object.fromEntries(
      preferenceFields[lead.intent].map((field) => {
        const value = FIELDS(input)[field];
        return [
          field,
          DATES.has(field)
            ? dateValue(value as string | undefined)
            : field.endsWith('Codes')
              ? (value ?? [])
              : typeof value === 'string'
                ? value.trim()
                : (value ?? null),
        ];
      }),
    );
    const variant =
      lead.intent === 'RENT'
        ? {
            rent: {
              create:
                scalar as Prisma.RentLeadPreferenceUncheckedCreateWithoutPreferenceVersionInput,
            },
          }
        : lead.intent === 'BUY'
          ? {
              buy: {
                create:
                  scalar as Prisma.BuyLeadPreferenceUncheckedCreateWithoutPreferenceVersionInput,
              },
            }
          : lead.intent === 'SELL'
            ? {
                sell: {
                  create:
                    scalar as Prisma.SellLeadPreferenceUncheckedCreateWithoutPreferenceVersionInput,
                },
              }
            : {
                constructionService: {
                  create:
                    scalar as Prisma.ConstructionServiceLeadPreferenceUncheckedCreateWithoutPreferenceVersionInput,
                },
              };
    await tx.leadPreferenceVersion.create({
      data: {
        id: uuidv7(),
        leadId: lead.id,
        intent: lead.intent,
        versionNo: (prior?.row.versionNo ?? 0) + 1,
        preferredAreaText: [...new Set(input.preferredAreaText?.map((item) => item.trim()) ?? [])],
        notes: textValue(input.notes),
        desiredByDate: dateValue(input.desiredByDate),
        effectiveFrom: now,
        actorUserId: principal.userId,
        reason,
        correlationId: correlation(correlationId),
        ...variant,
      },
    });
    if (prior)
      await this.support.audit(
        tx,
        principal,
        'crm.lead.preference-corrected',
        'Lead',
        lead.id,
        lead.responsibleBranchId,
        {},
        { version: lead.version + 1 },
        correlationId,
      );
    const oldAsset = prior?.value.propertyId ?? prior?.value.rentableSpaceId;
    const oldId = typeof oldAsset === 'string' ? oldAsset : null;
    const newId = input.propertyId ?? input.rentableSpaceId ?? null;
    if (oldId !== newId)
      await this.support.audit(
        tx,
        principal,
        newId ? 'crm.lead.asset-linked' : 'crm.lead.asset-unlinked',
        'Lead',
        lead.id,
        lead.responsibleBranchId,
        { assetId: String(oldId ?? '') },
        { assetId: newId },
        correlationId,
      );
  }
  async create(principal: AuthenticatedPrincipal, input: CreateLeadDto, correlationId?: string) {
    return this.support.database.$transaction(async (tx) => {
      await this.support.branch(principal, input.responsibleBranchId, tx, true);
      this.support.assert(principal, 'crm.lead.create', input.responsibleBranchId);
      await this.support.source(principal, input.sourceId, tx);
      if (
        !input.displayName.trim() ||
        (!input.partyId && !input.phone?.trim() && !input.email?.trim())
      )
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      if (input.partyId) await this.support.party(principal, input.partyId, tx, true);
      if (input.currentAssigneeEmployeeId) {
        this.support.assert(principal, 'crm.assignment.manage', input.responsibleBranchId);
        await this.support.eligible(
          tx,
          principal.companyId,
          input.currentAssigneeEmployeeId,
          input.responsibleBranchId,
        );
      }
      validatePreference(input.intent, input.preference);
      const [sequence] = await tx.$queryRaw<Array<{ value: bigint }>>(
        Prisma.sql`SELECT nextval('public.lead_record_number_seq') AS value`,
      );
      const now = await this.support.instant(tx);
      const lead = await tx.lead.create({
        data: {
          id: uuidv7(),
          companyId: principal.companyId,
          leadNumber: `LEAD-${sequence!.value.toString().padStart(6, '0')}`,
          intent: input.intent,
          sourceId: input.sourceId,
          responsibleBranchId: input.responsibleBranchId,
          currentAssigneeEmployeeId: input.currentAssigneeEmployeeId ?? null,
          partyId: input.partyId ?? null,
          displayName: input.displayName.trim(),
          phoneEncrypted: input.phone ? this.contacts.encrypt(input.phone) : null,
          emailEncrypted: input.email ? this.contacts.encrypt(input.email) : null,
          phoneSearchToken: input.phone ? this.contacts.token(input.phone) : null,
          emailSearchToken: input.email ? this.contacts.token(input.email) : null,
          createdByUserId: principal.userId,
          createdAt: now,
          updatedAt: now,
        },
      });
      await this.preference(
        tx,
        principal,
        lead,
        input.preference,
        false,
        'Lead created',
        correlationId,
      );
      await tx.leadStageHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          toStage: 'NEW',
          actorUserId: principal.userId,
          leadVersion: 1,
          correlationId: correlation(correlationId),
          occurredAt: now,
        },
      });
      await tx.leadIntentHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          toIntent: lead.intent,
          reason: 'Lead created',
          actorUserId: principal.userId,
          leadVersion: 1,
          correlationId: correlation(correlationId),
          occurredAt: now,
        },
      });
      await tx.leadBranchHistory.create({
        data: {
          id: uuidv7(),
          leadId: lead.id,
          branchId: lead.responsibleBranchId,
          assignedFrom: now,
          actorUserId: principal.userId,
          reason: 'Lead created',
          correlationId: correlation(correlationId),
        },
      });
      if (lead.currentAssigneeEmployeeId) {
        await tx.leadAssignment.create({
          data: {
            id: uuidv7(),
            leadId: lead.id,
            branchId: lead.responsibleBranchId,
            employeeId: lead.currentAssigneeEmployeeId,
            assignedFrom: now,
            actorUserId: principal.userId,
            reason: 'Initial assignment',
            correlationId: correlation(correlationId),
          },
        });
        await this.support.audit(
          tx,
          principal,
          'crm.lead.assigned',
          'Lead',
          lead.id,
          lead.responsibleBranchId,
          {},
          { version: 1 },
          correlationId,
        );
      }
      if (lead.partyId)
        await this.support.audit(
          tx,
          principal,
          'crm.lead.party-linked',
          'Lead',
          lead.id,
          lead.responsibleBranchId,
          {},
          { partyId: lead.partyId },
          correlationId,
        );
      await this.support.audit(
        tx,
        principal,
        'crm.lead.created',
        'Lead',
        lead.id,
        lead.responsibleBranchId,
        {},
        { version: 1, intent: lead.intent, stage: lead.stage },
        correlationId,
      );
      return ack(lead);
    });
  }
  async update(
    principal: AuthenticatedPrincipal,
    id: string,
    input: UpdateLeadDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const current = await this.support.lockedLead(
        tx,
        principal,
        id,
        'crm.lead.update',
        input.expectedVersion,
      );
      if (input.sourceId) await this.support.source(principal, input.sourceId, tx);
      if (input.preference)
        await this.preference(
          tx,
          principal,
          current,
          input.preference,
          true,
          input.reason,
          correlationId,
        );
      const phone =
        input.phone === undefined
          ? current.phoneEncrypted
          : input.phone
            ? this.contacts.encrypt(input.phone)
            : null;
      const email =
        input.email === undefined
          ? current.emailEncrypted
          : input.email
            ? this.contacts.encrypt(input.email)
            : null;
      if (!current.partyId && !phone && !email)
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      if (input.displayName !== undefined && !input.displayName.trim())
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      const after = await tx.lead.update({
        where: { id, companyId: principal.companyId, version: input.expectedVersion },
        data: {
          ...(input.sourceId ? { sourceId: input.sourceId } : {}),
          ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
          phoneEncrypted: phone,
          emailEncrypted: email,
          ...(input.phone !== undefined
            ? { phoneSearchToken: input.phone ? this.contacts.token(input.phone) : null }
            : {}),
          ...(input.email !== undefined
            ? { emailSearchToken: input.email ? this.contacts.token(input.email) : null }
            : {}),
          version: { increment: 1 },
        },
      });
      await this.support.audit(
        tx,
        principal,
        'crm.lead.updated',
        'Lead',
        id,
        current.responsibleBranchId,
        { version: current.version },
        { version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
  async correctIntent(
    principal: AuthenticatedPrincipal,
    id: string,
    input: CorrectLeadIntentDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const current = await this.support.lockedLead(
        tx,
        principal,
        id,
        'crm.lead.update',
        input.expectedVersion,
      );
      if (
        (current.stage !== 'NEW' && current.stage !== 'CONTACTED') ||
        current.intent === input.intent
      )
        throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      await this.preference(
        tx,
        principal,
        { ...current, intent: input.intent },
        input.preference,
        true,
        input.reason,
        correlationId,
      );
      const after = await tx.lead.update({
        where: { id, companyId: principal.companyId, version: input.expectedVersion },
        data: { intent: input.intent, version: { increment: 1 } },
      });
      await tx.leadIntentHistory.create({
        data: {
          id: uuidv7(),
          leadId: id,
          fromIntent: current.intent,
          toIntent: input.intent,
          reason: input.reason.trim(),
          actorUserId: principal.userId,
          leadVersion: after.version,
          correlationId: correlation(correlationId),
        },
      });
      await this.support.audit(
        tx,
        principal,
        'crm.lead.intent-corrected',
        'Lead',
        id,
        current.responsibleBranchId,
        { intent: current.intent, version: current.version },
        { intent: after.intent, version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
  async linkParty(
    principal: AuthenticatedPrincipal,
    id: string,
    input: LinkPartyDto,
    correlationId?: string,
  ) {
    return this.party(principal, id, input, input.partyId, correlationId);
  }
  async unlinkParty(
    principal: AuthenticatedPrincipal,
    id: string,
    input: VersionedReasonDto,
    correlationId?: string,
  ) {
    return this.party(principal, id, input, null, correlationId);
  }
  private async party(
    principal: AuthenticatedPrincipal,
    id: string,
    input: VersionedReasonDto,
    partyId: string | null,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const current = await this.support.lockedLead(
        tx,
        principal,
        id,
        'crm.lead.update',
        input.expectedVersion,
      );
      if (partyId) await this.support.party(principal, partyId, tx, true);
      if (!partyId && !current.phoneEncrypted && !current.emailEncrypted)
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      const after = await tx.lead.update({
        where: { id, companyId: principal.companyId, version: input.expectedVersion },
        data: { partyId, version: { increment: 1 } },
      });
      await this.support.audit(
        tx,
        principal,
        partyId ? 'crm.lead.party-linked' : 'crm.lead.party-unlinked',
        'Lead',
        id,
        current.responsibleBranchId,
        { version: current.version },
        { version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
  async transition(
    principal: AuthenticatedPrincipal,
    id: string,
    target: LeadStage,
    input:
      | StageTransitionDto
      | ContactedTransitionDto
      | MatchingTransitionDto
      | NurturingTransitionDto
      | ConvertedTransitionDto
      | LostTransitionDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const current = await this.support.lockedLead(
        tx,
        principal,
        id,
        'crm.lead.stage',
        input.expectedVersion,
      );
      const transitions: Record<LeadStage, LeadStage[]> = {
        NEW: ['CONTACTED', 'LOST'],
        CONTACTED: ['QUALIFIED', 'LOST'],
        QUALIFIED: ['MATCHING', 'NURTURING', 'CONVERTED', 'LOST'],
        MATCHING: ['NURTURING', 'CONVERTED', 'LOST'],
        NURTURING: ['QUALIFIED', 'MATCHING', 'CONVERTED', 'LOST'],
        CONVERTED: [],
        LOST: [],
      };
      if (!transitions[current.stage].includes(target))
        throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      if (target === 'MATCHING' && current.intent !== 'RENT' && current.intent !== 'BUY')
        throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      if (target === 'CONTACTED') {
        const activity = await tx.leadActivity.findFirst({
          where: {
            id: (input as ContactedTransitionDto).activityId,
            leadId: id,
            lead: { companyId: principal.companyId },
            recordKind: { not: 'VOID' },
            type: { in: ['CALL', 'EMAIL', 'MESSAGE', 'MEETING'] },
            corrections: { none: { recordKind: 'VOID' } },
          },
          select: { id: true },
        });
        if (!activity) throw new BadRequestException('CRM_QUALIFICATION_REQUIRED');
      }
      if (target === 'QUALIFIED' || target === 'MATCHING') {
        if (!current.currentAssigneeEmployeeId)
          throw new BadRequestException('CRM_QUALIFICATION_REQUIRED');
        await this.support.eligible(
          tx,
          principal.companyId,
          current.currentAssigneeEmployeeId,
          current.responsibleBranchId,
        );
        const preference = await this.currentPreference(tx, current);
        if (!qualified(current.intent, preference.value))
          throw new BadRequestException('CRM_QUALIFICATION_REQUIRED');
        await this.support.asset(
          principal,
          current.intent,
          preference.value.propertyId as string | null,
          preference.value.rentableSpaceId as string | null,
          tx,
          true,
        );
      }
      if (target === 'NURTURING') {
        if (!('reason' in input) || !input.reason?.trim())
          throw new BadRequestException('CRM_VALIDATION_FAILED');
        const followup = await tx.leadFollowUp.findFirst({
          where: {
            id: (input as NurturingTransitionDto).followUpId,
            leadId: id,
            lead: { companyId: principal.companyId },
            state: 'OPEN',
          },
          select: { id: true },
        });
        if (!followup) throw new BadRequestException('CRM_QUALIFICATION_REQUIRED');
      }
      const lost = target === 'LOST' ? (input as LostTransitionDto) : null;
      const converted = target === 'CONVERTED' ? (input as ConvertedTransitionDto) : null;
      if (lost?.lostReason === 'OTHER' && !lost.lostNotes?.trim())
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      if (converted && !converted.outcomeSummary.trim())
        throw new BadRequestException('CRM_VALIDATION_FAILED');
      if (TERMINAL.has(target))
        await this.support.cancelOpen(tx, principal, current, target, correlationId);
      const after = await tx.lead.update({
        where: { id, companyId: principal.companyId, version: input.expectedVersion },
        data: {
          stage: target,
          version: { increment: 1 },
          lostReason: lost?.lostReason ?? null,
          lostNotes: textValue(lost?.lostNotes),
          outcomeSummary: textValue(converted?.outcomeSummary),
          externalReference: textValue(converted?.externalReference),
        },
      });
      const reason =
        target === 'MATCHING'
          ? (input as MatchingTransitionDto).readinessLabel.trim()
          : 'reason' in input
            ? textValue(input.reason)
            : target;
      await tx.leadStageHistory.create({
        data: {
          id: uuidv7(),
          leadId: id,
          fromStage: current.stage,
          toStage: target,
          reason,
          actorUserId: principal.userId,
          leadVersion: after.version,
          correlationId: correlation(correlationId),
        },
      });
      await this.support.audit(
        tx,
        principal,
        'crm.lead.stage-transitioned',
        'Lead',
        id,
        current.responsibleBranchId,
        { stage: current.stage, version: current.version },
        { stage: target, version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
  async assignment(
    principal: AuthenticatedPrincipal,
    id: string,
    action: 'assign' | 'reassign' | 'unassign',
    input: AssignmentDto | VersionedReasonDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const lead = await this.support.lockedLead(
        tx,
        principal,
        id,
        'crm.assignment.manage',
        input.expectedVersion,
      );
      const employeeId = 'employeeId' in input ? input.employeeId : null;
      if (
        (action === 'assign' && lead.currentAssigneeEmployeeId) ||
        (action !== 'assign' && !lead.currentAssigneeEmployeeId) ||
        (action === 'unassign' && ACTIVE.has(lead.stage)) ||
        employeeId === lead.currentAssigneeEmployeeId
      )
        throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      if (employeeId)
        await this.support.eligible(tx, principal.companyId, employeeId, lead.responsibleBranchId);
      const now = await this.support.instant(tx);
      await tx.leadAssignment.updateMany({
        where: { leadId: id, lead: { companyId: principal.companyId }, assignedTo: null },
        data: { assignedTo: now },
      });
      if (employeeId)
        await tx.leadAssignment.create({
          data: {
            id: uuidv7(),
            leadId: id,
            branchId: lead.responsibleBranchId,
            employeeId,
            assignedFrom: now,
            actorUserId: principal.userId,
            reason: input.reason.trim(),
            correlationId: correlation(correlationId),
          },
        });
      const after = await tx.lead.update({
        where: { id, companyId: principal.companyId, version: input.expectedVersion },
        data: { currentAssigneeEmployeeId: employeeId, version: { increment: 1 } },
      });
      await this.support.audit(
        tx,
        principal,
        `crm.lead.${action === 'unassign' ? 'unassigned' : action === 'reassign' ? 'reassigned' : 'assigned'}`,
        'Lead',
        id,
        lead.responsibleBranchId,
        { version: lead.version },
        { version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
  async transfer(
    principal: AuthenticatedPrincipal,
    id: string,
    input: BranchTransferDto,
    correlationId?: string,
  ) {
    return this.support.database.$transaction(async (tx) => {
      const lead = await this.support.lockedLead(
        tx,
        principal,
        id,
        'crm.lead.branch.transfer',
        input.expectedVersion,
      );
      await this.support.branch(principal, input.destinationBranchId, tx, true);
      this.support.assert(principal, 'crm.lead.branch.transfer', input.destinationBranchId);
      if (
        input.destinationBranchId === lead.responsibleBranchId ||
        (input.clearAssignee && input.replacementEmployeeId) ||
        (input.clearAssignee && ACTIVE.has(lead.stage))
      )
        throw new BadRequestException('CRM_ILLEGAL_TRANSITION');
      const employeeId = input.clearAssignee
        ? null
        : (input.replacementEmployeeId ?? lead.currentAssigneeEmployeeId);
      if (employeeId)
        await this.support.eligible(tx, principal.companyId, employeeId, input.destinationBranchId);
      const now = await this.support.instant(tx);
      await tx.leadBranchHistory.updateMany({
        where: { leadId: id, lead: { companyId: principal.companyId }, assignedTo: null },
        data: { assignedTo: now },
      });
      await tx.leadBranchHistory.create({
        data: {
          id: uuidv7(),
          leadId: id,
          branchId: input.destinationBranchId,
          assignedFrom: now,
          actorUserId: principal.userId,
          reason: input.reason.trim(),
          correlationId: correlation(correlationId),
        },
      });
      await tx.leadAssignment.updateMany({
        where: { leadId: id, lead: { companyId: principal.companyId }, assignedTo: null },
        data: { assignedTo: now },
      });
      if (employeeId)
        await tx.leadAssignment.create({
          data: {
            id: uuidv7(),
            leadId: id,
            branchId: input.destinationBranchId,
            employeeId,
            assignedFrom: now,
            actorUserId: principal.userId,
            reason: input.reason.trim(),
            correlationId: correlation(correlationId),
          },
        });
      const after = await tx.lead.update({
        where: { id, companyId: principal.companyId, version: input.expectedVersion },
        data: {
          responsibleBranchId: input.destinationBranchId,
          currentAssigneeEmployeeId: employeeId,
          version: { increment: 1 },
        },
      });
      await this.support.audit(
        tx,
        principal,
        'crm.lead.branch-transferred',
        'Lead',
        id,
        input.destinationBranchId,
        { branchId: lead.responsibleBranchId, version: lead.version },
        { branchId: input.destinationBranchId, version: after.version },
        correlationId,
      );
      return ack(after);
    });
  }
}
