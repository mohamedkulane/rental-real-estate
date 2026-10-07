import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PermissionGuard } from '../security/permission.guard';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { GeneratedDocumentService } from './generated-document.service';

@Controller({ path: 'generated-documents', version: '1' })
@UseGuards(SessionAuthGuard, PermissionGuard)
export class GeneratedDocumentController {
  constructor(private readonly documents: GeneratedDocumentService) {}

  private response(file: { body: Buffer; fileName: string }, response: Response) {
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(file.body);
  }

  @Get('leases/:id')
  async lease(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.response(await this.documents.lease(request.principal, id), response);
  }

  @Get('sale-agreements/:id')
  async saleAgreement(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.response(await this.documents.saleAgreement(request.principal, id), response);
  }

  @Get('payments/:id')
  async paymentReceipt(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.response(await this.documents.paymentReceipt(request.principal, id), response);
  }

  @Get('owner-statements/:id')
  async ownerStatement(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.response(await this.documents.ownerStatement(request.principal, id), response);
  }
}
