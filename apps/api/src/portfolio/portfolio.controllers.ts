import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { CursorPageQueryDto } from '../common/cursor-pagination';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { PartyService } from './party.service';
import { PortfolioService } from './portfolio.service';
import {
  AmenityAssignmentDto,
  BuildingLifecycleDto,
  CorrectMeasurementDto,
  CreateAmenityDto,
  CreateBuildingDto,
  CreateDocumentMetadataDto,
  CreateOwnerDto,
  CreatePartyDto,
  CreatePropertyDto,
  CreateSpaceDto,
  DiscardPropertyDraftDto,
  PartitionSpaceDto,
  PropertyLifecycleTransitionDto,
  ListDocumentsQueryDto,
  ListBuildingsQueryDto,
  ListPropertyOwnershipsQueryDto,
  ListPropertyBranchHistoryQueryDto,
  ListPropertyActivityQueryDto,
  ListPropertyAmenitiesQueryDto,
  ListSpacesQueryDto,
  ReplaceOwnershipDto,
  ReparentSpaceDto,
  RetireSpaceDto,
  TransferPropertyBranchDto,
  UpdateAmenityDto,
  UpdateBuildingDto,
  UpdateDocumentMetadataDto,
  UpdateOwnerDto,
  UpdatePartyDto,
  UpdatePropertyDto,
} from './portfolio.dto';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'parties', version: '1' })
export class PartyController {
  constructor(private readonly parties: PartyService) {}
  @Get() @RequirePermissions('party.read') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: CursorPageQueryDto,
  ) {
    return this.parties.list(request.principal, query);
  }
  @Get(':partyId') @RequirePermissions('party.read') get(
    @Req() request: AuthenticatedRequest,
    @Param('partyId', ParseUUIDPipe) partyId: string,
  ) {
    return this.parties.get(request.principal, partyId);
  }
  @Post() @RequirePermissions('party.create') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreatePartyDto,
  ) {
    return this.parties.create(request.principal, input, request.correlationId);
  }
  @Patch(':partyId') @RequirePermissions('party.update') update(
    @Req() request: AuthenticatedRequest,
    @Param('partyId', ParseUUIDPipe) partyId: string,
    @Body() input: UpdatePartyDto,
  ) {
    return this.parties.update(request.principal, partyId, input, request.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'owners', version: '1' })
export class OwnerController {
  constructor(private readonly parties: PartyService) {}
  @Get() @RequirePermissions('owner.read') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: CursorPageQueryDto,
  ) {
    return this.parties.listOwners(request.principal, query);
  }
  @Get(':partyId') @RequirePermissions('owner.read') get(
    @Req() request: AuthenticatedRequest,
    @Param('partyId', ParseUUIDPipe) partyId: string,
  ) {
    return this.parties.getOwner(request.principal, partyId);
  }
  @Post() @RequirePermissions('owner.create') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateOwnerDto,
  ) {
    return this.parties.createOwner(request.principal, input, request.correlationId);
  }
  @Patch(':partyId') @RequirePermissions('owner.update') update(
    @Req() request: AuthenticatedRequest,
    @Param('partyId', ParseUUIDPipe) partyId: string,
    @Body() input: UpdateOwnerDto,
  ) {
    return this.parties.updateOwner(request.principal, partyId, input, request.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'properties', version: '1' })
export class PropertyController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get() @RequirePermissions('portfolio.property.read') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: CursorPageQueryDto,
  ) {
    return this.portfolio.listProperties(request.principal, query);
  }
  @Get(':propertyId') @RequirePermissions('portfolio.property.read') get(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.portfolio.getProperty(request.principal, propertyId);
  }
  @Post() @RequirePermissions('portfolio.property.create') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreatePropertyDto,
  ) {
    return this.portfolio.createProperty(request.principal, input, request.correlationId);
  }
  @Patch(':propertyId') @RequirePermissions('portfolio.property.update') update(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: UpdatePropertyDto,
  ) {
    return this.portfolio.updateProperty(
      request.principal,
      propertyId,
      input,
      request.correlationId,
    );
  }
  @Post(':propertyId/activate') @RequirePermissions('portfolio.property.update') activate(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: PropertyLifecycleTransitionDto,
  ) {
    return this.portfolio.transitionProperty(
      request.principal,
      propertyId,
      PropertyStatus.ACTIVE,
      input,
      request.correlationId,
    );
  }
  @Post(':propertyId/deactivate') @RequirePermissions('portfolio.property.update') deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: PropertyLifecycleTransitionDto,
  ) {
    return this.portfolio.transitionProperty(
      request.principal,
      propertyId,
      PropertyStatus.INACTIVE,
      input,
      request.correlationId,
    );
  }
  @Post(':propertyId/reactivate') @RequirePermissions('portfolio.property.update') reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: PropertyLifecycleTransitionDto,
  ) {
    return this.portfolio.transitionProperty(
      request.principal,
      propertyId,
      PropertyStatus.ACTIVE,
      input,
      request.correlationId,
    );
  }
  @Post(':propertyId/retire') @RequirePermissions('portfolio.property.update') retire(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: PropertyLifecycleTransitionDto,
  ) {
    return this.portfolio.transitionProperty(
      request.principal,
      propertyId,
      PropertyStatus.RETIRED,
      input,
      request.correlationId,
    );
  }
  @Delete(':propertyId/draft') @RequirePermissions('portfolio.property.update') discardDraft(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: DiscardPropertyDraftDto,
  ) {
    return this.portfolio.discardPropertyDraft(
      request.principal,
      propertyId,
      input,
      request.correlationId,
    );
  }
  @Post(':propertyId/branch-transfers') @RequirePermissions('portfolio.property.update') transfer(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: TransferPropertyBranchDto,
  ) {
    return this.portfolio.transferBranch(
      request.principal,
      propertyId,
      input,
      request.correlationId,
    );
  }
  @Get(':propertyId/ownership') @RequirePermissions('portfolio.ownership.read') ownership(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.portfolio.getOwnership(request.principal, propertyId);
  }
  @Put(':propertyId/ownership') @RequirePermissions('portfolio.ownership.manage') replaceOwnership(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: ReplaceOwnershipDto,
  ) {
    return this.portfolio.replaceOwnership(
      request.principal,
      propertyId,
      input,
      request.correlationId,
    );
  }
  @Get(':propertyId/buildings')
  @RequirePermissions('portfolio.building.read')
  buildings(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    return this.portfolio.listBuildings(request.principal, propertyId);
  }
  @Post(':propertyId/buildings') @RequirePermissions('portfolio.building.manage') building(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: CreateBuildingDto,
  ) {
    return this.portfolio.createBuilding(
      request.principal,
      propertyId,
      input,
      request.correlationId,
    );
  }
  @Post(':propertyId/amenities') @RequirePermissions('portfolio.amenity.manage') amenity(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() input: AmenityAssignmentDto,
  ) {
    return this.portfolio.assignPropertyAmenity(
      request.principal,
      propertyId,
      input,
      request.correlationId,
    );
  }
  @Delete(':propertyId/amenities/:amenityId')
  @RequirePermissions('portfolio.amenity.manage')
  removeAmenity(
    @Req() request: AuthenticatedRequest,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
  ) {
    return this.portfolio.removePropertyAmenity(
      request.principal,
      propertyId,
      amenityId,
      request.correlationId,
    );
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'buildings', version: '1' })
export class BuildingController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  @RequirePermissions('portfolio.building.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListBuildingsQueryDto) {
    return this.portfolio.listBuildingWorkspace(request.principal, query);
  }
  @Get(':buildingId')
  @RequirePermissions('portfolio.building.read')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
  ) {
    return this.portfolio.getBuilding(request.principal, buildingId);
  }

  @Patch(':buildingId')
  @RequirePermissions('portfolio.building.manage')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() input: UpdateBuildingDto,
  ) {
    return this.portfolio.updateBuilding(
      request.principal,
      buildingId,
      input,
      request.correlationId,
    );
  }

  @Post(':buildingId/status')
  @RequirePermissions('portfolio.building.manage')
  transition(
    @Req() request: AuthenticatedRequest,
    @Param('buildingId', ParseUUIDPipe) buildingId: string,
    @Body() input: BuildingLifecycleDto,
  ) {
    return this.portfolio.transitionBuilding(
      request.principal,
      buildingId,
      input,
      request.correlationId,
    );
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'rentable-spaces', version: '1' })
export class RentableSpaceController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get('types') @RequirePermissions('portfolio.space.read') types() {
    return this.portfolio.listSpaceTypes();
  }
  @Get() @RequirePermissions('portfolio.space.read') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListSpacesQueryDto,
  ) {
    return this.portfolio.listSpaces(request.principal, query);
  }
  @Get(':spaceId') @RequirePermissions('portfolio.space.read') get(
    @Req() request: AuthenticatedRequest,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
  ) {
    return this.portfolio.getSpace(request.principal, spaceId);
  }
  @Post() @RequirePermissions('portfolio.space.create') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateSpaceDto,
  ) {
    return this.portfolio.createSpace(request.principal, input, request.correlationId);
  }
  @Post(':spaceId/partition') @RequirePermissions('portfolio.space.partition') partition(
    @Req() request: AuthenticatedRequest,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() input: PartitionSpaceDto,
  ) {
    return this.portfolio.partition(request.principal, spaceId, input, request.correlationId);
  }
  @Post(':spaceId/measurements') @RequirePermissions('portfolio.space.update') measurement(
    @Req() request: AuthenticatedRequest,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() input: CorrectMeasurementDto,
  ) {
    return this.portfolio.correctMeasurement(
      request.principal,
      spaceId,
      input,
      request.correlationId,
    );
  }
  @Post(':spaceId/parent') @RequirePermissions('portfolio.space.update') reparent(
    @Req() request: AuthenticatedRequest,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() input: ReparentSpaceDto,
  ) {
    return this.portfolio.reparent(request.principal, spaceId, input, request.correlationId);
  }
  @Post(':spaceId/retire') @RequirePermissions('portfolio.space.update') retire(
    @Req() request: AuthenticatedRequest,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() input: RetireSpaceDto,
  ) {
    return this.portfolio.retire(request.principal, spaceId, input, request.correlationId);
  }
  @Post(':spaceId/amenities') @RequirePermissions('portfolio.amenity.manage') amenity(
    @Req() request: AuthenticatedRequest,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() input: AmenityAssignmentDto,
  ) {
    return this.portfolio.assignSpaceAmenity(
      request.principal,
      spaceId,
      input,
      request.correlationId,
    );
  }
  @Delete(':spaceId/amenities/:amenityId')
  @RequirePermissions('portfolio.amenity.manage')
  removeAmenity(
    @Req() request: AuthenticatedRequest,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
  ) {
    return this.portfolio.removeSpaceAmenity(
      request.principal,
      spaceId,
      amenityId,
      request.correlationId,
    );
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'amenities', version: '1' })
export class AmenityController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get() @RequirePermissions('portfolio.amenity.read') list() {
    return this.portfolio.listAmenities();
  }
  @Post() @RequirePermissions('portfolio.amenity.manage') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateAmenityDto,
  ) {
    return this.portfolio.createAmenity(request.principal, input, request.correlationId);
  }
  @Patch(':amenityId') @RequirePermissions('portfolio.amenity.manage') update(
    @Req() request: AuthenticatedRequest,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
    @Body() input: UpdateAmenityDto,
  ) {
    return this.portfolio.updateAmenity(request.principal, amenityId, input, request.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'portfolio-documents', version: '1' })
export class PortfolioDocumentController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get()
  @RequirePermissions('portfolio.document.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListDocumentsQueryDto) {
    return this.portfolio.listDocuments(request.principal, query);
  }

  @Get(':documentId')
  @RequirePermissions('portfolio.document.read')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.portfolio.getDocument(request.principal, documentId);
  }

  @Patch(':documentId')
  @RequirePermissions('portfolio.document.manage')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() input: UpdateDocumentMetadataDto,
  ) {
    return this.portfolio.updateDocument(
      request.principal,
      documentId,
      input,
      request.correlationId,
    );
  }
  @Post() @RequirePermissions('portfolio.document.manage') create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateDocumentMetadataDto,
  ) {
    return this.portfolio.createDocument(request.principal, input, request.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'property-ownerships', version: '1' })
export class PropertyOwnershipController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get() @RequirePermissions('portfolio.ownership.read') list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListPropertyOwnershipsQueryDto,
  ) {
    return this.portfolio.listPropertyOwnerships(request.principal, query);
  }
}
@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'property-amenities', version: '1' })
export class PropertyAmenityController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  @RequirePermissions('portfolio.amenity.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListPropertyAmenitiesQueryDto) {
    return this.portfolio.listPropertyAmenities(request.principal, query);
  }
}
@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'property-branch-history', version: '1' })
export class PropertyBranchHistoryController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  @RequirePermissions('portfolio.property.read')
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListPropertyBranchHistoryQueryDto,
  ) {
    return this.portfolio.listPropertyBranchHistory(request.principal, query);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'property-activity', version: '1' })
export class PropertyActivityController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  @RequirePermissions('portfolio.property.read')
  list(@Req() request: AuthenticatedRequest, @Query() query: ListPropertyActivityQueryDto) {
    return this.portfolio.listPropertyActivity(request.principal, query);
  }
}