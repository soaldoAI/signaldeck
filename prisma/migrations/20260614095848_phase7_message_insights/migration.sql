-- CreateTable
CREATE TABLE "message_insights" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_insights_messageId_key" ON "message_insights"("messageId");

-- CreateIndex
CREATE INDEX "message_insights_category_idx" ON "message_insights"("category");

-- AddForeignKey
ALTER TABLE "message_insights" ADD CONSTRAINT "message_insights_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
