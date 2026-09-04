import { BadRequestException, Injectable } from '@nestjs/common';
import { LeadStage, Prisma, type Lead } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../security/security.types';
import { CrmSupportService, type CrmDb } from './crm-support.service';
import { CrmCursorService } from './crm-cursor.service';
import { CrmContactService } from './crm-contact.service';
import { FollowUpDerivedStatus } from './crm.dto';
import type {
  ActivityListQueryDto,
  CrmPageQueryDto,
  FollowUpListQueryDto,
  LeadListQueryDto,
  PipelineQueryDto,
  SourceListQueryDto,
} from './crm.dto';

export type JsonRow = Record<string, unknown>;
export interface ReadPage {
  items: JsonRow[];
  pageInfo: { hasNextPage: boolean; nextCursor: string | null };
  totalCount: number;
}
interface PageRow {
  data: JsonRow;
  key: string[];
}
export const matchText = (value: string) => `%${value.trim().replace(/[\\%_]/g, '\\$&')}%`;
export const clauses = (value: Prisma.Sql[]) => Prisma.join(value, ' AND ');
export const branchSql = (column: Prisma.Sql, branches: string[] | null) =>
  branches === null
    ? Prisma.sql`TRUE`
    : branches.length
      ? Prisma.sql`${column} IN (${Prisma.join(branches.map((id) => Prisma.sql`${id}::uuid`))})`
      : Prisma.sql`FALSE`;
export const instantKey = (column: Prisma.Sql) =>
  Prisma.sql`to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

@Injectable()
export class CrmReadService {
  constructor(
    private readonly support: CrmSupportService,
    private readonly cursors: CrmCursorService,
    private readonly contacts: CrmContactService,
  ) {}
  scope(
    principal: AuthenticatedPrincipal,
    permissions: string[],
    query: object,
    context?: unknown,
  ) {
    return this.cursors.scope({
      companyId: principal.companyId,
      permissions: permissions.map((permission) => [
        permission,
        this.support.branches(principal, [permission]),
      ]),
      query,
      context,
    });
  }
  decode(cursor: string | undefined, kind: string, scope: string) {
    return this.cursors.decode(cursor, kind, scope);
  }
  async page(
    base: Prisma.Sql,
    query: CrmPageQueryDto,
    kind: string,
    scope: string,
    direction: 'asc' | 'desc' = 'asc',
    db: CrmDb = this.support.database,
    extraAsOf?: string,
  ): Promise<ReadPage> {
    const cursor = this.cursors.decode(query.cursor, kind, scope);
    const boundary = cursor
      ? direction === 'asc'
        ? Prisma.sql`key>${cursor.key}::text[]`
        : Prisma.sql`key<${cursor.key}::text[]`
      : Prisma.sql`TRUE`;
    const order = direction === 'asc' ? Prisma.sql`key ASC` : Prisma.sql`key DESC`;
    const [result] = await db.$queryRaw<Array<{ rows: PageRow[]; totalCount: number }>>(
      Prisma.sql`WITH base AS MATERIALIZED (${base}), page AS (SELECT * FROM base WHERE ${boundary} ORDER BY ${order} LIMIT ${query.limit + 1}) SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('data',data,'key',key) ORDER BY ${order}) FROM page),'[]'::jsonb) AS rows,(SELECT count(*)::int FROM base) AS "totalCount"`,
    );
    const rows = result?.rows ?? [];
    const selected = rows.slice(0, query.limit);
    const last = selected.at(-1);
    const hasNextPage = rows.length > query.limit;
    return {
      items: selected.map((row) => row.data),
      pageInfo: {
        hasNextPage,
        nextCursor:
          hasNextPage && last
            ? this.cursors.encode(kind, scope, last.key, extraAsOf ?? cursor?.asOf)
            : null,
      },
      totalCount: result?.totalCount ?? 0,
    };
  }
  private leadConditions(principal: AuthenticatedPrincipal, query: LeadListQueryDto) {
    const conditions = [
      Prisma.sql`l."companyId"=${principal.companyId}::uuid`,
      branchSql(
        Prisma.sql`l."responsibleBranchId"`,
        this.support.branches(principal, ['crm.lead.read'], query.branchId),
      ),
    ];
    if (query.stage?.length)
      conditions.push(Prisma.sql`l.stage::text IN (${Prisma.join(query.stage)})`);
    if (query.intent?.length)
      conditions.push(Prisma.sql`l.intent::text IN (${Prisma.join(query.intent)})`);
    if (query.sourceId?.length)
      conditions.push(
        Prisma.sql`l."sourceId" IN (${Prisma.join(query.sourceId.map((id) => Prisma.sql`${id}::uuid`))})`,
      );
    if (query.assigneeEmployeeId)
      conditions.push(Prisma.sql`l."currentAssigneeEmployeeId"=${query.assigneeEmployeeId}::uuid`);
    if (query.createdFrom) conditions.push(Prisma.sql`l."createdAt">=${query.createdFrom}::date`);
    if (query.createdTo) conditions.push(Prisma.sql`l."createdAt"<${query.createdTo}::date`);
    if (query.search?.trim()) {
      const term = matchText(query.search);
      const token = this.contacts.token(query.search);
      conditions.push(
        Prisma.sql`(l."leadNumber" ILIKE ${term} OR l."displayName" ILIKE ${term} OR s.label ILIKE ${term} OR ep."displayName" ILIKE ${term} OR l."phoneSearchToken"=${token} OR l."emailSearchToken"=${token})`,
      );
    }
    return conditions;
  }
  private leadBase(
    principal: AuthenticatedPrincipal,
    query: LeadListQueryDto,
    pipeline = false,
    leadId?: string,
  ) {
    const conditions = this.leadConditions(principal, query);
    if (leadId) conditions.push(Prisma.sql`l.id=${leadId}::uuid`);
    const order = pipeline ? Prisma.sql`l."updatedAt"` : Prisma.sql`l."createdAt"`;
    return Prisma.sql`SELECT l.stage::text AS stage, ARRAY[${instantKey(order)},l.id::text] AS key,
      jsonb_build_object('id',l.id,'leadNumber',l."leadNumber",'displayName',l."displayName",'intent',l.intent,'stage',l.stage,'version',l.version,'createdAt',l."createdAt",'updatedAt',l."updatedAt",
      'responsibleBranch',jsonb_build_object('id',b.id,'code',b.code,'name',b.name,'active',b.active),
      'source',jsonb_build_object('id',s.id,'code',s.code,'label',s.label,'status',s.status),
      'currentAssignee',CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object('id',e.id,'employeeNumber',e."employeeNumber",'displayName',ep."displayName") END,
      '_phone',l."phoneEncrypted",'_email',l."emailEncrypted") AS data
      FROM leads l JOIN branches b ON b.id=l."responsibleBranchId" AND b."companyId"=l."companyId"
      JOIN lead_sources s ON s.id=l."sourceId" AND s."companyId"=l."companyId"
      LEFT JOIN employees e ON e.id=l."currentAssigneeEmployeeId" AND e."companyId"=l."companyId"
      LEFT JOIN parties ep ON ep.id=e."partyId" AND ep."companyId"=l."companyId" WHERE ${clauses(conditions)}`;
  }
  private present(row: JsonRow, reveal = false) {
    const { _phone, _email, ...rest } = row;
    const phone = typeof _phone === 'string' ? _phone : null;
    const email = typeof _email === 'string' ? _email : null;
    return {
      ...rest,
      contact: {
        hasPhone: Boolean(phone),
        hasEmail: Boolean(email),
        phoneMasked: this.contacts.masked(phone, 'phone'),
        emailMasked: this.contacts.masked(email, 'email'),
        ...(reveal
          ? {
              phone: phone ? this.contacts.decrypt(phone) : null,
              email: email ? this.contacts.decrypt(email) : null,
            }
          : {}),
      },
    };
  }
  async list(principal: AuthenticatedPrincipal, query: LeadListQueryDto) {
    const { cursor: ignored, limit: unused, ...filters } = query;
    void ignored;
    void unused;
    const page = await this.page(
      this.leadBase(principal, query),
      query,
      'register',
      this.scope(principal, ['crm.lead.read'], filters),
      'desc',
    );
    return { ...page, items: page.items.map((row) => this.present(row)) };
  }
  async pipeline(principal: AuthenticatedPrincipal, query: PipelineQueryDto) {
    if (query.cursor && !query.pipelineStage)
      throw new BadRequestException('CRM_VALIDATION_FAILED');
    const { cursor: ignored, limit: unused, pipelineStage, ...filters } = query;
    void ignored;
    void unused;
    const scope = this.scope(principal, ['crm.lead.read'], filters);
    const cursor = query.pipelineStage
      ? this.cursors.decode(query.cursor, `pipeline:${query.pipelineStage}`, scope)
      : undefined;
    const restriction = pipelineStage ? Prisma.sql`stage=${pipelineStage}` : Prisma.sql`TRUE`;
    const boundary = cursor ? Prisma.sql`key<${cursor.key}::text[]` : Prisma.sql`TRUE`;
    const [result] = await this.support.database.$queryRaw<
      Array<{
        rows: Array<PageRow & { stage: LeadStage }>;
        counts: Array<{ stage: LeadStage; count: number }>;
      }>
    >(
      Prisma.sql`WITH base AS MATERIALIZED (${this.leadBase(principal, query, true)}), ranked AS (SELECT *,row_number() OVER(PARTITION BY stage ORDER BY key DESC) AS rank FROM base WHERE ${restriction} AND ${boundary}) SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('data',data,'key',key,'stage',stage) ORDER BY stage,key DESC) FROM ranked WHERE rank<=${query.limit + 1}),'[]'::jsonb) AS rows, COALESCE((SELECT jsonb_agg(t) FROM (SELECT stage,count(*)::int AS count FROM base GROUP BY stage)t),'[]'::jsonb) AS counts`,
    );
    const stageTotals = Object.fromEntries(
      Object.values(LeadStage).map((stage) => [
        stage,
        result?.counts.find((item) => item.stage === stage)?.count ?? 0,
      ]),
    ) as Record<LeadStage, number>;
    const groups: Partial<Record<LeadStage, ReadPage>> = {};
    for (const stage of pipelineStage ? [pipelineStage] : Object.values(LeadStage)) {
      const rows = (result?.rows ?? []).filter((row) => row.stage === stage);
      const selected = rows.slice(0, query.limit);
      const last = selected.at(-1);
      const hasNextPage = rows.length > query.limit;
      groups[stage] = {
        items: selected.map((row) => this.present(row.data)),
        totalCount: stageTotals[stage],
        pageInfo: {
          hasNextPage,
          nextCursor:
            hasNextPage && last ? this.cursors.encode(`pipeline:${stage}`, scope, last.key) : null,
        },
      };
    }
    return {
      groups,
      stageTotals,
      totalCount: Object.values(stageTotals).reduce((sum, value) => sum + value, 0),
    };
  }
  async get(principal: AuthenticatedPrincipal, id: string, correlationId?: string) {
    return this.support.database.$transaction(async (tx) => {
      const [fresh] = await tx.$queryRaw<Lead[]>(
        Prisma.sql`SELECT * FROM leads WHERE id=${id}::uuid AND "companyId"=${principal.companyId}::uuid FOR SHARE`,
      );
      if (!fresh) throw new BadRequestException('CRM_NOT_FOUND');
      this.support.assert(principal, 'crm.lead.read', fresh.responsibleBranchId);
      const [row] = await tx.$queryRaw<Array<{ data: JsonRow }>>(
        this.leadBase(principal, { limit: 1 }, false, id),
      );
      if (!row) throw new BadRequestException('CRM_NOT_FOUND');
      // Convert exact numeric JSON values to strings in PostgreSQL, before JavaScript parsing.
      const [version] = await tx.$queryRaw<Array<{preference:JsonRow}>>(Prisma.sql`
        SELECT jsonb_build_object('intent',v.intent,'preferredAreaText',v."preferredAreaText",'notes',v.notes,'desiredByDate',v."desiredByDate") ||
          (SELECT jsonb_object_agg(e.key,CASE WHEN e.key IN ('minRent','maxRent','minBudget','maxBudget','expectedMinPrice','askingPrice','estimatedMinBudget','estimatedMaxBudget','minArea','maxArea','plotArea','floorArea','minBathrooms','maxBathrooms') AND e.value <> 'null'::jsonb THEN to_jsonb(e.value::text) ELSE e.value END)
           FROM jsonb_each(COALESCE(to_jsonb(r),to_jsonb(b),to_jsonb(s),to_jsonb(c))-'preferenceVersionId') e) AS preference
        FROM lead_preference_versions v JOIN leads l ON l.id=v."leadId"
        LEFT JOIN rent_lead_preferences r ON r."preferenceVersionId"=v.id
        LEFT JOIN buy_lead_preferences b ON b."preferenceVersionId"=v.id
        LEFT JOIN sell_lead_preferences s ON s."preferenceVersionId"=v.id
        LEFT JOIN construction_service_lead_preferences c ON c."preferenceVersionId"=v.id
        WHERE v."leadId"=${id}::uuid AND l."companyId"=${principal.companyId}::uuid AND v."effectiveTo" IS NULL`);
      if (!version?.preference) throw new BadRequestException('CRM_NOT_FOUND');
      const preference=version.preference;
      const asset = await this.support.asset(
        principal,
        fresh.intent,
        preference.propertyId as string | null,
        preference.rentableSpaceId as string | null,
        tx,
        false,
      );
      if (!asset) {
        if ('propertyId' in preference) preference.propertyId = null;
        if ('rentableSpaceId' in preference) preference.rentableSpaceId = null;
      }
      const party = fresh.partyId
        ? await this.support.party(principal, fresh.partyId, tx, false)
        : null;
      const reveal =
        principal.permissions.has('crm.lead.contact.read') &&
        this.support.authorization.canPerformInBranch(
          principal,
          'crm.lead.contact.read',
          fresh.responsibleBranchId,
        );
      if (reveal)
        await this.support.audit(
          tx,
          principal,
          'crm.lead.contact.revealed',
          'Lead',
          id,
          fresh.responsibleBranchId,
          {},
          { version: fresh.version },
          correlationId,
        );
      return {
        ...this.present(row.data, reveal),
        preference: this.preferenceDecimals(preference),
        party,
        property: asset?.property ?? null,
        rentableSpace: asset?.rentableSpace ?? null,
        lostReason: fresh.lostReason,
        lostNotes: fresh.lostNotes,
        outcomeSummary: fresh.outcomeSummary,
        externalReference: fresh.externalReference,
      };
    });
  }
  private preferenceDecimals(value: JsonRow) {
    for (const key of [
      'minRent',
      'maxRent',
      'minBudget',
      'maxBudget',
      'expectedMinPrice',
      'askingPrice',
      'estimatedMinBudget',
      'estimatedMaxBudget',
      'minArea',
      'maxArea',
      'plotArea',
      'floorArea',
      'minBathrooms',
      'maxBathrooms',
    ])
      if (Prisma.Decimal.isDecimal(value[key])) value[key] = value[key].toString();
    return value;
  }
  async history(principal: AuthenticatedPrincipal, id: string, query: CrmPageQueryDto) {
    const lead = await this.support.lead(principal, id, ['crm.lead.read']);
    const base = Prisma.sql`SELECT ARRAY[stamp,id::text,kind] AS key,data FROM (
      SELECT h.id,'STAGE'::text AS kind,${instantKey(Prisma.sql`h."occurredAt"`)} AS stamp,jsonb_build_object('id',h.id,'kind','STAGE','occurredAt',h."occurredAt",'fromStage',h."fromStage",'toStage',h."toStage",'reason',h.reason,'leadVersion',h."leadVersion") AS data FROM lead_stage_history h JOIN leads l ON l.id=h."leadId" WHERE h."leadId"=${id}::uuid AND l."companyId"=${principal.companyId}::uuid
      UNION ALL SELECT h.id,'INTENT',${instantKey(Prisma.sql`h."occurredAt"`)},jsonb_build_object('id',h.id,'kind','INTENT','occurredAt',h."occurredAt",'fromIntent',h."fromIntent",'toIntent',h."toIntent",'reason',h.reason,'leadVersion',h."leadVersion") FROM lead_intent_history h JOIN leads l ON l.id=h."leadId" WHERE h."leadId"=${id}::uuid AND l."companyId"=${principal.companyId}::uuid
      UNION ALL SELECT h.id,'BRANCH',${instantKey(Prisma.sql`h."assignedFrom"`)},jsonb_build_object('id',h.id,'kind','BRANCH','occurredAt',h."assignedFrom",'branchId',h."branchId",'assignedFrom',h."assignedFrom",'assignedTo',h."assignedTo",'reason',h.reason) FROM lead_branch_history h JOIN leads l ON l.id=h."leadId" WHERE h."leadId"=${id}::uuid AND l."companyId"=${principal.companyId}::uuid
    ) history`;
    return this.page(
      base,
      query,
      'history',
      this.scope(principal, ['crm.lead.read'], {}, { id, branch: lead.responsibleBranchId }),
      'desc',
    );
  }
  async activities(principal: AuthenticatedPrincipal, id: string, query: ActivityListQueryDto) {
    const permissions = ['crm.lead.read', 'crm.activity.read'];
    const lead = await this.support.lead(principal, id, permissions);
    const filters = [
      Prisma.sql`a."leadId"=${id}::uuid`,
      Prisma.sql`l."companyId"=${principal.companyId}::uuid`,
      branchSql(Prisma.sql`l."responsibleBranchId"`, this.support.branches(principal, permissions)),
    ];
    if (query.type) filters.push(Prisma.sql`a.type::text=${query.type}`);
    if (query.direction) filters.push(Prisma.sql`a.direction::text=${query.direction}`);
    return this.page(
      Prisma.sql`SELECT ARRAY[${instantKey(Prisma.sql`a."occurredAt"`)},a.id::text] AS key,(to_jsonb(a)-ARRAY['leadId','recordedByUserId','correlationId']) AS data FROM lead_activities a JOIN leads l ON l.id=a."leadId" WHERE ${clauses(filters)}`,
      query,
      'activities',
      this.scope(
        principal,
        permissions,
        { type: query.type, direction: query.direction },
        { id, branch: lead.responsibleBranchId },
      ),
      'desc',
    );
  }
  async assignments(principal: AuthenticatedPrincipal, id: string, query: CrmPageQueryDto) {
    const permissions = ['crm.lead.read', 'crm.assignment.read'];
    const lead = await this.support.lead(principal, id, permissions);
    return this.page(
      Prisma.sql`SELECT ARRAY[${instantKey(Prisma.sql`a."assignedFrom"`)},a.id::text] AS key,(to_jsonb(a)-ARRAY['leadId','actorUserId','correlationId'])||jsonb_build_object('employee',jsonb_build_object('id',e.id,'employeeNumber',e."employeeNumber",'displayName',p."displayName")) AS data FROM lead_assignments a JOIN leads l ON l.id=a."leadId" JOIN employees e ON e.id=a."employeeId" AND e."companyId"=l."companyId" JOIN parties p ON p.id=e."partyId" WHERE a."leadId"=${id}::uuid AND l."companyId"=${principal.companyId}::uuid AND ${branchSql(Prisma.sql`l."responsibleBranchId"`, this.support.branches(principal, permissions))}`,
      query,
      'assignments',
      this.scope(principal, permissions, {}, { id, branch: lead.responsibleBranchId }),
      'desc',
    );
  }
  async followUps(principal: AuthenticatedPrincipal, query: FollowUpListQueryDto, leadId?: string) {
    const permissions = ['crm.lead.read', 'crm.followup.read'];
    if (leadId) await this.support.lead(principal, leadId, permissions);
    const { cursor: ignored, limit: unused, ...filters } = query;
    void ignored;
    void unused;
    const scope = this.scope(principal, permissions, filters, { leadId });
    const cursor = this.cursors.decode(query.cursor, 'follow-ups', scope);
    const asOf = cursor?.asOf ?? new Date().toISOString();
    const conditions = [
      Prisma.sql`l."companyId"=${principal.companyId}::uuid`,
      branchSql(
        Prisma.sql`l."responsibleBranchId"`,
        this.support.branches(principal, permissions, query.branchId),
      ),
    ];
    if (leadId ?? query.leadId)
      conditions.push(Prisma.sql`f."leadId"=${leadId ?? query.leadId}::uuid`);
    if (query.state?.length)
      conditions.push(Prisma.sql`f.state::text IN (${Prisma.join(query.state)})`);
    if (query.derivedStatus === FollowUpDerivedStatus.OVERDUE)
      conditions.push(Prisma.sql`f.state='OPEN' AND f."dueAt"<${asOf}::timestamptz`);
    else if (query.derivedStatus === FollowUpDerivedStatus.OPEN)
      conditions.push(Prisma.sql`f.state='OPEN' AND f."dueAt">=${asOf}::timestamptz`);
    else if (query.derivedStatus) conditions.push(Prisma.sql`f.state::text=${query.derivedStatus}`);
    if (query.dueFrom) conditions.push(Prisma.sql`f."dueAt">=${query.dueFrom}::timestamptz`);
    if (query.dueTo) conditions.push(Prisma.sql`f."dueAt"<${query.dueTo}::timestamptz`);
    if (query.responsibleEmployeeId)
      conditions.push(Prisma.sql`f."responsibleEmployeeId"=${query.responsibleEmployeeId}::uuid`);
    if (query.search?.trim()) {
      const term = matchText(query.search);
      conditions.push(
        Prisma.sql`(f.subject ILIKE ${term} OR l."leadNumber" ILIKE ${term} OR l."displayName" ILIKE ${term})`,
      );
    }
    const base = Prisma.sql`SELECT ARRAY[${instantKey(Prisma.sql`f."dueAt"`)},f.id::text] AS key,(to_jsonb(f)-ARRAY['createdByUserId','outcomeActorUserId'])||jsonb_build_object('derivedStatus',CASE WHEN f.state='OPEN' AND f."dueAt"<${asOf}::timestamptz THEN 'OVERDUE' ELSE f.state::text END,'lead',jsonb_build_object('id',l.id,'leadNumber',l."leadNumber",'displayName',l."displayName",'stage',l.stage),'responsibleEmployee',jsonb_build_object('id',e.id,'employeeNumber',e."employeeNumber",'displayName',p."displayName")) AS data FROM lead_follow_ups f JOIN leads l ON l.id=f."leadId" JOIN employees e ON e.id=f."responsibleEmployeeId" AND e."companyId"=l."companyId" JOIN parties p ON p.id=e."partyId" WHERE ${clauses(conditions)}`;
    return {
      ...(await this.page(base, query, 'follow-ups', scope, 'asc', this.support.database, asOf)),
      asOf,
    };
  }
  async sources(principal: AuthenticatedPrincipal, query: SourceListQueryDto, options = false) {
    const permission = options ? 'crm.source.read' : 'crm.source.manage';
    if (!options) this.support.assertCompany(principal, permission);
    const filters = [Prisma.sql`s."companyId"=${principal.companyId}::uuid`];
    if (options) {
      filters.push(Prisma.sql`s.status='ACTIVE'`);
      if (this.support.branches(principal, [permission])?.length === 0)
        filters.push(Prisma.sql`FALSE`);
    } else if (query.status) filters.push(Prisma.sql`s.status::text=${query.status}`);
    if (query.search?.trim()) {
      const term = matchText(query.search);
      filters.push(Prisma.sql`(s.code ILIKE ${term} OR s.label ILIKE ${term})`);
    }
    const data = options
      ? Prisma.sql`jsonb_build_object('id',s.id,'code',s.code,'label',s.label)`
      : Prisma.sql`(to_jsonb(s)-ARRAY['companyId','createdByUserId'])||jsonb_build_object('usageCount',(SELECT count(*)::int FROM leads l WHERE l."sourceId"=s.id AND l."companyId"=${principal.companyId}::uuid))`;
    return this.page(
      Prisma.sql`SELECT ARRAY[lpad(s."sortOrder"::text,10,'0'),s.label,s.id::text] AS key,${data} AS data FROM lead_sources s WHERE ${clauses(filters)}`,
      query,
      options ? 'source-options' : 'sources',
      this.scope(principal, [permission], {
        search: query.search,
        status: options ? 'ACTIVE' : query.status,
      }),
    );
  }
}
