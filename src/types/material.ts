export type MaterialStatus = 'active' | 'inactive' | 'archived';

export interface Material {
    id: string;
    company_id: string;
    category_id?: string;
    code: string;
    name: string;
    description?: string;
    unit_of_measure: string;
    standard_cost: number;
    reorder_level: number;
    status: MaterialStatus;
    supplier_code?: string;
    lead_time_days: number;
    notes?: string;
    created_at: string;
    updated_at: string;

    category?: MaterialCategory;
}

export interface MaterialCategory {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    created_at: string;
}
