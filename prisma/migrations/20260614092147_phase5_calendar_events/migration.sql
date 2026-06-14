-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '(no title)',
    "location" TEXT NOT NULL DEFAULT '',
    "organizer" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_accountId_startsAt_idx" ON "calendar_events"("accountId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_accountId_externalId_key" ON "calendar_events"("accountId", "externalId");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "connector_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
