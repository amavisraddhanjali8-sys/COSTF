# Enterprise System Audit & PostgreSQL 'inno_cost' Migration Report

## 1. Executive Summary & Migration Overview
In accordance with system requirements, all fragmented and legacy file databases (including `database.json`) have been migrated and consolidated into a unified, high-performance PostgreSQL database named **`inno_cost`**. All non-PostgreSQL databases have been permanently purged, ensuring that the PostgreSQL instance serves as the single source of truth across all enterprise operations.

Key highlights of this milestone:
- **Consolidated Database**: Pure PostgreSQL cluster in `/data/inno_cost`, utilizing PGlite engine with persistent storage, ACID compliance, and relational schema validation.
- **Relational Integrity**: Complete foreign-key dependencies (`ON DELETE SET NULL`) connecting Clients, Projects, Suppliers, Materials, Inventory, Subcontractors, Outsourced Processes, and Transaction Ledgers.
- **Resilient API Layer**: Eliminates weak connection drops through singleton initialization, `waitReady` lifecycle verification, automatic corruption self-healing, and seamless frontend state synchronization.
- **Defensive Export Pipeline**: All CSV and PDF export modules (`csvExport.ts`, `pdfExport.ts`, `enterpriseExport.ts`) were audited and hardened with null-safe data access, preventing runtime crashes on missing or partial fields.
- **Item Creation & Save Actions**: All creation, updating, and audit logging buttons across Portals, Catalogs, Modals, and Grids were audited, wired, and verified with direct PostgreSQL persistence.

---

## 2. PostgreSQL 'inno_cost' Schema & Relational Model

The `inno_cost` database schema establishes relational foreign keys with automated reference handling to safeguard data integrity:

```
                  +-------------------+
                  |      clients      |
                  +---------+---------+
                            | 1:N
                            v
                  +---------+---------+
                  |     projects      | <------+
                  +---------+---------+        |
                            |                  |
                            | 1:N              | 1:N
                            v                  |
                  +---------+---------+        |
+---------------->|     inventory     +--------+
|                 +---------+---------+
|                           ^
|                           | 1:N (historical trace)
|                 +---------+---------+
|                 | inventory_trans   |
|                 +-------------------+
|
|                 +-------------------+
| 1:N             |     suppliers     |
+-----------------+----+---------+----+
                       |         |
                  1:N  |         | 1:N
         +-------------+         +-------------+
         v                                     v
+--------+--------+                   +--------+--------+
|    materials    |                   |  subcontractors |
+-----------------+                   +-----------------+
         |                                     |
         v                                     v
+--------+--------+                   +--------+--------+
| outsourced_serv |                   |  produce_items  |
+-----------------+                   +-----------------+
```

### Table Specifications:
1. **`clients`**: Corporate accounts, industry tags, account status, contact channels, active project counts, and custom theme presets.
2. **`projects`**: High-value client contracts linked via `client_id REFERENCES clients(id) ON DELETE SET NULL`. Holds quoted values, phase milestone arrays, itemized BOM distributions, and real-time margin analytics.
3. **`suppliers`**: Approved enterprise vendor roster. Primary key referenced by materials, subcontractors, and outsourced partners.
4. **`materials`**: Raw material specifications linked to `supplier_id REFERENCES suppliers(id) ON DELETE SET NULL`. Stores units, retail pricing, volume breaks, and historical price adjustments.
5. **`subcontractors`**: Specialist trade rate schedules linked to `subcontractor_id REFERENCES suppliers(id) ON DELETE SET NULL`. Tracks base rate, retail billable rate, crew size, weekly capacity, and performance ratings.
6. **`outsourced_services`**: Industrial finishing, plating, coating, and heat-treatment tariffs with `provider_id REFERENCES suppliers(id) ON DELETE SET NULL`.
7. **`produce_items`**: Manufactured products, sub-assemblies, and turn-key package offerings with bill-of-materials references.
8. **`inventory`**: Warehouse SKUs with dual relational ties: `material_id REFERENCES materials(id) ON DELETE SET NULL` and `allocated_project_id REFERENCES projects(id) ON DELETE SET NULL`.
9. **`inventory_transactions`**: Traceable audit ledger of every inventory IN and OUT movement with pricing, supplier, project, quantity, and user sign-off.
10. **`categories`**: Recursive multi-level taxonomy hierarchy for materials, subcontracting trades, finishing services, and product lines with custom gradient aesthetics.
11. **`custom_tiles`**: User-defined UI dashboard navigation tiles with direct portal links.
12. **`company_details`**: Enterprise identity, official registration number, tax identifiers, address, currency settings, and corporate logo assets.
13. **`users`**: Role-based access control (RBAC), multi-factor authentication (TOTP), and credential records.
14. **`media_assets`**: Binary image and document assets stored with Base64 payloads and clean `/api/images/:id` endpoints.
15. **`audit_logs`**: Immutable security and administrative activity log.

---

## 3. Investigated System Files & Key Modifications

### A. Backend & Database Infrastructure
- **`/src/server/postgresDb.ts`**:
  - Re-architected `PostgresService.getDb()` to utilize a singleton promise with explicit `await this.pglite.waitReady`.
  - Added self-healing recovery logic that detects directory corruption/lock stale states and cleanly resets the cluster without manual intervention.
  - Implemented comprehensive CRUD operations across all 15 relational tables with parameter validation.
- **`/server.ts`**:
  - Fixed startup migration flow: on startup, detects legacy `data/database.json`, parses and injects all records into PostgreSQL `inno_cost`, and deletes the obsolete file.
  - Added `/api/database/status` endpoint to report live connection health, active table row counts, and engine status.
  - Implemented `/api/transactions` and `/api/audit-logs` endpoints.
- **`/src/services/api.ts`**:
  - Replaced intermittent mock fallbacks with real HTTP client methods communicating directly with the `inno_cost` backend endpoints.
  - Added `createTransaction`, `getTransactions`, `createAuditLog`, and `getAuditLogs` client methods with strong TypeScript interfaces.

### B. Frontend State & Event Handlers
- **`/src/App.tsx`**:
  - Ensured all save and add operations (`handleAddMaterial`, `handleAddSubcontractor`, `handleAddOutsourced`, `handleAddProduceItem`, `handleAddInventory`, `handleCreateProject`, `handleInventoryTransaction`, `handleAddClient`, `handleUpdateCompanyDetails`) send persistence payloads directly to the PostgreSQL backend.
  - Verified that every inventory movement immediately synchronizes warehouse stock, material stock, and writes a tamper-evident audit record.
- **`/src/components/DirectoryCardsHubView.tsx` & `/src/components/DirectoryCRUDModals.tsx`**:
  - Audited modal save buttons for Material, Subcontractor, Outsourced, Produce, and Category addition.
  - Fixed property name mappings (e.g., standardizing `unitPrice` vs `retailPrice`, `serviceType` vs `trade`).

### C. Data Export Engine (CSV & PDF)
- **`/src/utils/csvExport.ts`**:
  - Added UTF-8 Byte Order Mark (`\uFEFF`) to prevent character encoding corruption in Microsoft Excel.
  - Hardened universal CSV exporters for Materials, Inventory, Transactions, Subcontractors, Outsourced Services, Projects, and Individual/Bulk Price History logs.
- **`/src/utils/pdfExport.ts`**:
  - Fixed inventory valuation calculation with safe nullish coalescing: `sum + (item.totalValuation ?? (qty * cost))`.
  - Added fallback guards on `reasonText` and `auditorText` to prevent `TypeError: Cannot read properties of undefined (reading 'length')` during PDF creation.
  - Formatted currency presentation in Sri Lankan Rupees (LKR / Rs.) and USD.
- **`/src/utils/enterpriseExport.ts`**:
  - Fixed unchecked `.substring()` operations across materials (`m.code`, `m.name`, `m.category`), suppliers (`s.name`, `s.city`), subcontractors, outsourced finishing tariffs, project phases, and allocated bill-of-materials items.

---

## 4. Item Saving & Adding Verification Matrix

| Component / Workflow | Trigger Action | Backend Route | Database Target Table | Status |
| :--- | :--- | :--- | :--- | :--- |
| **New Material Spec** | "Add New Material" Modal | `POST /api/materials` | `materials` in `inno_cost` | Verified |
| **New Supplier Vendor** | "Add Supplier" Modal | `POST /api/suppliers` | `suppliers` in `inno_cost` | Verified |
| **Subcontractor Crew** | "Add Specialist" Modal | `POST /api/subcontractors` | `subcontractors` in `inno_cost` | Verified |
| **Outsourced Tariff** | "Add Outsourced Process" | `POST /api/outsourced` | `outsourced_services` in `inno_cost` | Verified |
| **Produce Assembly** | "Add Product Assembly" | `POST /api/produce` | `produce_items` in `inno_cost` | Verified |
| **Inventory Requisition** | "Create Stock Item" | `POST /api/inventory` | `inventory` in `inno_cost` | Verified |
| **Inventory IN/OUT** | "Post Transaction" Modal | `POST /api/transactions` | `inventory_transactions` | Verified |
| **Project Creation** | "New Project Proposal" | `POST /api/projects` | `projects` in `inno_cost` | Verified |
| **Category Node** | "Create Category / Sub" | `POST /api/categories` | `categories` in `inno_cost` | Verified |
| **Price Revision Audit** | "Update Price" with Reason | `PUT /api/materials/:id/price` | `materials` + `audit_logs` | Verified |
| **Enterprise Settings** | "Save Company Profile" | `PUT /api/company-details` | `company_details` | Verified |

---

## 5. Recommended Future System Enhancements

1. **Automated Database Snapshots**: Introduce a scheduled cron job or backup trigger that exports `pglite.dump()` to compressed cold storage periodically.
2. **Transaction Rollback Hook**: In multi-step transactions (such as project phase allocation impacting multiple inventory SKUs), implement SQL `BEGIN ... COMMIT / ROLLBACK` block execution.
3. **Advanced Barcode Ingestion**: Enhance `globalBarcodeScanner.ts` to support multi-scan batches that generate draft `inventory_transactions` in bulk prior to final commit.
4. **Relational View Performance**: Create PostgreSQL materialized views for real-time profitability analytics (`v_project_profitability`) to precompute gross and net margins.
