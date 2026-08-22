import { Module } from '@nestjs/common';
import { Phase3Module } from './phase3.module';
import {
  AmenityController,
  BuildingController,
  OwnerController,
  PartyController,
  PortfolioDocumentController,
  PropertyController,
  PropertyOwnershipController,
  PropertyBranchHistoryController,
  PropertyActivityController,
  PropertyAmenityController,
  RentableSpaceController,
} from './portfolio/portfolio.controllers';
import { PartyCryptoService } from './portfolio/party-crypto.service';
import { PartyService } from './portfolio/party.service';
import { PortfolioService } from './portfolio/portfolio.service';
import { ObjectStorageService } from './portfolio/object-storage.service';

@Module({
  imports: [Phase3Module],
  controllers: [
    PartyController,
    OwnerController,
    BuildingController,
    PropertyController,
    PropertyOwnershipController,
    PropertyBranchHistoryController,
    PropertyActivityController,
    PropertyAmenityController,
    RentableSpaceController,
    AmenityController,
    PortfolioDocumentController,
  ],
  providers: [PartyCryptoService, PartyService, PortfolioService, ObjectStorageService],
})
export class Phase4Module {}
