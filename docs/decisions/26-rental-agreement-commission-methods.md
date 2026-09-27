# Rental agreement commission methods

## Decision

Rental agreement commission fields must expose their calculation method next
to the value. The default method in the placement form is **Fixed USD**, so an
entry such as `40` means USD 40 and is not silently interpreted as 40 percent
of monthly rent. Staff may explicitly choose **Percent** when the commercial
terms are percentage-based.

The backend remains the authority for the calculation. Confirmed agreements
and their commission receivables are not overwritten; a correction to an
already confirmed or posted agreement must use the existing financial
adjustment or reversal process and retain the original audit history.
