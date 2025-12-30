export type ProductStatus = 'active' | 'inactive' | 'archived';

export interface ProductCategory {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    created_at: string;
}

export interface ProductAttribute {
    name: string;
    value: string;
}

export interface ProductVariant {
    id: string;
    product_id: string;
    company_id: string;
    sku: string;
    price: number;
    unit_cost: number; // M1: Finished Goods Cost
    attributes?: Record<string, string>; // JSONB

    // Phase 13: Automation & Inventory Control
    reorder_point?: number;
    reorder_qty?: number;
    preferred_vendor_id?: string;

    is_active: boolean;
    created_at: string;
    updated_at: string;

    // UI Helpers
    product_name?: string;
    display_name?: string; // Generated Name + Attributes
}

export type ProcurementMethod = 'buy' | 'make' | 'both';

export interface Product {
    id: string;
    company_id: string;
    code: string;
    name: string;
    description?: string;
    category_id?: string;
    unit_of_measure: string;
    status: ProductStatus;
    procurement_method: ProcurementMethod;

    track_inventory: boolean;
    minimum_stock_level: number;

    created_by: string;
    created_at: string;
    updated_at: string;

    // Relationships
    category?: ProductCategory;
    variants?: ProductVariant[];
}
