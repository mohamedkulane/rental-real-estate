# Property Model

Property is the legal/physical asset. It stores a company-unique code, physical classification, location, optional coordinates and plot measurement, status, timestamps, Buildings, ownership, operating-branch history, amenities, and RentableSpaces.

Property is not an occupancy target. A standalone Villa is represented as one Property and an `ENTIRE_PROPERTY` RentableSpace. Building remains optional for direct Property-to-space layouts.

Draft Properties may be incomplete during controlled setup. Active Properties must have exactly one operating branch and exact 100% effective ownership and payout entitlement held by active Owners.
