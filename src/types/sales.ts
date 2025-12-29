export type SalesOrderStatus = 'draft' | 'approved' | 'sent' | 'in_delivery' | 'completed' | 'cancelled';

// Based on 016_vendor_payments.sql
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD';
export type InvoiceStatus = 'draft' | 'posted' | 'void';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export interface SalesOrder {
    id: string;
    company_id: string;
    so_number: string;
    so_date: string;
    customer_id: string;
    warehouse_id: string;
    period_id: string;

    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;

    status: SalesOrderStatus;
    payment_terms: string;
    due_date?: string;
    delivery_date?: string;
    notes?: string;

    customer?: {
        name: string;
        email?: string;
    };
    lines?: SalesOrderLine[];
}

export interface SalesOrderLine {
    id: string;
    so_id: string;
    line_number: number;
    product_variant_id: string;
    qty_ordered: number;
    qty_delivered: number;
    qty_invoiced: number;
    unit_price: number;
    discount_percentage: number;
    line_total: number;
    notes?: string;
    product_variant?: {
        sku: string;
        product?: {
            name: string;
        };
        attributes?: Record<string, any>;
    };
}

export interface CreateSOPayload {
    customer_id: string;
    warehouse_id: string;
    so_date: string;
    notes?: string;
    items: {
        variant_id: string;
        qty: number;
        price: number;
        discount?: number;
    }[];
}

export interface POSOrderPayload {
    warehouse_id: string;
    sale_date: string;
    items: { variant_id: string, qty: number, price: number, discount?: number }[];
    payment_method: PaymentMethod;
    amount_tendered?: number;
    notes?: string;
}

export interface SalesInvoice {
    id: string;
    company_id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    so_id?: string;
    do_id?: string;
    customer_id: string;
    period_id: string;

    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;

    payment_status: PaymentStatus;
    amount_paid: number;
    amount_due: number;
    payment_terms?: string;
    status: InvoiceStatus;
    notes?: string;

    customer?: {
        name: string;
        email?: string;
    };
    lines?: SalesInvoiceLine[];
}

export interface SalesInvoiceLine {
    id: string;
    invoice_id: string;
    line_number: number;
    so_line_id?: string;
    do_line_id?: string;
    product_variant_id: string;
    qty_invoiced: number;
    unit_price: number;
    discount_percentage: number;
    line_total: number;
    notes?: string;
    product_variant?: {
        sku: string;
        product?: {
            name: string;
        };
    };
}
