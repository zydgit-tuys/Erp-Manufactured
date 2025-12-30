
// Production Status Constants
export const PRODUCTION_STATUS = {
    PLANNED: 'planned',
    RELEASED: 'released',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CLOSED: 'closed',
    CANCELLED: 'cancelled'
} as const;

export const WIP_STAGE = {
    PREPARATION: 'preparation',
    ASSEMBLY: 'assembly',
    FINISHING: 'finishing',
    PACKAGING: 'packaging'
} as const;

// Purchasing Status Constants
export const PURCHASE_ORDER_STATUS = {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    APPROVED: 'approved',
    PARTIAL: 'partial',
    CLOSED: 'closed',
    CANCELLED: 'cancelled'
} as const;

export const GRN_STATUS = {
    DRAFT: 'draft',
    POSTED: 'posted',
    CANCELLED: 'cancelled'
} as const;

// Sales Status Constants
export const SALES_ORDER_STATUS = {
    DRAFT: 'draft',
    APPROVED: 'approved',
    SENT: 'sent',
    IN_DELIVERY: 'in_delivery',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
} as const;

export const INVOICE_STATUS = {
    DRAFT: 'draft',
    POSTED: 'posted',
    VOID: 'void'
} as const;

export const PAYMENT_STATUS = {
    UNPAID: 'unpaid',
    PARTIAL: 'partial',
    PAID: 'paid',
    OVERDUE: 'overdue'
} as const;

// Inventory Constants
export const LEDGER_TYPE = {
    RAW: 'RAW',
    WIP: 'WIP',
    FG: 'FG'
} as const;

export const TRANSACTION_TYPE = {
    RECEIPT: 'RECEIPT',
    ISSUE: 'ISSUE',
    ADJUSTMENT_IN: 'ADJUSTMENT_IN',
    ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
    TRANSFER_IN: 'TRANSFER_IN',
    TRANSFER_OUT: 'TRANSFER_OUT',
    PRODUCTION_IN: 'PRODUCTION_IN',
    PRODUCTION_OUT: 'PRODUCTION_OUT',
    SALES_OUT: 'SALES_OUT'
} as const;
