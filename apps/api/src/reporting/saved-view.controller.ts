import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { CreateSavedViewDto, SavedViewQueryDto, UpdateSavedViewDto } from './saved-view.dto';
import { SavedViewService } from './saved-view.service';

@Controller({ path: 'saved-views', version: '1' })
@UseGuards(SessionAuthGuard)
export class SavedViewController {
  constructor(private readonly savedViews: SavedViewService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: SavedViewQueryDto) {
    return this.savedViews.list(request.principal, query.workspace);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() input: CreateSavedViewDto) {
    return this.savedViews.create(request.principal, input);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateSavedViewDto,
  ) {
    return this.savedViews.update(request.principal, id, input);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.savedViews.remove(request.principal, id);
  }
}
