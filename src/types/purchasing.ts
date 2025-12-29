export type POStatus = 'draft' | 'submitted' | 'approved' | 'partial' | 'closed' | 'cancelled';
export type GRNStatus = 'draft' | 'posted' | 'cancelled';

export interface PurchaseOrderLine {
    id: string;
    po_id: string;
    material_id: string;
    line_number?: number;
    qty_ordered: number;
    qty_received: number;
    qty_invoiced: number;
    unit_price: number;
    line_total: number;
    material?: {
        name: string;
        code: string;
        unit_of_measure: string;
    };
}

export interface PurchaseOrder {
    id: string;
    company_id: string;
    po_number: string;
    po_date: string;
    vendor_id: string;
    warehouse_id: string;
    period_id: string;
    status: POStatus;
    total_amount: number;
    delivery_date?: string;
    notes?: string;
    vendor?: {
        name: string;
        code: string;
    };
    lines?: PurchaseOrderLine[];
    created_by: string;
    created_at: string;
}

export interface GoodsReceiptLine {
    id: string;
    grn_id: string;
    po_line_id?: string;
    material_id: string;
    bin_id: string;
    qty_received: number;
    unit_cost: number;
    line_total: number;
    qty_accepted?: number;
    qty_rejected?: number;
    notes?: string;
    material?: {
        name: string;
        code: string;
        unit_of_measure: string;
    };
}

export interface GoodsReceiptNote {
    id: string;
    company_id: string;
    grn_number: string;
    grn_date: string;
    po_id?: string;
    vendor_id: string;
    warehouse_id: string;
    period_id: string;
    status: GRNStatus;
    delivery_note_number?: string;
    vehicle_number?: string;
    notes?: string;
    created_by: string;
    created_at: string;
    lines?: GoodsReceiptLine[];
}

export interface CreateGRNPayload {
    company_id: string;
    po_id: string;
    vendor_id: string;
    warehouse_id: string; // From PO or selected
    grn_date: string;
    delivery_note_number?: string;
    vehicle_number?: string;
    notes?: string;
    items: {
        po_line_id: string;
        material_id: string;
        qty_received: number;
        unit_cost: number;
        bin_id: string; // Required by schema
        notes?: string;
    }[];
}
