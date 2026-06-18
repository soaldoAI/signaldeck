-- Allow multiple accounts per connector (e.g. work + personal Gmail).
DROP INDEX IF EXISTS "connector_accounts_userId_connectorId_key";
CREATE UNIQUE INDEX "connector_accounts_userId_connectorId_externalId_key"
  ON "connector_accounts"("userId", "connectorId", "externalId");
