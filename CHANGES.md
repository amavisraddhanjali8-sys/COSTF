# Changes

## Run
1. Install PostgreSQL and create a database `inno_cost`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
   Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (first admin). If not set, a random password is printed once.
3. `npm install` then `npm run dev`

## Test
Start the server, then run with ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_CODE set:
`node tests/roles.mjs`, `node tests/workflows.mjs`, `python3 tests/route-check.py`

## Do after deploy
- Delete `data/` from git history (it held a database and `security.json`).
- Change every password and the admin secret code. The old ones were public.

## Audit & System Hardening Fixes (Oct 24, 2026)
- **TypeScript Static Analysis**: Resolved 17 compiler errors across `src/types.ts`, `src/services/api.ts`, `src/services/permissionService.ts`, and `src/utils/csvExport.ts` to achieve 100% clean compilation (`tsc --noEmit`).
- **Database & Plan Synchronization**: Added `createPlanBoqItem` in `src/services/api.ts` connecting catalog quick-adds directly to `plan_boq_items`.
- **RBAC & Authorization Hardening**:
  - Added `getAllRoles()` to `permissionService.ts`.
  - Guarded `<SettingsView>` and `<AuditLogView>` in `src/App.tsx` with `permissionService.hasTabAccess(...)`.
  - Guarded Home tab PostgreSQL database status checks to prevent 403 Forbidden errors on non-admin logins.
  - Filtered Home Quick Launcher items (Database, Settings, Audit) by active role permissions.
- **Data Grids & FXTT Tables**:
  - Implemented numeric parsing for `rate`, `retailPrice`, `inStock`, and `leadTimeDays` in `MasterDataGridCatalog.tsx` and `FXTTCardItemsListView.tsx` to prevent lexicographical sorting.
  - Unified default currency fallback to `USD` across `currency.ts` and FXTT tables.
- **Document Exporting (CSV & PDF)**:
  - Added UTF-8 Byte Order Mark (`\uFEFF`) to `triggerDownload` in `src/utils/enterpriseExport.ts` for Excel on Windows.
  - Added table header re-rendering on multi-page overflow in `exportProjectQuotePDF`.
  - Added `getPdfSafeSymbol` in `currency.ts` to sanitize non-ASCII currency glyphs (e.g., INR `₹`, JPY `¥`) into WinAnsi-safe PDF representations.
- **Cross-Currency Sourcing**:
  - Integrated `convertCurrency` into `planCalculationService.ts` to convert line-item currencies into plan currency during cost aggregation.
  - Connected `TopNavbar` currency switcher to `App.tsx` via `fxtt-currency-changed` event listener.

## Real-Time Auto-Updating Calendar Enhancement
- **Auto-Updating Clock & Midnight Rollover**: Replaced hardcoded date initialization with dynamic real-time system clock (`liveClock`, updated via active interval). Automatically updates active date boundaries and "Today" ring indicator upon midnight rollovers without page reload.
- **Dynamic Multi-Entity Derivation**: Calendar automatically pulls and derives dates in real-time from:
  - Project delivery deadlines and project start dates
  - Project phase kickoff dates and completion dates
  - Predefined project milestones
  - Deliverables target fulfillment dates
  - Tariff & outsourced service renewal/audit schedules
  - User custom events saved persistently in PostgreSQL KV storage (`bizStore`)
- **Interactive Multi-Filter Scope**: Added category filter pills allowing toggling between `All`, `Milestones`, `Phases`, `Deliverables`, and `Events` with live counts.
- **Cross-View & Cross-Tab Synchronization**: Added window event broadcasting (`fxtt-calendar-updated` and `fxtt-projects-updated`) to synchronize calendar events across tabs and modals in real time.
- **iCalendar (.ICS) Export**: Added one-click `.ics` export generating RFC 5545 compliant calendar files for import into Google Calendar, Outlook, and Apple Calendar.
- **Add Event Modal with Date & Project Association**: Added year/month/day selectors, category picker (Audit, Review, Phase, Stock, Tariff, Milestone, Deadline, Deliverable), and optional direct project linkage.

## Home UI & User Profile Simplification (Oct 24, 2026)
- **Top Navbar User Profile**: Simplified the user profile capsule to display strictly the circular avatar and single-word user identifier (e.g., `Administrator` / `Admin`) without metadata subtitles, employee IDs, or shield badges.
- **Home First Card Set Redesign**:
  - Transformed all 6 cards into vibrant, fully colored gradient cards (Indigo for Materials, Emerald for Suppliers, Violet for Trades, Amber for Tariffs, Rose for Products, Ocean Sky for Projects).
  - Switched card labels to crisp one-word titles: `Materials`, `Suppliers`, `Trades`, `Tariffs`, `Products`, `Projects`.
  - Removed all wave sparkline SVG line graphics for a clean, minimalist metric layout.
- **Removed Marked Alerts Section**: Cleaned the Home Command view by removing the circled duplicate alerts container from the Quick Actions panel.


