DO $$
DECLARE
  table_name text;
  row_count bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'construction_projects',
    'construction_contracts',
    'construction_payment_terms',
    'construction_budget_lines',
    'construction_milestones',
    'construction_work_packages',
    'construction_work_package_dependencies',
    'construction_progress_entries',
    'construction_costs',
    'construction_billing_events',
    'construction_service_lead_preferences'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', table_name) INTO row_count;
      RAISE NOTICE 'Removing legacy Construction table %, rows detected: %', table_name, row_count;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS "construction_billing_events" CASCADE;
DROP TABLE IF EXISTS "construction_costs" CASCADE;
DROP TABLE IF EXISTS "construction_progress_entries" CASCADE;
DROP TABLE IF EXISTS "construction_work_package_dependencies" CASCADE;
DROP TABLE IF EXISTS "construction_work_packages" CASCADE;
DROP TABLE IF EXISTS "construction_milestones" CASCADE;
DROP TABLE IF EXISTS "construction_budget_lines" CASCADE;
DROP TABLE IF EXISTS "construction_payment_terms" CASCADE;
DROP TABLE IF EXISTS "construction_contracts" CASCADE;
DROP TABLE IF EXISTS "construction_projects" CASCADE;
DROP TABLE IF EXISTS "construction_service_lead_preferences" CASCADE;

DROP SEQUENCE IF EXISTS construction_project_record_number_seq;
DROP SEQUENCE IF EXISTS construction_contract_record_number_seq;
