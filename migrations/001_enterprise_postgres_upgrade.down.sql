-- Reversible Down Migration: 001_enterprise_postgres_upgrade.down.sql
-- Safely removes indexes and additive structures added in 001 without deleting core business data.

DROP INDEX IF EXISTS idx_categories_group_type;
DROP INDEX IF EXISTS idx_audit_logs_module_action;
DROP INDEX IF EXISTS idx_audit_logs_timestamp;
DROP INDEX IF EXISTS idx_price_history_lookup;
DROP INDEX IF EXISTS idx_inv_tx_timestamp;
DROP INDEX IF EXISTS idx_inv_tx_type;
DROP INDEX IF EXISTS idx_inv_tx_project_id;
DROP INDEX IF EXISTS idx_inv_tx_material_id;
DROP INDEX IF EXISTS idx_inventory_status;
DROP INDEX IF EXISTS idx_inventory_project_id;
DROP INDEX IF EXISTS idx_inventory_material_id;
DROP INDEX IF EXISTS idx_produce_barcode;
DROP INDEX IF EXISTS idx_produce_category;
DROP INDEX IF EXISTS idx_produce_code;
DROP INDEX IF EXISTS idx_subcontractors_supplier_id;
DROP INDEX IF EXISTS idx_subcontractors_category;
DROP INDEX IF EXISTS idx_subcontractors_code;
DROP INDEX IF EXISTS idx_outsourced_provider_id;
DROP INDEX IF EXISTS idx_outsourced_category;
DROP INDEX IF EXISTS idx_outsourced_code;
DROP INDEX IF EXISTS idx_materials_status;
DROP INDEX IF EXISTS idx_materials_supplier_id;
DROP INDEX IF EXISTS idx_materials_barcode;
DROP INDEX IF EXISTS idx_materials_category;
DROP INDEX IF EXISTS idx_materials_code;
DROP INDEX IF EXISTS idx_projects_created_at;
DROP INDEX IF EXISTS idx_projects_status;
DROP INDEX IF EXISTS idx_projects_client_id;
DROP INDEX IF EXISTS idx_projects_code;
DROP INDEX IF EXISTS idx_suppliers_status;
DROP INDEX IF EXISTS idx_suppliers_category;
DROP INDEX IF EXISTS idx_suppliers_name;
DROP INDEX IF EXISTS idx_clients_status;
DROP INDEX IF EXISTS idx_clients_name;
DROP INDEX IF EXISTS idx_inv_tx_idempotency_unique;
DROP INDEX IF EXISTS idx_inventory_sku_unique;
DROP INDEX IF EXISTS idx_suppliers_code_unique;

DELETE FROM schema_migrations WHERE version = '001';
