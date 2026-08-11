UPDATE "employee_roles" er
SET "branchId" = (
  SELECT eba."branchId"
  FROM "employee_branch_assignments" eba
  WHERE eba."employeeId" = er."employeeId"
    AND eba."effectiveFrom" <= er."effectiveFrom"
    AND (eba."effectiveTo" IS NULL OR er."effectiveFrom" < eba."effectiveTo")
  ORDER BY eba."effectiveFrom" DESC, eba."branchId"
  LIMIT 1
)
WHERE er."branchId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "employee_branch_assignments" replacement
    WHERE replacement."employeeId" = er."employeeId"
      AND replacement."effectiveFrom" <= er."effectiveFrom"
      AND (replacement."effectiveTo" IS NULL OR er."effectiveFrom" < replacement."effectiveTo")
  )
  AND NOT EXISTS (
    SELECT 1 FROM "employee_branch_assignments" current_assignment
    WHERE current_assignment."employeeId" = er."employeeId"
      AND current_assignment."branchId" = er."branchId"
      AND current_assignment."effectiveFrom" <= er."effectiveFrom"
      AND (current_assignment."effectiveTo" IS NULL OR (er."effectiveTo" IS NOT NULL AND current_assignment."effectiveTo" >= er."effectiveTo"))
  );
CREATE OR REPLACE FUNCTION validate_employee_role_branch_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."branchId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "employee_branch_assignments" eba
    WHERE eba."employeeId" = NEW."employeeId"
      AND eba."branchId" = NEW."branchId"
      AND eba."effectiveFrom" <= NEW."effectiveFrom"
      AND (eba."effectiveTo" IS NULL OR (NEW."effectiveTo" IS NOT NULL AND eba."effectiveTo" >= NEW."effectiveTo"))
  ) THEN
    RAISE EXCEPTION 'Branch-scoped role must be contained by an Employee branch assignment';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "trg_employee_role_branch_scope"
  BEFORE INSERT OR UPDATE ON "employee_roles"
  FOR EACH ROW EXECUTE FUNCTION validate_employee_role_branch_scope();