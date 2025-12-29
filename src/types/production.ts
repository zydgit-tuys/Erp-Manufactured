export type BOMStatus = boolean; // is_active
export type ProductionStatus = 'planned' | 'released' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
export type WipStage = 'preparation' | 'assembly' | 'finishing' | 'packaging';

export interface BOMHeader {
    id: string;
    company_id: string;
    product_id: string;
    version: string;
    is_active: boolean;
    base_qty: number;
    yield_percentage: number;
    notes?: string;
    created_at: string;
    product?: {
        code: string;
        name: string;
        unit_of_measure: string;
    };
    lines?: BOMLine[];
}

export interface BOMLine {
    id: string;
    bom_id: string;
    line_number: number;
    material_id?: string;
    component_product_id?: string;
    qty_per: number;
    uom: string;
    scrap_percentage: number;
    stage: WipStage;
    notes?: string;
    material?: {
        code: string;
        name: string;
    };
    component_product?: {
        code: string;
        name: string;
    };
}

export interface ProductionOrder {
    id: string;
    company_id: string;
    po_number: string; // Database column is po_number, not wo_number
    po_date: string;
    product_id: string;
    bom_id: string;
    warehouse_id: string;
    period_id: string;

    qty_planned: number;
    qty_completed: number;
    qty_rejected: number;
    qty_outstanding: number;

    start_date?: string;
    due_date?: string;
    completion_date?: string;

    status: ProductionStatus;
    priority: number;

    standard_cost: number;
    actual_cost: number;
    cost_variance: number;

    notes?: string;
    created_at: string;

    product?: {
        code: string;
        name: string;
    };
}

export interface ProductionReservation {
    id: string;
    production_order_id: string;
    material_id: string;
    stage: WipStage;
    qty_required: number;
    qty_issued: number;
    qty_outstanding: number;
    unit_cost: number;
}
