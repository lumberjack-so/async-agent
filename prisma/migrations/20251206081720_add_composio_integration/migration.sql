-- AlterTable
ALTER TABLE "connections" ADD COLUMN     "auth_status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "composio_account_id" TEXT,
ADD COLUMN     "composio_toolkit" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "skills" ADD COLUMN     "composio_user_id" TEXT;

-- CreateTable
CREATE TABLE "composio_mcp_configs" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "mcp_config_id" TEXT NOT NULL,
    "toolkits" TEXT[],
    "allowed_tools" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "composio_mcp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composio_toolkits" (
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "logo_url" TEXT,
    "auth_scheme" TEXT NOT NULL,
    "tools" TEXT[],
    "last_synced" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "composio_toolkits_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "composio_mcp_configs_skill_id_idx" ON "composio_mcp_configs"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "composio_mcp_configs_skill_id_step_order_key" ON "composio_mcp_configs"("skill_id", "step_order");

-- CreateIndex
CREATE INDEX "composio_toolkits_category_idx" ON "composio_toolkits"("category");

-- CreateIndex
CREATE INDEX "connections_source_idx" ON "connections"("source");

-- CreateIndex
CREATE INDEX "connections_auth_status_idx" ON "connections"("auth_status");
