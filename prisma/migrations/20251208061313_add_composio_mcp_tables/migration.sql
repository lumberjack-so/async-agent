-- CreateTable
CREATE TABLE "composio_toolkit_mcps" (
    "id" TEXT NOT NULL,
    "toolkit" TEXT NOT NULL,
    "auth_config_id" TEXT NOT NULL,
    "mcp_server_id" TEXT NOT NULL,
    "mcp_url" TEXT NOT NULL,
    "tools" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "composio_toolkit_mcps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composio_step_mcps" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "auth_config_ids" TEXT[],
    "mcp_server_id" TEXT NOT NULL,
    "mcp_url" TEXT NOT NULL,
    "allowed_tools" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "composio_step_mcps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "composio_toolkit_mcps_toolkit_key" ON "composio_toolkit_mcps"("toolkit");

-- CreateIndex
CREATE INDEX "composio_toolkit_mcps_toolkit_idx" ON "composio_toolkit_mcps"("toolkit");

-- CreateIndex
CREATE INDEX "composio_step_mcps_skill_id_idx" ON "composio_step_mcps"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "composio_step_mcps_skill_id_step_order_key" ON "composio_step_mcps"("skill_id", "step_order");
