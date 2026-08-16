DROP TABLE IF EXISTS "user_permission_overrides";

DELETE FROM "permissions"
WHERE "code" IN (
  'identity.user.privilege.read',
  'identity.user.privilege.manage'
);