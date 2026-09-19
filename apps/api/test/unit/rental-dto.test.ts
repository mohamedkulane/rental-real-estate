import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PropertyType } from '@prisma/client';
import { uuidv7 } from '@rerms/shared';
import { describe, expect, it } from 'vitest';
import {
  AddBuyerDto,
  AddOwnerAndPropertyDto,
  AddRentalCustomerDto,
  AddRentalOwnerDto,
  AddRentalPropertyDto,
  CreateRentalLeaseDto,
  StartFullManagementDto,
  StartRentalBrokerageDto,
} from '../../src/rental/rental.dto';

describe('rental command input validation', () => {
  it('accepts a minimal owner payload', async () => {
    const dto = plainToInstance(AddRentalOwnerDto, {
      name: 'Ahmed Hassan',
      phone: '+252612345678',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts a whole-property rental payload', async () => {
    const dto = plainToInstance(AddRentalPropertyDto, {
      ownerPartyId: uuidv7(),
      name: 'Sunset Villa',
      propertyType: PropertyType.HOUSE,
      location: 'Hodan',
      monthlyRent: '450',
      hasMultipleUnits: 'false',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts a multi-unit building payload with rooms', async () => {
    const dto = plainToInstance(AddOwnerAndPropertyDto, {
      ownerName: 'Building Owner',
      ownerPhone: '+252611112222',
      name: 'Hodan Towers',
      propertyType: PropertyType.APARTMENT_BUILDING,
      location: 'Hodan',
      monthlyRent: '250',
      purpose: 'RENTAL',
      hasMultipleUnits: 'true',
      units: [
        { name: 'Apartment 1', monthlyRent: '250', rentMode: 'WHOLE', bedrooms: '2' },
        {
          name: 'Apartment 2',
          rentMode: 'BY_ROOMS',
          rooms: [
            { name: 'Room 1', monthlyRent: '100' },
            { name: 'Room 2', monthlyRent: '120' },
            { name: 'Room 3', monthlyRent: '110' },
            { name: 'Room 4', monthlyRent: '130' },
          ],
        },
      ],
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts a rental customer with multi-location preferences', async () => {
    const dto = plainToInstance(AddRentalCustomerDto, {
      name: 'Fatima Ali',
      phone: '+252612345678',
      propertyTypeWanted: 'Apartment',
      preferredLocations: ['Wadajir', 'Hodan'],
      minRentBudget: '200',
      maxRentBudget: '350',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts a buyer with multi-location preferences', async () => {
    const dto = plainToInstance(AddBuyerDto, {
      name: 'Omar Yusuf',
      phone: '+252619998877',
      propertyTypeWanted: 'Land',
      preferredLocations: ['Waaberi', 'Hodan'],
      minPurchaseBudget: '20000',
      maxPurchaseBudget: '45000',
      landWidth: '20',
      landLength: '30',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts brokerage with dual fees and full management with tenant fee', async () => {
    const ownerPartyId = uuidv7();
    const propertyId = uuidv7();
    const brokerage = plainToInstance(StartRentalBrokerageDto, {
      ownerPartyId,
      propertyId,
      monthlyRent: '500',
      fees: [
        { party: 'OWNER', method: 'PERCENT', amount: '10' },
        { party: 'TENANT', method: 'FIXED', amount: '300' },
      ],
    });
    const management = plainToInstance(StartFullManagementDto, {
      ownerPartyId,
      propertyId,
      monthlyRent: '500',
      managementFeePercent: '8',
      startDate: '2026-09-17',
      tenantBrokerageFee: '250',
      tenantBrokerageMethod: 'FIXED',
    });
    expect(await validate(brokerage)).toEqual([]);
    expect(await validate(management)).toEqual([]);
  });

  it('accepts a simplified lease payload', async () => {
    const dto = plainToInstance(CreateRentalLeaseDto, {
      leadId: uuidv7(),
      propertyId: uuidv7(),
      monthlyRent: '400',
      leaseStartDate: '2026-10-01',
      leaseEndDate: '2027-09-30',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects rental customer payloads missing required preferences', async () => {
    const dto = plainToInstance(AddRentalCustomerDto, {
      name: 'Test Lead',
      phone: '+252611111111',
      preferredLocations: ['Mogadishu'],
      minRentBudget: '500',
      maxRentBudget: '700',
    });
    expect((await validate(dto)).some((error) => error.property === 'propertyTypeWanted')).toBe(
      true,
    );
  });
});
