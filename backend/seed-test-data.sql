-- Seed Data for Testing Fashion Forge ERP
-- Run this script to populate test data for M0-M7 modules

-- ==================== M0: FOUNDATION ====================

-- 1. Material Categories
INSERT INTO material_categories (company_id, code, name, description) VALUES
((SELECT id FROM companies LIMIT 1), 'FAB', 'Fabric', 'Textile fabrics'),
((SELECT id FROM companies LIMIT 1), 'THR', 'Thread', 'Sewing threads'),
((SELECT id FROM companies LIMIT 1), 'BTN', 'Button', 'Buttons and fasteners'),
((SELECT id FROM companies LIMIT 1), 'ZIP', 'Zipper', 'Zippers'),
((SELECT id FROM companies LIMIT 1), 'ACC', 'Accessories', 'Other accessories')
ON CONFLICT DO NOTHING;

-- 2. Materials
INSERT INTO materials (company_id, category_id, code, name, unit_of_measure, standard_cost, reorder_level, status) VALUES
((SELECT id FROM companies LIMIT 1), (SELECT id FROM material_categories WHERE code = 'FAB' LIMIT 1), 'FAB-001', 'Cotton Fabric White', 'METER', 50000, 100, 'active'),
((SELECT id FROM companies LIMIT 1), (SELECT id FROM material_categories WHERE code = 'FAB' LIMIT 1), 'FAB-002', 'Cotton Fabric Black', 'METER', 50000, 100, 'active'),
((SELECT id FROM companies LIMIT 1), (SELECT id FROM material_categories WHERE code = 'THR' LIMIT 1), 'THR-001', 'Thread White', 'KG', 80000, 10, 'active'),
((SELECT id FROM companies LIMIT 1), (SELECT id FROM material_categories WHERE code = 'THR' LIMIT 1), 'THR-002', 'Thread Black', 'KG', 80000, 10, 'active'),
((SELECT id FROM companies LIMIT 1), (SELECT id FROM material_categories WHERE code = 'BTN' LIMIT 1), 'BTN-001', 'Button White 15mm', 'PCS', 500, 1000, 'active')
ON CONFLICT DO NOTHING;

-- 3. Product Categories
INSERT INTO product_categories (company_id, name, description) VALUES
((SELECT id FROM companies LIMIT 1), 'T-Shirt', 'T-Shirts'),
((SELECT id FROM companies LIMIT 1), 'Polo', 'Polo Shirts'),
((SELECT id FROM companies LIMIT 1), 'Shirt', 'Formal Shirts')
ON CONFLICT DO NOTHING;

-- 4. Products
INSERT INTO products (company_id, code, name, category, unit_of_measure, selling_price, standard_cost, status) VALUES
((SELECT id FROM companies LIMIT 1), 'TSH-001', 'T-Shirt Basic White', 'T-Shirt', 'PCS', 150000, 100000, 'active'),
((SELECT id FROM companies LIMIT 1), 'TSH-002', 'T-Shirt Basic Black', 'T-Shirt', 'PCS', 150000, 100000, 'active'),
((SELECT id FROM companies LIMIT 1), 'PLO-001', 'Polo Basic White', 'Polo', 'PCS', 200000, 130000, 'active')
ON CONFLICT DO NOTHING;

-- 5. Vendors
INSERT INTO vendors (company_id, code, name, contact_person, phone, email, payment_terms, status) VALUES
((SELECT id FROM companies LIMIT 1), 'VEN-001', 'PT Fabric Supplier', 'John Doe', '08123456789', 'vendor1@example.com', 'NET_30', 'active'),
((SELECT id FROM companies LIMIT 1), 'VEN-002', 'CV Thread Supplier', 'Jane Smith', '08123456790', 'vendor2@example.com', 'NET_30', 'active')
ON CONFLICT DO NOTHING;

-- 6. Customers
INSERT INTO customers (company_id, code, name, contact_person, phone, email, credit_limit, payment_terms, status) VALUES
((SELECT id FROM companies LIMIT 1), 'CUS-001', 'Toko Retail ABC', 'Alice Brown', '08123456791', 'customer1@example.com', 10000000, 'NET_30', 'active'),
((SELECT id FROM companies LIMIT 1), 'CUS-002', 'Toko Retail XYZ', 'Bob Wilson', '08123456792', 'customer2@example.com', 5000000, 'NET_14', 'active')
ON CONFLICT DO NOTHING;

-- 7. Warehouses
INSERT INTO warehouses (company_id, code, name, address, city, is_active) VALUES
((SELECT id FROM companies LIMIT 1), 'WH-MAIN', 'Main Warehouse', 'Jakarta', 'Jakarta', true),
((SELECT id FROM companies LIMIT 1), 'WH-RETAIL', 'Retail Store', 'Jakarta', 'Jakarta', true)
ON CONFLICT DO NOTHING;

-- 8. Warehouse Bins
INSERT INTO bins (warehouse_id, code, name, is_active) VALUES
((SELECT id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1), 'A-01', 'Bin A-01', true),
((SELECT id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1), 'A-02', 'Bin A-02', true),
((SELECT id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1), 'FG-01', 'Finished Goods 01', true),
((SELECT id FROM warehouses WHERE code = 'WH-RETAIL' LIMIT 1), 'R-01', 'Retail Bin 01', true)
ON CONFLICT DO NOTHING;

-- 9. Sizes
INSERT INTO sizes (company_id, code, name, sort_order) VALUES
((SELECT id FROM companies LIMIT 1), 'S', 'Small', 1),
((SELECT id FROM companies LIMIT 1), 'M', 'Medium', 2),
((SELECT id FROM companies LIMIT 1), 'L', 'Large', 3),
((SELECT id FROM companies LIMIT 1), 'XL', 'Extra Large', 4)
ON CONFLICT DO NOTHING;

-- 10. Colors
INSERT INTO colors (company_id, code, name, hex_code) VALUES
((SELECT id FROM companies LIMIT 1), 'WHT', 'White', '#FFFFFF'),
((SELECT id FROM companies LIMIT 1), 'BLK', 'Black', '#000000'),
((SELECT id FROM companies LIMIT 1), 'RED', 'Red', '#FF0000'),
((SELECT id FROM companies LIMIT 1), 'BLU', 'Blue', '#0000FF')
ON CONFLICT DO NOTHING;

-- 11. Accounting Period
INSERT INTO accounting_periods (company_id, name, period_code, start_date, end_date, fiscal_year, status) VALUES
((SELECT id FROM companies LIMIT 1), 'January 2025', '2025-01', '2025-01-01', '2025-01-31', 2025, 'open'),
((SELECT id FROM companies LIMIT 1), 'February 2025', '2025-02', '2025-02-01', '2025-02-28', 2025, 'open')
ON CONFLICT DO NOTHING;

-- ==================== SUCCESS MESSAGE ====================
SELECT 'Test data seeded successfully!' as message,
       (SELECT COUNT(*) FROM materials) as materials_count,
       (SELECT COUNT(*) FROM products) as products_count,
       (SELECT COUNT(*) FROM vendors) as vendors_count,
       (SELECT COUNT(*) FROM customers) as customers_count,
       (SELECT COUNT(*) FROM warehouses) as warehouses_count;
