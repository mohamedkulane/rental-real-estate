-- Wipe all operational / portfolio / CRM / finance transaction data.
-- Preserves: companies, Head Office branch (after prune), roles/permissions (reseeded),
-- foundation employees are recreated by seed. Run before `pnpm db:seed`.

BEGIN;

TRUNCATE TABLE
  construction_work_package_dependencies,
  construction_progress_entries,
  construction_billing_events,
  construction_costs,
  construction_work_packages,
  construction_milestones,
  construction_budget_lines,
  construction_payment_terms,
  construction_contracts,
  construction_projects,
  development_output_assets,
  development_costs,
  development_budget_lines,
  development_plots,
  development_blocks,
  development_projects,
  construction_service_lead_preferences,
  rent_lead_preferences,
  buy_lead_preferences,
  sell_lead_preferences,
  lead_follow_up_outcomes,
  lead_follow_ups,
  lead_activities,
  lead_assignments,
  lead_branch_history,
  lead_stage_history,
  lead_intent_history,
  lead_preference_versions,
  leads,
  viewings,
  rental_applications,
  reservations,
  lease_parties,
  lease_possessions,
  lease_renewals,
  move_ins,
  lease_versions,
  leases,
  rental_agreements,
  sale_agreements,
  tenant_profiles,
  rental_listings,
  sale_listings,
  service_engagement_commercial_terms,
  service_engagement_history,
  service_engagements,
  billing_schedules,
  invoice_lines,
  payment_allocations,
  receipts,
  tenant_credits,
  charge_adjustments,
  charges,
  invoices,
  payments,
  owner_statement_lines,
  owner_payout_lines,
  owner_statements,
  owner_payouts,
  journal_source_links,
  journal_lines,
  journal_entries,
  expenses,
  brokerage_deals,
  sale_offer_events,
  sale_offers,
  sale_settlements,
  vendor_services,
  vendor_branch_availability,
  vendor_profiles,
  maintenance_activities,
  work_order_events,
  inspection_items,
  defect_issues,
  inspections,
  work_orders,
  maintenance_requests,
  property_amenities,
  space_amenities,
  land_space_profiles,
  residential_space_profiles,
  commercial_space_profiles,
  space_successors,
  rentable_space_parent_history,
  rentable_space_versions,
  rentable_spaces,
  property_owner_entitlements,
  property_ownerships,
  property_branch_assignments,
  property_lifecycle_history,
  buildings,
  properties,
  document_links,
  document_versions,
  documents,
  workflow_completions,
  workflow_commands,
  workflow_canonical_references,
  workflow_drafts,
  approval_decisions,
  approval_steps,
  approval_requests,
  audit_logs,
  notifications,
  portal_accounts,
  party_relationships,
  employee_roles,
  employee_branch_assignments,
  lead_sources,
  approval_rules,
  approval_policies
RESTART IDENTITY CASCADE;

DELETE FROM password_reset_tokens;
DELETE FROM sessions;
DELETE FROM employees;
DELETE FROM users;

DELETE FROM party_branch_assignments;
DELETE FROM owner_profiles WHERE "ownerNumber" NOT LIKE 'OWN-COMP-%';
DELETE FROM person_profiles;
DELETE FROM organization_profiles
WHERE "partyId" NOT IN (SELECT "legalPartyId" FROM companies WHERE "legalPartyId" IS NOT NULL);
DELETE FROM contact_points;
DELETE FROM addresses;
DELETE FROM parties
WHERE id NOT IN (SELECT "legalPartyId" FROM companies WHERE "legalPartyId" IS NOT NULL);

DELETE FROM branches WHERE code <> 'HQ';

COMMIT;
