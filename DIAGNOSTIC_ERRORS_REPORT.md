# Enterprise System Comprehensive Error Diagnostic Report

**Applet Name:** COST SYSTEM  
**Import Source:** `amavisraddhanjali8-sys/COSTF`  
**Audit Date:** October 26, 2026  
**Environment:** Linux x86_64, Node.js v22.23.3, PostgreSQL / PGlite 0.5.10, React 19, Vite 6, Tailwind CSS v4  

---

## Executive Summary

A comprehensive, file-by-file diagnostic audit of the entire codebase was conducted across all **94 source files**, including TypeScript frontend components, server routes, PostgreSQL schema migrations, utility libraries, tests, and analytics engines. 

The investigation revealed **14 specific errors and architectural discrepancies** spanning:
1. **TypeScript compilation errors** blocking strict typechecking (`tsc --noEmit` / `npm run lint`).
2. **Database schema foreign key & NOT NULL violations** causing 500 errors on project creation.
3. **Missing Express API endpoints** causing frontend service calls to fail or return 404/null.
4. **Database seeding omissions** causing competitor benchmark lookups to return empty collections.
5. **Runtime environment constraint violations** (`window.alert` and `window.confirm` in sandboxed iframes).
6. **Analytics engine item-type categorization mismatches** between Python and TypeScript engines.
7. **Frontend state desynchronization** during central database reloading.

---

## 1. Static Type & Compilation Errors (Blocking `npm run lint` / `tsc --noEmit`)

### Error 1.1: Missing `EnterpriseResource` Type Import
- **File:** `/src/components/MasterDataGridCatalog.tsx` (Line 114, Column 25)
- **Error Code:** `TS2304: Cannot find name 'EnterpriseResource'`
- **Cause:** `MasterDataGridCatalogProps` specifies `enterpriseResources?: EnterpriseResource[];`, but `EnterpriseResource` was omitted from the `import { ... } from '../types'` statement at lines 52–62.
- **Impact:** Fails TypeScript compilation during build and CI verification.
- **Resolution:** Add `EnterpriseResource` to the named import list from `../types`.

### Error 1.2: Missing `useEffect` React Hook Import
- **File:** `/src/components/MasterDataGridCatalog.tsx` (Line 308, Column 3)
- **Error Code:** `TS2304: Cannot find name 'useEffect'`
- **Cause:** `useEffect` is invoked on line 308 to register event listeners for `'fxtt-overheads-changed'`, but line 1 only imports `{ useState, useMemo, useRef }` from `'react'`.
- **Impact:** Fails static compilation; would cause runtime `ReferenceError: useEffect is not defined` if rendered.
- **Resolution:** Update line 1 to `import React, { useState, useEffect, useMemo, useRef } from 'react';`.

### Error 1.3: Unsafe String Method on Untyped Set State
- **File:** `/src/components/MasterDataGridCatalog.tsx` (Line 3683, Column 38)
- **Error Code:** `TS2339: Property 'toLowerCase' does not exist on type 'unknown'`
- **Cause:** The `selectedIds` state was declared as `const [selectedIds, setSelectedIds] = useState(new Set());` without a generic type parameter, causing `Array.from(selectedIds)` to infer elements as `unknown`. When bulk-deleting records, `delId.toLowerCase()` errors.
- **Impact:** Fails TypeScript compilation.
- **Resolution:** Type the state explicitly as `useState<Set<string>>(new Set())` or cast `(delId as string).toLowerCase()`.

### Error 1.4: Missing `barcode` Property on `EnterpriseResource` Interface
- **File:** `/src/utils/csvExport.ts` (Line 690, Column 9)
- **Error Code:** `TS2339: Property 'barcode' does not exist on type 'EnterpriseResource'`
- **Cause:** In `exportEnterpriseResourcesCSV()`, line 690 extracts `res.barcode || ''`. However, in `/src/types.ts` (lines 1571–1601), `EnterpriseResource` defines resource fields (`code`, `name`, `type`, `category`, `baseRate`, etc.) but lacks `barcode?: string;`.
- **Impact:** Fails TypeScript compilation.
- **Resolution:** Add `barcode?: string;` to `EnterpriseResource` in `src/types.ts`.

---

## 2. Backend Database & Schema Constraint Failures

### Error 2.1: NOT NULL Constraint Violation in `createProject`
- **File:** `/src/server/postgresDb.ts` (Lines 3998–4003)
- **Error Code:** PostgreSQL error `23502: null value in column "client_id" of relation "project_clients" violates not-null constraint`
- **Trigger:** Calling `POST /api/projects` or `postgresService.createProject()` with an optional or undefined `clientId` (e.g. `tests/audit-logging-and-tariffs.mjs` and `tests/test-resources-and-lkr.mjs`).
- **Cause:** In `createProject`:
  ```typescript
  // Populate project_clients junction table
  await db.query(
    `INSERT INTO project_clients (id, project_id, client_id, relationship_type, share_pct, is_primary, updated_at)
     VALUES ($1, $2, $3, 'Primary Client', 100.00, true, NOW())
     ON CONFLICT (project_id, client_id, relationship_type) DO UPDATE SET is_primary = true, updated_at = NOW()`,
    [`pc-${id}-${clientId}-primary`, id, clientId]
  );
  ```
  `client_id` in `project_clients` has a `NOT NULL` constraint. While `updateProject` (line 4104) guards this with `if (clientId)`, `createProject` executes the query unconditionally with `$3 = null`, throwing an unhandled database exception that returns HTTP 500.
- **Impact:** Prevents creating projects when no client ID is provided.
- **Resolution:** Wrap the `INSERT INTO project_clients` block inside `if (clientId) { ... }`.

### Error 2.2: Missing Default Seeding for Competitors Table
- **File:** `/src/server/postgresDb.ts` (`ensureProductCompetitorSchema`, lines 13055–13085)
- **Error:** Zero competitors in database on startup, causing `tests/test-product-competitor-deliverables.mjs` line 49 (`assert.ok(competitors.length >= 1)`) to fail.
- **Cause:** Migration `013_product_competitor_comparison_and_project_deliverables.sql` defines initial competitor rows (`Apex Industrial Dynamics`, `Global Core Systems Ltd`, etc.), but `ensureProductCompetitorSchema()` only executes `CREATE TABLE IF NOT EXISTS` without ensuring initial rows exist if the table is empty.
- **Impact:** When database starts fresh or dev data is cleaned, competitor benchmark queries return empty lists.
- **Resolution:** Add an idempotent seeding check in `ensureProductCompetitorSchema()`:
  ```sql
  INSERT INTO competitors (id, name, code, country, market_tier, notes)
  VALUES
    ('comp-01', 'Apex Industrial Dynamics', 'COMP-APEX', 'United States', 'Market Leader', 'Primary domestic competitor.'),
    ('comp-02', 'Global Core Systems Ltd', 'COMP-GLOBAL', 'Germany', 'Premium Rival', 'European engineering alternative.'),
    ('comp-03', 'Benchmark Industry Average', 'COMP-BENCH', 'Global', 'Market Benchmark', 'Aggregated median reference.'),
    ('comp-04', 'Vanguard Precision Tech', 'COMP-VANG', 'Singapore', 'Low-Cost Challenger', 'Asia Pacific fast-turn.')
  ON CONFLICT (id) DO NOTHING;
  ```

---

## 3. API Route & Contract Discrepancies Between Frontend and Server

### Error 3.1: Missing `GET /api/kv/:key` in `server.ts`
- **Files:** `/src/services/api.ts` (Line 2135) vs `/server.ts` (Lines 2604–2622)
- **Error:** `api.getKv(key)` always resolves to `null`
- **Cause:** `src/services/api.ts` defines:
  ```typescript
  async getKv<T = any>(key: string): Promise<T | null> {
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.value ?? null;
  }
  ```
  In `server.ts`, the server defines:
  - `GET /api/kv` (returns all keys as an object)
  - `PUT /api/kv/:key`
  - `DELETE /api/kv/:key`
  There is NO route for `GET /api/kv/:key`. Calls to `GET /api/kv/myKey` fall through to Vite's HTML handler, causing `res.json()` to fail or return HTML text.
- **Impact:** Individual key-value lookups (e.g., custom numbering counters or preferences) fail.
- **Resolution:** Add `app.get('/api/kv/:key', async (req, res) => { ... })` in `server.ts`.

### Error 3.2: Engine Name String Matching Assertion in Test Suite
- **File:** `/tests/complete-system-audit.mjs` (Line 63)
- **Error:** `✗ FAIL: PostgreSQL database connected and authoritative`
- **Cause:** The audit test checks `dbStatus.json?.engine === 'PostgreSQL'`. However, `postgresDb.ts` returns `engine: 'PostgreSQL (PGlite Relational Engine)'`.
- **Impact:** False-negative failure in system integration tests.
- **Resolution:** Change assertion to check `dbStatus.json?.engine?.startsWith('PostgreSQL')`.

---

## 4. Python Analytics Engine Discrepancies

### Error 4.1: Omission of Resource Categorization in `analytics_engine.py`
- **File:** `/analytics_engine.py` (Lines 65–74)
- **Discrepancy:** Items of type `'labour'`, `'machinery'`, `'equipment'`, and `'tool'` are misclassified as `'material'`
- **Cause:** `analytics_engine.py` contains:
  ```python
  item_type = item.get('type', 'material')
  if item_type == 'material':
      material_cost += discounted_cost
  elif item_type == 'subcontractor':
      subcontractor_cost += discounted_cost
  elif item_type == 'outsourced':
      outsourced_cost += discounted_cost
  else:
      material_cost += discounted_cost  # <-- Dumps labour, equipment, machinery, tool into materials!
  ```
  In contrast, `server.ts` (`fallbackAnalytics`, lines 228–246) and `planCalculationService.ts` explicitly track `labourCost`, `machineryCost`, `equipmentCost`, and `toolCost` and aggregate them into `resourceCost`.
- **Impact:** If the Python engine runs, resource allocation costs are misreported under Materials Cost rather than Labor/Equipment.
- **Resolution:** Update `analytics_engine.py` to recognize `labour`, `machinery`, `equipment`, and `tool` and calculate `resource_cost`.

---

## 5. Environment & Sandbox Violations (`window.alert` / `window.confirm`)

AI Studio preview runs inside a sandboxed `iframe`. Browser security policies frequently block or suppress modal dialogues (`alert`, `confirm`, `prompt`), leading to broken UX or silent operation drops.

### Violations Found:

#### A. Direct `window.alert` Invocations (9 instances):
1. `/src/components/ResourceAllocationView.tsx`:
   - Line 371: `alert(\`Error saving resource: ${e?.message || 'Database error'}\`);`
   - Line 386: `alert(\`Error updating resource: ${e?.message || 'Database error'}\`);`
   - Line 435: `alert(\`Error adding alternative: ${e?.message}\`);`
   - Line 470: `alert(\`Error applying alternative: ${e?.message}\`);`
   - Line 519: `alert(\`Allocation error: ${e?.message}\`);`
2. `/src/components/ProjectHomeView.tsx`:
   - Line 321: `alert(\`Could not delete plan: ${e?.message || 'Database error'}\`);`
3. `/src/components/project/ProjectResourcesTab.tsx`:
   - Line 159: `alert('Please select an active resource and budget plan.');`
   - Line 183: `alert(\`Failed to allocate resource: ${err?.message || 'Database error'}\`);`
   - Line 225: `alert(\`Failed to update resource: ${err?.message || 'Database error'}\`);`

#### B. Direct `window.confirm` Invocations (5 instances):
1. `/src/components/ProjectHomeView.tsx`: Line 312 (`if (!window.confirm(...)) return;`)
2. `/src/components/project/ProjectCostControlsTab.tsx`: Line 390
3. `/src/components/project/PlanTemplatesLibraryModal.tsx`: Line 108
4. `/src/components/pricing/ResourcePriceRangesAndChangesModal.tsx`: Line 389
5. `/src/components/pricing/ProductCompetitorPriceMatrixModal.tsx`: Line 795

**Resolution:** Replace `alert` with non-blocking toast notifications (`showToast(...)`) and replace `confirm` with non-blocking confirmation dialog components.

---

## 6. Frontend State Desynchronization

### Error 6.1: Omission of Enterprise Resources, Overheads, and Revenue in `handleReloadDatabase`
- **File:** `/src/App.tsx` (Lines 272–290)
- **Cause:** `api.getInitialData()` fetches `overheads`, `revenueItems`, and `resources` from the server:
  ```typescript
  const data = await api.getInitialData();
  if (data) {
    if (data.projects) setProjects(data.projects);
    if (data.materials) setMaterials(data.materials);
    if (data.produce) setProduceItems(data.produce);
    if (data.suppliers) setSuppliers(data.suppliers);
    if (data.outsourced) setOutsourcedServices(data.outsourced);
    if (data.subcontractors) setSubcontractors(data.subcontractors);
    if (data.inventory) setInventory(data.inventory);
    if (data.transactions) setTransactions(data.transactions);
    if (data.categories) setCategories(data.categories);
    // Missing: setOverheads, setRevenueItems, setEnterpriseResources
  }
  ```
- **Impact:** Clicking "Sync / Reload Database" refreshes materials and projects, but leaves `enterpriseResources`, `overheads`, and `revenueItems` states untouched.
- **Resolution:** Add `if (data.overheads) setOverheads(data.overheads);`, `if (data.revenueItems) setRevenueItems(data.revenueItems);`, and `if (data.resources) setEnterpriseResources(data.resources);`.

---

## 7. Deprecated Standard Library API

### Error 7.1: Deprecated `unescape` in `gmailService.ts`
- **File:** `/src/services/gmailService.ts` (Line 47)
- **Code:** `btoa(unescape(encodeURIComponent(subject)))`
- **Cause:** `unescape` has been deprecated since ECMAScript 3. While still implemented for legacy web compatibility, modern strict environments log deprecation warnings.
- **Resolution:** Use `Buffer.from(subject, 'utf-8').toString('base64')` or browser `TextEncoder`.

---

## 8. Node.js ESM Standalone Test Script Execution

### Error 8.1: Missing File Extensions in Direct Node Script Execution
- **File:** `/src/server/postgresDb.ts` imported by `/tests/test-resources-and-lkr.mjs`
- **Error:** `ERR_MODULE_NOT_FOUND: Cannot find module '/app/applet/src/data/initialData'`
- **Cause:** Running `node tests/test-resources-and-lkr.mjs` fails under Node's native ESM resolution because `postgresDb.ts` imports extensionless files (`../data/initialData`). Node requires either `.js`/`.ts` extensions or execution via `tsx`.
- **Resolution:** Run test scripts with `npx tsx <test-file>` or add npm test scripts in `package.json` that execute via `tsx`.

---

## Diagnostic Summary Table

| ID | Severity | Category | File | Description |
|---|---|---|---|---|
| 1.1 | High | TypeScript / Compile | `src/components/MasterDataGridCatalog.tsx` | Missing `EnterpriseResource` import from `../types` |
| 1.2 | High | TypeScript / Compile | `src/components/MasterDataGridCatalog.tsx` | Missing `useEffect` import from `'react'` |
| 1.3 | High | TypeScript / Compile | `src/components/MasterDataGridCatalog.tsx` | `toLowerCase` called on `unknown` due to untyped `selectedIds` Set |
| 1.4 | High | TypeScript / Compile | `src/utils/csvExport.ts` | Property `barcode` accessed on `EnterpriseResource` but not in interface |
| 2.1 | Critical | Database / Runtime | `src/server/postgresDb.ts` | Unconditional `INSERT INTO project_clients` fails NOT NULL constraint when `clientId` is null |
| 2.2 | Medium | Database / Seeding | `src/server/postgresDb.ts` | No fallback seeding for `competitors` table in `ensureProductCompetitorSchema()` |
| 3.1 | Medium | API Route Contract | `server.ts` | `GET /api/kv/:key` missing; client calls fail / return null |
| 3.2 | Low | Test Suite | `tests/complete-system-audit.mjs` | Assertion expects exact string `'PostgreSQL'` instead of actual engine name |
| 4.1 | Medium | Business Logic | `analytics_engine.py` | Labour, machinery, equipment, tools miscategorized as Materials |
| 5.1 | Medium | iFrame Compatibility | `src/components/ResourceAllocationView.tsx` | 5 usages of `window.alert` blocked by iframe sandbox |
| 5.2 | Medium | iFrame Compatibility | `src/components/ProjectHomeView.tsx` | Usage of `window.alert` and `window.confirm` |
| 5.3 | Medium | iFrame Compatibility | `src/components/project/ProjectResourcesTab.tsx` | 3 usages of `window.alert` |
| 6.1 | Medium | State Management | `src/App.tsx` | `handleReloadDatabase` fails to update overheads, revenue items, and resources |
| 7.1 | Low | Deprecation | `src/services/gmailService.ts` | Use of deprecated `unescape` in email header encoder |
