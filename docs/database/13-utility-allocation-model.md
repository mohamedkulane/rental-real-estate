# Utility Allocation Model

`UtilityAccount` identifies provider/account and responsible property/space. `UtilityMeter` is attached to property/space with effective installation history; `UtilityMeterReading` stores timestamp/period, value, source, quality, and replacement/reset evidence. Utility types are configurable reference data.

`UtilityBill` stores source provider bill, period, currency, approved amount, document, and posting status. `UtilityAllocationRule` versions the method and eligibility configuration.

`UtilityAllocation` is an immutable approved run referencing bill/rule, totals, rounding/remainder policy, status, approval, and journal/source linkage. `UtilityAllocationInput` snapshots every eligible space's area, occupancy, meter start/end/usage, fixed amount, or custom percentage. `UtilityAllocationLine` stores factor, raw amount, rounded amount, recipient space/lease, and generated Charge.

Methods are `EQUAL`, `AREA_BASED`, `METERED`, `OCCUPANCY_BASED`, `FIXED_AMOUNT`, and `CUSTOM_PERCENTAGE`. Lines plus remainder cannot exceed source bill. Posted runs are corrected by reversal/reallocation, never edited.
