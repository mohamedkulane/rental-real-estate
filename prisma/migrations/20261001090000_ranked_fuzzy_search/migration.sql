CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS properties_name_trgm_idx
  ON properties USING gin ((translate(lower(name), '-_', '  ')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS properties_code_trgm_idx
  ON properties USING gin ((translate(lower("propertyCode"), '-_', '  ')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS parties_display_name_trgm_idx
  ON parties USING gin ((translate(lower("displayName"), '-_', '  ')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS leads_display_name_trgm_idx
  ON leads USING gin ((translate(lower("displayName"), '-_', '  ')) gin_trgm_ops);
