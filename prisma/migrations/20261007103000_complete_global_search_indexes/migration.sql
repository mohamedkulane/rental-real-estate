CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS rentable_spaces_search_trgm_idx
  ON rentable_spaces USING gin ((translate(lower("spaceCode" || ' ' || name), '-_', '  ')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leads_number_search_trgm_idx
  ON leads USING gin ((translate(lower("leadNumber"), '-_', '  ')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS leases_number_search_trgm_idx
  ON leases USING gin ((translate(lower("leaseNumber"), '-_', '  ')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS payments_reference_search_trgm_idx
  ON payments USING gin ((translate(lower("paymentNumber" || ' ' || COALESCE("externalRef", '')), '-_', '  ')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sale_agreements_number_search_trgm_idx
  ON sale_agreements USING gin ((translate(lower("agreementNumber"), '-_', '  ')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sale_settlements_number_search_trgm_idx
  ON sale_settlements USING gin ((translate(lower("settlementNumber"), '-_', '  ')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS maintenance_requests_search_trgm_idx
  ON maintenance_requests USING gin ((translate(lower("requestNumber" || ' ' || title), '-_', '  ')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS work_orders_number_search_trgm_idx
  ON work_orders USING gin ((translate(lower("workOrderNumber"), '-_', '  ')) gin_trgm_ops);
