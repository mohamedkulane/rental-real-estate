import { randomUUID } from 'node:crypto';
import { BranchAccessMode, PrismaClient } from '@prisma/client';
import type { ApiEnvironment } from '@rerms/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CrmSupportService } from '../../src/crm/crm-support.service';
import { CrmContactService } from '../../src/crm/crm-contact.service';
import { CrmCursorService } from '../../src/crm/crm-cursor.service';
import { CrmLeadService } from '../../src/crm/crm-lead.service';
import { CrmReadService } from '../../src/crm/crm-read.service';
import { CrmOperationsService } from '../../src/crm/crm-operations.service';
import { AuthorizationService } from '../../src/security/authorization.service';
import { AuditService } from '../../src/governance/audit.service';
import type { AuthenticatedPrincipal } from '../../src/security/security.types';

const url=process.env.CRM_TEST_DATABASE_URL;
const env={PARTY_DATA_ENCRYPTION_KEY_VERSION:'v1',PARTY_DATA_ENCRYPTION_KEY:'11'.repeat(32),PARTY_DATA_DECRYPTION_KEYS:'',PARTY_CONTACT_LOOKUP_KEY:'22'.repeat(32)} as ApiEnvironment;
const permissions=['crm.lead.read','crm.lead.create','crm.lead.update','crm.lead.contact.read','crm.source.manage','crm.source.read','crm.activity.create','crm.activity.read','crm.followup.create','crm.followup.read','crm.followup.complete'];

describe.skipIf(!url)('Phase 5.2 CRM API database behavior',()=>{
  const queries:string[]=[];let database:PrismaClient;let actor:AuthenticatedPrincipal;let sourceId:string;let branchId:string;
  let leads:CrmLeadService;let read:CrmReadService;let operations:CrmOperationsService;const ids:string[]=[];
  beforeAll(async()=>{
    if(!url||!/^\/rerms_p502_[a-z0-9_]+$/.test(new URL(url).pathname))throw new Error('CRM tests require a dedicated rerms_p502_ database');
    database=new PrismaClient({datasourceUrl:url,log:[{emit:'event',level:'query'}],transactionOptions:{timeout:60000}});
    database.$on('query' as never,((event:{query:string})=>{if(/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(event.query.trim()))queries.push(event.query);}));
    const company=await database.company.findFirstOrThrow();const branch=await database.branch.findFirstOrThrow({where:{companyId:company.id,active:true}});branchId=branch.id;
    const user=await database.user.findFirstOrThrow();
    const employee=await database.employee.findFirstOrThrow({where:{userId:user.id,companyId:company.id}});
    actor={userId:user.id,employeeId:employee.id,sessionId:randomUUID(),companyId:company.id,businessDate:'2026-09-01',accessMode:BranchAccessMode.COMPANY_WIDE,roles:[],permissions:new Set(permissions),permissionBranchScopes:new Map(permissions.map((p)=>[p,new Set([null])])),branchIds:new Set([branchId])};
    const support=new CrmSupportService(database as never,new AuthorizationService(),new AuditService());const contacts=new CrmContactService(env);
    leads=new CrmLeadService(support,contacts);read=new CrmReadService(support,new CrmCursorService(env),contacts);operations=new CrmOperationsService(support);
    sourceId=(await operations.createSource(actor,{code:`API_${randomUUID().slice(0,8).toUpperCase()}`,label:'CRM API integration'})).id;
    for(let i=0;i<6;i++)ids.push((await leads.create(actor,{intent:'RENT',sourceId,responsibleBranchId:branchId,displayName:`Pagination fixture ${i}`,phone:`+25470090000${i}`,preference:{maxRent:'9999999999999999.1234',currency:'USD'}})).id);
  },120000);
  afterAll(async()=>database?.$disconnect());

  it('paginates beyond one page with exact totals, opaque cursors and no duplicate boundary row',async()=>{
    const first=await read.list(actor,{limit:2,sourceId:[sourceId]});expect(first.totalCount).toBe(6);expect(first.items).toHaveLength(2);expect(first.pageInfo.hasNextPage).toBe(true);
    const second=await read.list(actor,{limit:2,sourceId:[sourceId],cursor:first.pageInfo.nextCursor!});
    expect(second.totalCount).toBe(6);expect(new Set([...first.items,...second.items].map((r)=>(r as unknown as {id:string}).id)).size).toBe(4);
    await expect(read.list(actor,{limit:2,search:'different',sourceId:[sourceId],cursor:first.pageInfo.nextCursor!})).rejects.toThrow('CRM_VALIDATION_FAILED');
  });
  it('has constant register query count and independent pipeline lanes/totals',async()=>{
    queries.length=0;await read.list(actor,{limit:1,sourceId:[sourceId]});const one=queries.length;
    queries.length=0;await read.list(actor,{limit:50,sourceId:[sourceId]});expect(queries.length).toBe(one);expect(one).toBeLessThanOrEqual(3);
    const lanes=await read.pipeline(actor,{limit:2,sourceId:[sourceId]});expect(lanes.stageTotals.NEW).toBe(6);expect(lanes.groups.NEW?.items).toHaveLength(2);
    const next=await read.pipeline(actor,{limit:2,sourceId:[sourceId],pipelineStage:'NEW',cursor:lanes.groups.NEW!.pageInfo.nextCursor!});expect(Object.keys(next.groups)).toEqual(['NEW']);expect(next.totalCount).toBe(6);
  });
  it('keeps contact reveal audited, decimal strings exact and acknowledgements minimal',async()=>{
    queries.length=0;const detail=await read.get(actor,ids[0]!);expect(queries.length).toBeLessThanOrEqual(8);
    expect(detail.preference.maxRent).toBe('9999999999999999.1234');expect(detail.contact).toHaveProperty('phone');
    expect(await database.auditLog.count({where:{entityId:ids[0]!,action:'crm.lead.contact.revealed'}})).toBeGreaterThan(0);
    const masked=await read.get({...actor,permissions:new Set(['crm.lead.read'])},ids[0]!);expect(masked.contact).not.toHaveProperty('phone');
    const ack=await leads.update(actor,ids[0]!,{expectedVersion:1,reason:'Correct label',displayName:'Corrected label'});expect(Object.keys(ack).sort()).toEqual(['id','version']);
  });
  it('serializes concurrent expected-version commands to exactly one winner',async()=>{
    const results=await Promise.allSettled(['First','Second'].map((displayName)=>leads.update(actor,ids[1]!,{expectedVersion:1,reason:'Concurrent correction',displayName})));
    expect(results.filter((r)=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter((r)=>r.status==='rejected')).toHaveLength(1);
    expect((await database.lead.findUniqueOrThrow({where:{id:ids[1]!}})).version).toBe(2);
  });
  it('applies company and conjunctive branch scopes to list/count and child reads',async()=>{
    expect((await read.list({...actor,companyId:randomUUID()},{limit:25,sourceId:[sourceId]})).totalCount).toBe(0);
    const disjoint={...actor,permissionBranchScopes:new Map([['crm.lead.read',new Set([branchId])],['crm.activity.read',new Set([randomUUID()])]])};
    await expect(read.activities(disjoint,ids[2]!,{limit:25})).rejects.toThrow();
    expect((await read.followUps({...actor,permissions:new Set(['crm.followup.read'])},{limit:25})).totalCount).toBe(0);
  });
});
