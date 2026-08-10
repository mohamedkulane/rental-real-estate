CREATE SEQUENCE IF NOT EXISTS branch_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS employee_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS party_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS owner_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS property_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS space_record_number_seq START WITH 1 INCREMENT BY 1;

SELECT setval(
  'branch_record_number_seq',
  COALESCE(MAX(substring(code FROM '^BR-([0-9]+)$')::bigint), 0) + 1,
  false
) FROM branches WHERE code ~ '^BR-[0-9]+$';

SELECT setval(
  'employee_record_number_seq',
  COALESCE(MAX(substring("employeeNumber" FROM '^EMP-([0-9]+)$')::bigint), 0) + 1,
  false
) FROM employees WHERE "employeeNumber" ~ '^EMP-[0-9]+$';

SELECT setval(
  'party_record_number_seq',
  COALESCE(MAX(substring("partyNumber" FROM '^PTY-([0-9]+)$')::bigint), 0) + 1,
  false
) FROM parties WHERE "partyNumber" ~ '^PTY-[0-9]+$';

SELECT setval(
  'owner_record_number_seq',
  COALESCE(MAX(substring("ownerNumber" FROM '^OWN-([0-9]+)$')::bigint), 0) + 1,
  false
) FROM owner_profiles WHERE "ownerNumber" ~ '^OWN-[0-9]+$';

SELECT setval(
  'property_record_number_seq',
  COALESCE(MAX(substring("propertyCode" FROM '^PROP-([0-9]+)$')::bigint), 0) + 1,
  false
) FROM properties WHERE "propertyCode" ~ '^PROP-[0-9]+$';

SELECT setval(
  'space_record_number_seq',
  COALESCE(MAX(substring("spaceCode" FROM '^UNIT-([0-9]+)$')::bigint), 0) + 1,
  false
) FROM rentable_spaces WHERE "spaceCode" ~ '^UNIT-[0-9]+$';
