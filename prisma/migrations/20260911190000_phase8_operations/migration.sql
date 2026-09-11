CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "WorkOrderApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "InspectionType" AS ENUM ('MOVE_IN', 'MOVE_OUT', 'PERIODIC', 'PROPERTY', 'MAINTENANCE');
CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "InspectionCondition" AS ENUM ('GOOD', 'FAIR', 'DAMAGED', 'NEEDS_ATTENTION', 'NOT_APPLICABLE');
CREATE TYPE "DefectStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE SEQUENCE IF NOT EXISTS maintenance_request_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS work_order_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS inspection_record_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS defect_issue_record_number_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE "vendor_profiles" (
    "partyId" UUID NOT NULL,
    "notes" VARCHAR(2000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("partyId")
);

CREATE TABLE "vendor_services" (
    "id" UUID NOT NULL,
    "vendorPartyId" UUID NOT NULL,
    "categoryCode" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "vendor_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vendor_branch_availability" (
    "id" UUID NOT NULL,
    "vendorPartyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "vendor_branch_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inspections" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "inspectionNumber" VARCHAR(50) NOT NULL,
    "type" "InspectionType" NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "propertyId" UUID NOT NULL,
    "rentableSpaceId" UUID,
    "tenantPartyId" UUID,
    "inspectorEmployeeId" UUID,
    "scheduledAt" TIMESTAMPTZ(6) NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inspection_items" (
    "id" UUID NOT NULL,
    "inspectionId" UUID NOT NULL,
    "area" VARCHAR(120) NOT NULL,
    "item" VARCHAR(160) NOT NULL,
    "condition" "InspectionCondition" NOT NULL,
    "notes" VARCHAR(1000),
    "severity" VARCHAR(30),
    "photoDocumentId" UUID,
    CONSTRAINT "inspection_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_requests" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "requestNumber" VARCHAR(50) NOT NULL,
    "propertyId" UUID NOT NULL,
    "rentableSpaceId" UUID,
    "tenantPartyId" UUID,
    "reportedByPartyId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "categoryCode" VARCHAR(50) NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceRequestStatus" NOT NULL DEFAULT 'NEW',
    "reportedAt" TIMESTAMPTZ(6) NOT NULL,
    "assignedEmployeeId" UUID,
    "assignedVendorPartyId" UUID,
    "serviceEngagementId" UUID,
    "sourceInspectionId" UUID,
    "sourceDefectId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_activities" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "fromStatus" "MaintenanceRequestStatus",
    "toStatus" "MaintenanceRequestStatus",
    "notes" VARCHAR(1000),
    "actorUserId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_orders" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "workOrderNumber" VARCHAR(50) NOT NULL,
    "maintenanceRequestId" UUID,
    "propertyId" UUID NOT NULL,
    "rentableSpaceId" UUID,
    "assignedEmployeeId" UUID,
    "vendorPartyId" UUID,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" "WorkOrderApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "scheduledAt" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "laborNotes" VARCHAR(2000),
    "materialNotes" VARCHAR(2000),
    "estimatedCost" DECIMAL(20,4),
    "actualCost" DECIMAL(20,4),
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_order_events" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus",
    "notes" VARCHAR(1000),
    "actorUserId" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_order_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "defect_issues" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "defectNumber" VARCHAR(50) NOT NULL,
    "propertyId" UUID NOT NULL,
    "rentableSpaceId" UUID,
    "inspectionId" UUID,
    "inspectionItemId" UUID,
    "maintenanceRequestId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "severity" VARCHAR(30) NOT NULL,
    "status" "DefectStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "defect_issues_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "expenses" ADD COLUMN "workOrderId" UUID;
ALTER TABLE "expenses" ADD COLUMN "idempotencyKey" VARCHAR(180);

CREATE UNIQUE INDEX "expenses_workOrderId_key" ON "expenses"("workOrderId");
CREATE UNIQUE INDEX "expenses_idempotencyKey_key" ON "expenses"("idempotencyKey");

ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "vendor_services" ADD CONSTRAINT "vendor_services_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "vendor_profiles"("partyId") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "vendor_branch_availability" ADD CONSTRAINT "vendor_branch_availability_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "vendor_profiles"("partyId") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "vendor_branch_availability" ADD CONSTRAINT "vendor_branch_availability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "inspections" ADD CONSTRAINT "inspections_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_tenantPartyId_fkey" FOREIGN KEY ("tenantPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspectorEmployeeId_fkey" FOREIGN KEY ("inspectorEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_tenantPartyId_fkey" FOREIGN KEY ("tenantPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_reportedByPartyId_fkey" FOREIGN KEY ("reportedByPartyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assignedVendorPartyId_fkey" FOREIGN KEY ("assignedVendorPartyId") REFERENCES "vendor_profiles"("partyId") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_serviceEngagementId_fkey" FOREIGN KEY ("serviceEngagementId") REFERENCES "service_engagements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_sourceInspectionId_fkey" FOREIGN KEY ("sourceInspectionId") REFERENCES "inspections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "maintenance_activities" ADD CONSTRAINT "maintenance_activities_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "maintenance_activities" ADD CONSTRAINT "maintenance_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vendorPartyId_fkey" FOREIGN KEY ("vendorPartyId") REFERENCES "vendor_profiles"("partyId") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "defect_issues" ADD CONSTRAINT "defect_issues_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "defect_issues" ADD CONSTRAINT "defect_issues_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "defect_issues" ADD CONSTRAINT "defect_issues_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "defect_issues" ADD CONSTRAINT "defect_issues_rentableSpaceId_fkey" FOREIGN KEY ("rentableSpaceId") REFERENCES "rentable_spaces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "defect_issues" ADD CONSTRAINT "defect_issues_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspections"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "defect_issues" ADD CONSTRAINT "defect_issues_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "inspection_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "defect_issues" ADD CONSTRAINT "defect_issues_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_sourceDefectId_fkey" FOREIGN KEY ("sourceDefectId") REFERENCES "defect_issues"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "uq_vendor_service_category" ON "vendor_services"("vendorPartyId", "categoryCode");
CREATE UNIQUE INDEX "uq_vendor_branch" ON "vendor_branch_availability"("vendorPartyId", "branchId");
CREATE UNIQUE INDEX "uq_inspection_company_number" ON "inspections"("companyId", "inspectionNumber");
CREATE UNIQUE INDEX "uq_maintenance_request_company_number" ON "maintenance_requests"("companyId", "requestNumber");
CREATE UNIQUE INDEX "uq_work_order_company_number" ON "work_orders"("companyId", "workOrderNumber");
CREATE UNIQUE INDEX "uq_defect_issue_company_number" ON "defect_issues"("companyId", "defectNumber");

CREATE INDEX "inspection_register_idx" ON "inspections"("companyId", "branchId", "status", "scheduledAt");
CREATE INDEX "inspection_item_inspection_idx" ON "inspection_items"("inspectionId");
CREATE INDEX "maintenance_request_register_idx" ON "maintenance_requests"("companyId", "branchId", "status", "priority");
CREATE INDEX "maintenance_request_property_idx" ON "maintenance_requests"("propertyId", "status", "reportedAt");
CREATE INDEX "maintenance_activity_timeline_idx" ON "maintenance_activities"("requestId", "occurredAt");
CREATE INDEX "work_order_register_idx" ON "work_orders"("companyId", "branchId", "status", "scheduledAt");
CREATE INDEX "work_order_event_timeline_idx" ON "work_order_events"("workOrderId", "occurredAt");
CREATE INDEX "defect_issue_register_idx" ON "defect_issues"("companyId", "branchId", "status", "createdAt");
