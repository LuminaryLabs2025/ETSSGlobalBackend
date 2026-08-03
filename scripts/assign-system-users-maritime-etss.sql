-- =============================================================================
-- Assign all SYSTEM users to the Maritime ETSS platform company
-- Safe to re-run (idempotent).
-- =============================================================================

BEGIN;

-- 1) Create the platform company if it does not already exist
INSERT INTO companies (id, name, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Maritime ETSS', true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE name = 'Maritime ETSS'
);

-- 2) Point every SYSTEM user at Maritime ETSS
--    Matches:
--      • account_type = 'SYSTEM'
--      • OR user_type.category = 'SYSTEM'
UPDATE users u
SET
  company_id = c.id,
  updated_at = NOW()
FROM companies c
WHERE c.name = 'Maritime ETSS'
  AND (
    u.account_type = 'SYSTEM'
    OR EXISTS (
      SELECT 1
      FROM user_types ut
      WHERE ut.id = u.user_type_id
        AND ut.category = 'SYSTEM'
    )
  )
  AND (u.company_id IS DISTINCT FROM c.id);

COMMIT;

-- Optional verification
-- SELECT u.email, u.account_type, ut.name AS user_type, ut.category, c.name AS company
-- FROM users u
-- LEFT JOIN user_types ut ON ut.id = u.user_type_id
-- LEFT JOIN companies c ON c.id = u.company_id
-- WHERE u.account_type = 'SYSTEM' OR ut.category = 'SYSTEM'
-- ORDER BY u.email;
