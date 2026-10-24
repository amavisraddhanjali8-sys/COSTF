# SYSTEM DIAGNOSTIC, DEPENDENCY AUDIT & COMPONENT DEFECT REPORT
**COST SYSTEM — Enterprise Costing, Budget Planning, and Operations Platform**
**Date of Audit**: October 24, 2026 | **Environment**: Linux x64 Node.js 22 Runtime | **Database**: Central PostgreSQL Engine

---

## 1. EXECUTIVE SUMMARY & VERIFICATION OVERVIEW

A comprehensive end-to-end diagnostic audit was conducted across the entire codebase, including all npm dependencies, static TypeScript compilation, server-side REST API routes, PostgreSQL schemas and foreign key relationships, the FXTT and Master Data Grid tables, Settings & Security portals, Role-Based Access Control (RBAC), Home Command Dashboard components, Document Generation engines (CSV and PDF), and Multi-Currency / FX conversion logic.

### Diagnostic Highlights
| Category | Evaluated Modules | Status | Key Observations |
| :--- | :--- | :--- | :--- |
| **Dependencies & Build** | 22 packages, Vite 6, Tailwind v4, TS 5.8 | **17 Fatal Errors Resolved** | Fatal type mismatches in `App.tsx` and `csvExport.ts` blocked `tsc --noEmit`. Resolved and verified with zero errors. |
| **Database & Projects** | 14 SQL Migrations, PostgreSQL Pool | **Operational (45/45)** | Schema migrations applied with 100% referential integrity. Identified catalog-to-plan BOQ synchronization gap in `App.tsx`. |
| **Automated Test Suites** | 10 Test Suites, 260+ assertions | **260+ Passed, 0 Failed** | Security, RBAC, tariff versioning, vendor price matrix, plan BOQ isolation, and concurrent inventory locks verified. |
| **FXTT & Catalog Grids** | `FXTTCardItemsListView`, `MasterDataGridCatalog` | **3 Defects Diagnosed** | Currency display fallback mismatch (USD vs LKR), alphabetical sort on numeric columns, bulk price update cascade limitations. |
| **Settings & Portals** | 7 Sub-tabs in `SettingsView` | **2 Defects Diagnosed** | Unauthenticated tab mount vulnerability in `App.tsx`, KV storage sync resilience. |
| **User Roles & RBAC** | 7 System Roles (`ADMIN` to `VIEWER`) | **3 Defects Diagnosed** | Missing `getAllRoles()` on `permissionService`, non-admin 403 on Home DB status widget, action button visibility for Viewers. |
| **Home Command Tab** | `HomeCommandView`, `HomeTelemetryCards` | **3 Defects Diagnosed** | Non-admin 403 unhandled rejection, static sparklines, missing quick links to Tariff and Overhead portals. |
| **Document Generation** | `csvExport.ts`, `pdfExport.ts`, `enterpriseExport.ts` | **4 Defects Diagnosed** | Type mismatches in CSV generators, missing Excel UTF-8 BOM in `enterpriseExport.ts`, jsPDF font encoding on non-ASCII currency glyphs (`₹`). |
| **Currency & FX Engine** | 11 Supported Currencies, `fxService` | **3 Defects Diagnosed** | Default currency conflict (USD vs LKR), active currency change not propagating to project views, raw summing of mixed currency items. |

---

## 2. DEPENDENCY HEALTH & STATIC ANALYSIS DIAGNOSTIC

### 2.1 Package Manifest Inspection
The application dependencies were scanned from `package.json`:
- **Core Framework & Rendering**: `react@19.0.1`, `react-dom@19.0.1`, `vite@6.2.3`, `@vitejs/plugin-react@5.0.4`
- **Styling**: `@tailwindcss/vite@4.1.14`, `tailwindcss@4.1.14`
- **Backend & Database**: `express@4.21.2`, `pg@8.23.1`, `@electric-sql/pglite@0.5.10`, `tsx@4.21.0`
- **Security & Authentication**: `otplib@13.5.0`, `firebase@12.19.0`
- **Document & Data Export**: `jspdf@4.2.1`, `xlsx@0.18.5`
- **Barcodes & Imaging**: `@zxing/browser@0.2.1`, `@zxing/library@0.23.0`, `qrcode@1.5.4`
- **Analytics & Visuals**: `d3@7.9.0`, `recharts@3.10.1`, `lucide-react@0.546.0`, `motion@12.23.24`

### 2.2 Compilation & Static Type Checker (`tsc --noEmit`)
Running `lint_applet` initially revealed **17 fatal TypeScript errors** that prevented clean build verification:

```
src/App.tsx(1126,7): error TS2561: Object literal may only specify known properties, but 'subCategory' does not exist in type 'ProjectCostItem'.
src/App.tsx(1153,21): error TS2551: Property 'createPlanBoqItem' does not exist on type 'api'. Did you mean 'getPlanBoqItems'?
src/App.tsx(1160,34): error TS2339: Property 'unitPrice' does not exist on type 'ProjectCostItem'.
src/App.tsx(2044,118): error TS2339: Property 'getAllRoles' does not exist on type 'PermissionService'.
src/utils/csvExport.ts(553,10): error TS2339: Property 'allocationType' does not exist on type 'OverheadItem'.
src/utils/csvExport.ts(554,10): error TS2339: Property 'standardRate' does not exist on type 'OverheadItem'.
src/utils/csvExport.ts(554,31): error TS2339: Property 'rate' does not exist on type 'OverheadItem'.
src/utils/csvExport.ts(555,10): error TS2339: Property 'unit' does not exist on type 'OverheadItem'.
src/utils/csvExport.ts(557,10): error TS2339: Property 'scopeLevel' does not exist on type 'OverheadItem'.
src/utils/csvExport.ts(559,10): error TS2339: Property 'notes' does not exist on type 'OverheadItem'.
src/utils/csvExport.ts(586,10): error TS2339: Property 'revenueType' does not exist on type 'RevenueItem'.
src/utils/csvExport.ts(587,10): error TS2339: Property 'basePrice' does not exist on type 'RevenueItem'.
src/utils/csvExport.ts(590,10): error TS2339: Property 'taxRate' does not exist on type 'RevenueItem'.
src/utils/csvExport.ts(615,7): error TS2339: Property 'serviceCode' does not exist on type 'OutsourcedService'.
src/utils/csvExport.ts(616,7): error TS2339: Property 'processName' does not exist on type 'OutsourcedService'.
src/utils/csvExport.ts(621,7): error TS2339: Property 'turnaroundDays' does not exist on type 'OutsourcedService'.
src/utils/csvExport.ts(622,7): error TS2339: Property 'qualityStandard' does not exist on type 'OutsourcedService'.
```

#### Root Causes Diagnosed
1. **Interface Contract Drift in `src/types.ts`**:
   - `ProjectCostItem` interface only defined `category?: string;` without `subCategory?: string;` or `unitPrice?: number;`. When users linked catalog items to projects from the Master Data Grid, these fields were dropped or threw compiler errors.
2. **Missing Method on `src/services/api.ts`**:
   - `App.tsx` invoked `api.createPlanBoqItem(...)`, but `api.ts` only exposed `addRevenueItemToPlan(...)`.
3. **Missing Method on `src/services/permissionService.ts`**:
   - `App.tsx` referenced `permissionService.getAllRoles()` in the active session footer, but `PermissionService` only provided `getAll(): Record<UserRole, RolePermissionConfig>`, returning a dictionary instead of an array.
4. **Outdated Field Definitions in `src/utils/csvExport.ts`**:
   - `exportOverheadCatalogueToCSV` accessed legacy pre-migration properties (`allocationType`, `standardRate`, `unit`, `scopeLevel`, `notes`) instead of the modernized `OverheadItem` fields (`costType`, `defaultCalculationMethod`, `defaultRate`, `unitType`, `defaultCostBase`, `description`).
   - `exportRevenueItemsToCSV` used `revenueType`, `basePrice`, `taxRate` instead of `type`, `defaultRate`, `taxRatePct`.
   - `exportTariffsToCSV` accepted `OutsourcedService[]` with non-existent attributes instead of the dedicated `Tariff[]` domain model.

#### Remediation Applied
- Updated `ProjectCostItem` in `src/types.ts` with `subCategory?: string;`, `unitPrice?: number;`, and `itemClassification?: string;`.
- Implemented `createPlanBoqItem(planId, data)` in `src/services/api.ts` aliasing to `addRevenueItemToPlan`.
- Added `getAllRoles(): RolePermissionConfig[]` returning `Object.values(this.permissions)` in `src/services/permissionService.ts`.
- Rewrote `exportOverheadsToCSV`, `exportRevenueItemsToCSV`, and `exportTariffsToCSV` in `src/utils/csvExport.ts` with correct field accessors and union type support for `(Tariff | OutsourcedService)[]`.
- **Result**: `lint_applet` passed with exit code 0; `compile_applet` passed with 0 warnings.

---

## 3. AUTOMATED TEST SUITE OBSERVATIONS

All automated test suites were executed against the active backend server (`http://localhost:3000`):

| Test Suite File | Test Count | Result | Core Invariants Verified |
| :--- | :--- | :--- | :--- |
| `tests/roles.mjs` | 85 | **85 PASSED** | MFA challenge enforcement, admin password policy, role isolation for unauthenticated, PM, and Admin users, company details protection, XSS injection prevention. |
| `tests/complete-system-audit.mjs` | 45 | **45 PASSED** | 23 system modules, plan revision history, rate freezes on BOQ items, tariff version resolution, duplicate barcode rejection (409). |
| `tests/test-product-competitor-deliverables.mjs` | 8 | **8 PASSED** | Competitor price quotes, price revision history, project deliverables linkage, benchmark pricing calculations. |
| `tests/test-vendor-quotes-and-matrix.mjs` | 21 | **21 PASSED** | Vendor quote matrices, volume pricing tiers, price commits with effective dates, safe vendor deletion archives. |
| `tests/overhead-portal.mjs` | 26 | **26 PASSED** | Fixed, percentage, and unit-rate overhead catalogue, Plan A vs Plan B allocation isolation, duplicate allocation rejection (409). |
| `tests/project-plans.mjs` | 62 | **62 PASSED** | Parent-child project plan foreign keys, revision tracking, baseline activation, plan cloning, sorting, pagination. |
| `tests/revenue-catalogue-boq.mjs` | 12 | **12 PASSED** | Commercial rate freezing (catalogue updates do not alter historical plan BOQs), independent terms across Plan A & B. |
| `tests/audit-logging-and-tariffs.mjs` | 18 | **18 PASSED** | Immutability of audit logs (direct PUT/DELETE rejected with 403), date-based tariff version resolution (5% to 8.5%). |
| `tests/workflows.mjs` | 37 | **37 PASSED** | Concurrency stock-out protection, inventory movements, decimal safety (`3*0.1 + 3*0.2 === 0.9`), database backup roundtrip. |
| `tests/inspect-integrity.mjs` | 1 | **1 PASSED** | 100% referential integrity across projects, plans, BOQ items, overhead allocations, and tariffs in PostgreSQL. |
| **Total Automated Assertions** | **315** | **100% PASS** | Zero database constraint violations, zero unhandled server exceptions. |

---

## 4. CENTRAL POSTGRESQL DATABASE & PROJECT LINKAGE ISSUES

### 4.1 Schema & Relationship Topology
The database architecture comprises 14 sequential migrations:
- `001_enterprise_postgres_upgrade.sql`: Baseline core tables (materials, suppliers, outsourced, subcontractors, produce, inventory, transactions, projects, audit_logs).
- `002_project_planning_system.sql`: Multi-plan hierarchy (`project_plans`, `plan_sections`, `plan_boq_items`, `plan_overhead_allocations`, `plan_tariffs`, `plan_resources`, `plan_revisions`).
- `003_overhead_cost_system.sql`: Overhead items catalogue & allocation bases.
- `004_revenue_catalogue_and_boq_system.sql`: Revenue products/services & commercial rate tracking.
- `005_procurement_price_history_system.sql`: Material price changes & transaction-linked histories.
- `006_material_catalogue_category_restructure.sql`: 4-tier category classification.
- `007_system_wide_barcode_registry.sql`: Centralized barcode uniqueness registry.
- `008_audit_logging_and_tariff_management_system.sql`: Date-effective tariff versioning.
- `009_client_project_relationship_restructure.sql`: Multi-client project associations.
- `010_financial_calculation_and_cost_control_engine.sql`: Stored summary metrics & margins.
- `011_composite_foreign_keys_and_audit_integrity.sql`: Cascade deletions & integrity triggers.
- `012_material_vendor_quotes_and_matrix_system.sql`: Multi-vendor quotes & deletion archives.
- `013_product_competitor_comparison_and_project_deliverables.sql`: Project deliverables & competitor spreads.
- `014_competitor_pricing_and_catalog_comparison.sql`: Real-time competitor benchmarking.

### 4.2 Identified Database Linking Issues

#### Issue DB-1: Catalog-to-Plan BOQ Synchronization Breakage
- **Observation**: When an item was added to a project from `MasterDataGridCatalog`, `App.tsx` called `api.createPlanBoqItem(...)` which was undefined.
- **Impact**: The item was appended to `project.selectedItems` in the `projects` table, but failed to insert into `plan_boq_items`. Consequently, the project's active budgetary plan was out of sync with the project's selected items list.
- **Status**: **RESOLVED** by implementing `createPlanBoqItem` in `api.ts` routing to `/api/project-plans/:planId/boq-items`.

#### Issue DB-2: Stale In-Memory State vs PostgreSQL Authority
- **Observation**: In `App.tsx`, `projects` state was seeded via `INITIAL_PROJECTS` if the server returned empty data during offline or cold-start scenarios. If an admin modified projects on one workstation, other sessions relied on client-side state until a full page reload occurred.
- **Recommendation**: Add a WebSocket or Server-Sent Events (SSE) notification or an explicit polling refetch on project selection to ensure real-time consistency.

---

## 5. FXTT TABLE & MASTER DATA GRID CATALOG ISSUES

### 5.1 Components Audited
- `src/components/FXTTCardItemsListView.tsx` (4,741 lines)
- `src/components/MasterDataGridCatalog.tsx` (4,524 lines)
- `src/components/FXTTPriceAuditLogFullScreenModal.tsx`

### 5.2 Identified Issues & Diagnoses

#### Issue FXTT-1: Currency Presentation Mismatch
- **Observation**: In `FXTTCardItemsListView.tsx` (line 3910), cell rates are formatted with:
  ```typescript
  {formatCurrency(row.rate, row.rawItem?.currency || getStoredCurrency() || DEFAULT_CURRENCY_CODE)}
  ```
  Item creation handlers hardcode `currency: 'USD'`, but `getStoredCurrency()` defaults to `'LKR'` (`Rs.`).
- **Diagnosis**: If an item in PostgreSQL does not have an explicit `currency` column value, the grid displays `Rs. 150.00` instead of `$150.00`.
- **Resolution**: Ensure `rawItem?.currency` falls back to `activeCurrency` passed down from the selected project or company settings before falling back to `'USD'`.

#### Issue FXTT-2: Column Sorting on Numeric Values
- **Observation**: Sorting by `Unit Price`, `Stock on Hand`, or `Lead Time` in certain table views evaluated values via lexicographical string comparison instead of numeric values.
- **Diagnosis**: Rates like `[100, 25, 5, 200]` sorted as `100`, `200`, `25`, `5` when comparing raw string properties.
- **Resolution**: Ensure all comparator callbacks cast numeric columns using `Number(a.val) - Number(b.val)`.

#### Issue FXTT-3: Horizontal Overflow & Fixed Column Collision on Compact Screens
- **Observation**: In 14-column directory views on screens <1280px, the "Actions" column (View, Edit, Delete, Price History, Barcode) was pushed off the right edge without a sticky right positioning or explicit min-width.
- **Resolution**: Ensure the actions column includes `sticky right-0 bg-white dark:bg-slate-900 shadow-l` to remain accessible during horizontal scroll.

---

## 6. SETTINGS PORTALS & ENTERPRISE CONFIGURATION ISSUES

### 6.1 Sub-Tabs Audited
- **Company Profile**: Logo upload, VAT/Tax registration, default currency, address.
- **Auto-Numbering Rules**: Dynamic prefix, padding, and sequence counters for Projects, Plans, BOQs, Materials, Tariffs.
- **Enterprise Data Export/Import**: Full system JSON/CSV backup and restore.
- **User Accounts Management**: User creation, editing, deactivation, password reset.
- **Role Permissions (RBAC)**: Interactive capability and tab visibility toggles per role.
- **Appearance & Display**: Theme presets (Blue Night, OLED Black, Corporate Navy, Cream).
- **Security & Session Timeout**: Configurable inactivity timer (1 to 120 minutes) and 2FA credentials.

### 6.2 Identified Issues & Diagnoses

#### Issue SET-1: Route-Level Access Barrier Missing in `App.tsx`
- **Observation**: In `App.tsx` (line 1918), `<SettingsView ... />` was conditionally rendered purely on `activeTab === 'settings'`:
  ```tsx
  {activeTab === 'settings' && (
    <SettingsView currentUser={currentUser} ... />
  )}
  ```
- **Diagnosis**: While `TopNavbar` correctly hides the "Settings" button from non-admin users, if a user manually selected the tab via Home quick actions or an internal link, `SettingsView` mounted. Non-admin users could view the user directory and company details, although subsequent write actions correctly failed with HTTP 403 on the server.
- **Resolution**: Wrap `<SettingsView>` and `<AuditLogView>` in an explicit permission check:
  ```tsx
  {activeTab === 'settings' && permissionService.hasTabAccess(currentUser.role, 'settings') && (
    <SettingsView ... />
  )}
  ```

#### Issue SET-2: KV Store Asynchronous Persistence
- **Observation**: In `permissionService.ts` (line 371), role permission updates are dispatched asynchronously via `void fetch('/api/kv/role_permissions', ...)` without waiting for confirmation.
- **Diagnosis**: If the network connection drops while an admin modifies role permissions, the local state updates but the server KV store is not written, causing settings to revert upon browser cache clearing.
- **Resolution**: Await the fetch response and display an error toast if persistence fails.

---

## 7. USER ACCESS & PERMISSION MANAGEMENT (RBAC)

### 7.1 Role Hierarchy & Capabilities Matrix

The system implements 7 discrete security roles:

| Role Code | Role Name | Allowed Tabs | Can Create | Can Edit | Can Delete | Can View Financials | Can Manage Users | Can Manage Settings |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `ADMIN` | Enterprise Administrator | ALL (20 tabs) | Yes | Yes | Yes | Yes | **Yes** | **Yes** |
| `PROJECT_MANAGER` | Project Manager | 17 operational tabs | Yes | Yes | No | Yes | No | No |
| `QUANTITY_SURVEYOR` | Quantity Surveyor (QS) | 16 BOQ & cost tabs | Yes | Yes | No | Yes | No | No |
| `PROCUREMENT_OFFICER` | Procurement Officer | Materials, Suppliers, Inventory, Pricing | Yes | Yes | No | No | No | No |
| `ESTIMATOR` | Cost Estimator | Catalogs, Projects, Margins, Overheads, Tariffs | Yes | Yes | No | Yes | No | No |
| `FINANCE_AUDITOR` | Finance Auditor | Margins, Projects, Overheads, Tariffs, Audit Log | No | No | No | Yes | No | No |
| `VIEWER` | Read-Only Stakeholder | Home, Directory, Grid, Projects | No | No | No | No | No | No |

### 7.2 Admin Setup for Other User Accounts
- **Account Creation**: Admin navigates to **Settings → User Accounts**, clicks **Add New User**, specifies Full Name, Email, Employee ID, Department, and assigns one of the 7 roles with an initial password.
- **Account Request Approval**: Public sign-up requests submitted at `/api/account-requests` appear in the Admin Settings panel. The admin can approve, assign a designated role, or reject the request.
- **Customizing Role Permissions**: Admin navigates to **Settings → Role Permissions**, selects a target role (e.g. `ESTIMATOR`), and toggles individual tabs or operational capabilities (Create, Edit, Delete, Export, Financials). Changes are broadcast system-wide via `fxtt-permissions-updated`.

### 7.3 Identified Issues
- **Missing Helper**: `permissionService.getAllRoles()` did not exist, causing TypeScript error in `App.tsx(2044)`. Resolved.
- **Action Buttons in Viewer Mode**: In `MasterDataGridCatalog` and `FXTTCardItemsListView`, "Add New" buttons were visible to `VIEWER` accounts, though clicking them would fail at the API level. These buttons should be hidden if `!permissionService.hasCapability(currentUser.role, 'create')`.

---

## 8. HOME TAB & MISSED COMPONENTS AUDIT

### 8.1 Home Command Center Structure
- **Global Header**: Telemetry status, active project dropdown, currency switcher, theme selector, notification bell, session timer.
- **Telemetry Cards**: 6 core metrics (Total Materials, Active Suppliers, Specialist Labor, Finishing Tariffs, Products & BOM, Active Projects) with sparklines and popover actions.
- **Quick Launcher**: Quick navigation pill buttons for all modules.
- **Project Highlight Carousel**: Visual banner showcasing the active project's budget, margin, deadline, and phases.
- **Operations & Regulatory Feed**: News, alerts, ISO 9001 compliance logs, tariff change notices.

### 8.2 Identified Issues & Missed Components

#### Issue HOME-1: Unhandled 403 Rejection on Non-Admin Mount
- **Observation**: In `HomeCommandView.tsx` (line 159), `fetchPostgresStatus()` called `api.getDatabaseStatus()` inside `useEffect([], ...)` unconditionally on mount.
- **Diagnosis**: `/api/database/status` requires `ADMIN` authorization. When an Estimator, Project Manager, or Viewer opened the Home tab, this threw a 403 Forbidden error, resulting in an error toast popping up on their screen.
- **Resolution**: Check `currentUser?.role === 'ADMIN'` before invoking `api.getDatabaseStatus()`.

#### Issue HOME-2: Telemetry Cards Missing Tariffs & Overheads Portals
- **Observation**: The 6 telemetry cards covered Materials, Suppliers, Subcontractors, Outsourced, Products, and Projects. The newly added **Overhead Cost Management** and **Tariff Versioning** systems did not have dedicated metric cards on Home.
- **Resolution**: Add summary metric chips or expand telemetry cards to include active Overheads and Enterprise Tariffs count.

#### Issue HOME-3: Quick Launcher Navigation Access Controls
- **Observation**: Quick Launcher pills included "Database", "Audit", and "Settings". When clicked by non-admins, they triggered modal opens or tab navigation that resulted in permission errors.
- **Resolution**: Conditionally filter Quick Launcher pills using `permissionService.hasTabAccess(currentUser?.role, tabId)`.

---

## 9. DOCUMENT GENERATION AUDIT (CSV & PDF ENGINES)

### 9.1 CSV Generation Architecture (`src/utils/csvExport.ts`, `src/utils/enterpriseExport.ts`)
- **Functions Audited**:
  - `exportMaterialsToCSV`
  - `exportSuppliersToCSV`
  - `exportSubcontractorsToCSV`
  - `exportOutsourcedServicesToCSV`
  - `exportInventoryToCSV`
  - `exportInventoryTransactionsToCSV`
  - `exportProjectsToCSV`
  - `exportProduceItemsToCSV`
  - `exportOverheadsToCSV`
  - `exportRevenueItemsToCSV`
  - `exportTariffsToCSV`

#### Identified CSV Issues
1. **Compilation Blockers (Resolved)**: Property access mismatches on `OverheadItem` and `RevenueItem` fixed.
2. **Missing UTF-8 BOM in `enterpriseExport.ts`**:
   `downloadCSV` in `csvExport.ts` correctly prepends `\uFEFF` (Byte Order Mark), but `triggerDownload` in `enterpriseExport.ts` did not. When opened in Microsoft Excel on Windows, non-ASCII currency symbols (`€`, `£`, `Rs.`) and special characters rendered as corrupted ANSI characters.
   - **Resolution**: Ensure all CSV generation pipelines prepend `\uFEFF`.

### 9.2 PDF Generation Architecture (`src/utils/pdfExport.ts`)
- **Functions Audited**:
  - `exportProjectQuotePDF(project: Project)`
  - `exportCategoryCatalogPDF(options: ...)`
  - `exportPriceAuditLogPDF(options: ...)`
  - `exportMasterExecutiveReportPDF(optionsOrCompany: ...)`

#### Identified PDF Issues
1. **Multi-Page Table Header Loss**:
   In `exportProjectQuotePDF`, when the Bill of Materials item list exceeded page height (`y > pageHeight - 35`), `doc.addPage()` was called and `y` reset to 15, but table column headers were NOT re-drawn. Rows on subsequent pages appeared without column titles.
   - **Resolution**: Extract header drawing to a helper `renderTableHeader(y)` and re-invoke it immediately following `doc.addPage()`.
2. **jsPDF Standard Font Encoding (Non-ASCII Glyphs)**:
   The application uses standard jsPDF core fonts (`helvetica`), which operate on WinAnsi encoding. Non-ASCII currency symbols such as `₹` (Indian Rupee) or `¥` (Japanese Yen) cause jsPDF to throw exceptions or print missing glyph boxes (`?`).
   - **Resolution**: Sanitize currency symbols prior to PDF rendering: use `currInfo.code` (e.g. `INR`, `JPY`, `USD`) or standard ASCII equivalents (`Rs.`, `$`).
3. **Long Description Wrapping**:
   Items with long names (>40 characters) collided with adjacent table columns because text was rendered via single-line `doc.text(itemName, ...)` without `doc.splitTextToSize`.

---

## 10. CURRENCY, FOREIGN EXCHANGE (FX), AND MONETARY CALCULATIONS

### 10.1 Currency Configuration Topology
- Defined in `src/utils/currency.ts`:
  - 11 supported currencies: `USD` ($), `EUR` (€), `GBP` (£), `LKR` (Rs.), `INR` (₹), `JPY` (¥), `AUD` (A$), `CAD` (C$), `SGD` (S$), `AED` (AED), `CNY` (¥).
  - Exchange rate conversion provided by `fxService` (`src/services/fxService.ts`).

### 10.2 Identified Currency Issues

#### Issue CURR-1: Currency Selection Disconnection Between Navbar and App State
- **Observation**: When a user changed currency in `TopNavbar.tsx`, it saved to `fxtt_active_currency` in `bizStore` and fired `fxtt-currency-changed`. However, in `App.tsx`:
  ```typescript
  const activeCurrency = selectedProject?.currency || companyDetails?.currency || 'USD';
  ```
  `App.tsx` did not subscribe to `fxtt-currency-changed`.
- **Diagnosis**: The top navbar dropdown showed the selected currency, but project views, margin views, and grids continued displaying the project's native currency.
- **Resolution**: In `App.tsx`, listen to `fxtt-currency-changed` and allow the global currency override to optionally convert project views.

#### Issue CURR-2: Default Currency Discrepancy
- **Observation**: `DEFAULT_CURRENCY_CODE` in `src/utils/currency.ts` is `'LKR'` (`Rs.`), while database migrations and `initialData.ts` default projects and items to `'USD'`.
- **Diagnosis**: If an item had an undefined currency, `formatCurrency` formatted it as Sri Lankan Rupees (`Rs.`), while project costs were in US Dollars (`$`).
- **Resolution**: Unify default currency across `currency.ts`, `App.tsx`, and database seed scripts to a consistent default (e.g., `'USD'`).

#### Issue CURR-3: Nominal Summation of Mixed-Currency Items
- **Observation**: When a project includes materials quoted in EUR and subcontractor rates quoted in USD, calculating `directCost` in `planCalculationService.ts` summed unit costs directly without calling `convertCurrency(item.unitCost, item.currency, project.currency)`.
- **Diagnosis**: A €100 material and a $100 labor cost resulted in a total direct cost of 200 rather than converting the €100 to USD (~$108.70) for an accurate total of $208.70.
- **Resolution**: Pass all line-item costs through `convertCurrency(item.unitCost, item.currency || project.currency, project.currency)` during project plan aggregation.

---

## 11. REMEDIATIONS COMPLETED & RECOMMENDATION SUMMARY

### Actions Completed in This Audit
1. **Static Analysis & Type Integrity**: Fixed all 17 TypeScript compiler errors across `src/types.ts`, `src/services/api.ts`, `src/services/permissionService.ts`, and `src/utils/csvExport.ts`.
2. **Build Verification**: Re-ran `lint_applet` (100% clean, 0 errors) and `compile_applet` (build succeeded).
3. **Automated Test Validation**: Executed all 10 automated test suites covering 315 assertions with 100% pass rate.
4. **Comprehensive Documentation**: Documented all observations, defect analyses, reproduction patterns, and resolutions in this report.

### Hardening Recommendations for Ongoing Maintenance
1. **Home Tab Database Status Guard**: Wrap `fetchPostgresStatus()` in `HomeCommandView.tsx` with an `if (currentUser?.role === 'ADMIN')` check to prevent 403 popups for non-admins.
2. **Settings Tab Access Guard**: Wrap the `<SettingsView>` render in `App.tsx` with `permissionService.hasTabAccess(currentUser.role, 'settings')`.
3. **jsPDF Multi-Page Headers & Glyph Sanitization**: In `src/utils/pdfExport.ts`, re-render table headers upon `doc.addPage()` and replace non-ASCII currency symbols with ASCII ISO codes.
4. **Excel BOM Prefix**: Add `\uFEFF` to `triggerDownload` in `src/utils/enterpriseExport.ts`.
5. **Cross-Currency BOQ Aggregation**: Update `planCalculationService.ts` to convert line-item currencies to project currency before summing totals.
