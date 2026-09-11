import { ConflictException } from '@nestjs/common';
import { WorkflowType } from '@prisma/client';
import type { WorkflowDraftPayloadDto } from './workflow.dto';

export function validateWorkflowProgress(
  type: WorkflowType,
  currentStep: number,
  payload: WorkflowDraftPayloadDto,
): void {
  if (type === WorkflowType.PROPERTY_ONBOARDING) {
    if (currentStep >= 2 && !payload.ownerPartyId)
      throw new ConflictException('Choose an Owner before continuing.');
    if (currentStep >= 3 && !payload.ownershipId && !payload.ownershipPlan)
      throw new ConflictException('Record the ownership shares before continuing.');
    if (currentStep >= 4 && !payload.ownershipId)
      throw new ConflictException('Save the Property and its ownership before continuing.');
    if (currentStep >= 4 && !payload.propertyId)
      throw new ConflictException('Choose a Property before continuing.');
    if (currentStep >= 6 && payload.rentableSpacesRequired && !payload.rentableSpaceIds?.length)
      throw new ConflictException('Add at least one Rentable Space before continuing.');
    if (currentStep >= 7 && payload.companyServiceRequired && !payload.serviceEngagementId)
      throw new ConflictException('Choose the Company Service before continuing.');
    return;
  }
  if (currentStep >= 2 && !payload.ownerPartyId && type !== WorkflowType.PROPERTY_SALE)
    throw new ConflictException('Choose an Owner before continuing.');
  if (currentStep >= 3 && !payload.propertyId)
    throw new ConflictException('Choose a Property before continuing.');
  if (type === WorkflowType.RENTAL_BROKERAGE) {
    if (currentStep >= 4 && !payload.rentableSpaceIds?.length)
      throw new ConflictException('Choose at least one Rentable Space before continuing.');
    if (currentStep >= 5 && !payload.serviceEngagementId)
      throw new ConflictException('Choose the Rental Brokerage Service before continuing.');
    if (currentStep >= 6 && !payload.readinessNotes?.trim())
      throw new ConflictException('Record brokerage readiness before continuing.');
  }
  if (type === WorkflowType.FULL_MANAGEMENT) {
    if (currentStep >= 4 && !payload.ownershipId)
      throw new ConflictException('Confirm Ownership eligibility before continuing.');
    if (currentStep >= 5 && !payload.rentableSpaceIds?.length)
      throw new ConflictException('Choose at least one Rentable Space before continuing.');
    if (currentStep >= 6 && !payload.serviceEngagementId)
      throw new ConflictException('Choose the Full Management Service before continuing.');
    if (currentStep >= 7 && !payload.managementTerms?.trim())
      throw new ConflictException('Record management terms before continuing.');
  }
  if (type === WorkflowType.PROPERTY_SALE) {
    if (currentStep >= 5 && !payload.serviceEngagementId)
      throw new ConflictException('Choose Sale authority before continuing.');
    if (currentStep >= 6 && !payload.readinessNotes?.trim())
      throw new ConflictException('Record sale readiness before continuing.');
  }
}
