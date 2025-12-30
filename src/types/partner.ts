export type PaymentTerm = 'COD' | 'NET_7' | 'NET_14' | 'NET_30' | 'NET_60' | 'CUSTOM';
export type PartnerStatus = 'active' | 'inactive' | 'blocked';

export interface Vendor {
    id: string;
    company_id: string;
    code: string;
    name: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    tax_id?: string;
    payment_terms: PaymentTerm;
    custom_payment_days?: number;
    credit_limit: number;
    status: PartnerStatus;
    notes?: string;
    created_at: string;
    updated_at?: string;
}

export interface Customer {
    id: string;
    company_id: string;
    code: string;
    name: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    tax_id?: string;
    payment_terms: PaymentTerm;
    custom_payment_days?: number;
    credit_limit: number;
    credit_hold: boolean;
    status: PartnerStatus;
    customer_type?: string;
    discount_percentage: number;
    notes?: string;
    created_at: string;
    updated_at?: string;
}
