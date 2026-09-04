import { BadRequestException, ValidationPipe, VersioningType, type ExecutionContext, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmController } from '../../src/crm/crm.controller';
import { CrmLeadService } from '../../src/crm/crm-lead.service';
import { CrmReadService } from '../../src/crm/crm-read.service';
import { CrmOperationsService } from '../../src/crm/crm-operations.service';
import { CrmSelectorsService } from '../../src/crm/crm-selectors.service';
import { CrmSearchGuard } from '../../src/crm/crm-http';
import { SessionAuthGuard } from '../../src/security/session-auth.guard';
import type { AuthenticatedRequest } from '../../src/security/security.types';

describe('Phase 5.2 CRM HTTP validation and permission boundary',()=>{
  let app:INestApplication;let permissions:Set<string>;
  const reads={list:vi.fn(),activities:vi.fn()};const operations={updateFollowUp:vi.fn()};
  const id='01912345-1234-7123-8123-123456789012';
  beforeAll(async()=>{
    const module=await Test.createTestingModule({controllers:[CrmController],providers:[
      {provide:CrmLeadService,useValue:{}},{provide:CrmOperationsService,useValue:operations},
      {provide:CrmReadService,useValue:reads},{provide:CrmSelectorsService,useValue:{}},
    ]}).overrideGuard(SessionAuthGuard).useValue({canActivate(context:ExecutionContext){context.switchToHttp().getRequest<AuthenticatedRequest>().principal={permissions} as unknown as AuthenticatedRequest['principal'];return true;}})
      .overrideGuard(CrmSearchGuard).useValue({canActivate:()=>true}).compile();
    app=module.createNestApplication();app.setGlobalPrefix('api');app.enableVersioning({type:VersioningType.URI});
    app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));await app.init();
  });
  beforeEach(()=>{permissions=new Set(['crm.lead.read']);vi.clearAllMocks();reads.list.mockResolvedValue({items:[],pageInfo:{hasNextPage:false,nextCursor:null},totalCount:0});});
  afterAll(async()=>app?.close());
  it('normalizes singleton/repeated unbracketed query filters and keeps a bounded page',async()=>{
    await request(app.getHttpServer()).get('/api/v1/crm/leads?stage=NEW&stage=CONTACTED&limit=2').expect(200);
    expect(reads.list.mock.calls[0]?.[1]).toMatchObject({stage:['NEW','CONTACTED'],limit:2});
    await request(app.getHttpServer()).get('/api/v1/crm/leads?limit=100').expect(400);
  });
  it('requires both Lead-read and child-read on HTTP collection routes',async()=>{
    permissions=new Set(['crm.activity.read']);await request(app.getHttpServer()).get(`/api/v1/crm/leads/${id}/activities`).expect(403);expect(reads.activities).not.toHaveBeenCalled();
  });
  it('rejects immutable Follow-up responsibility and unknown DTO fields',async()=>{
    permissions=new Set(['crm.followup.update']);await request(app.getHttpServer()).patch(`/api/v1/crm/leads/${id}/follow-ups/${id}`).send({expectedVersion:1,reason:'reschedule',responsibleEmployeeId:id}).expect(400);expect(operations.updateFollowUp).not.toHaveBeenCalled();
  });
  it('returns only fixed safe error fields without submitted protected terms',async()=>{
    reads.list.mockRejectedValueOnce(new BadRequestException('secret-contact@example.test'));
    const response=await request(app.getHttpServer()).get('/api/v1/crm/leads?search=secret-contact@example.test').expect(400);
    expect(JSON.stringify(response.body)).not.toContain('secret-contact');expect(response.body).toMatchObject({code:'CRM_VALIDATION_FAILED',details:[]});
  });
});
