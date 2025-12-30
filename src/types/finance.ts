// ==================== COA ====================

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type AccountCategory =
    | 'CURRENT_ASSET' | 'FIXED_ASSET'
    | 'CURRENT_LIABILITY' | 'LONG_TERM_LIABILITY'
    | 'EQUITY'
    | 'OPERATING_REVENUE' | 'OTHER_REVENUE'
    | 'COGS' | 'OPERATING_EXPENSE' | 'OTHER_EXPENSE';

export interface ChartOfAccount {
    id: string;
    company_id: string;
    code: string;
    name: string;
    type: AccountType;
    category: AccountCategory;
    parent_account_id?: string;
    is_active: boolean;
    description?: string;
    level: number; // For hierarchy indentation

    // Flattened hierarchy helper
    children?: ChartOfAccount[];
}

// ==================== JOURNALS ====================

export type JournalStatus = 'draft' | 'posted' | 'void';

export interface Journal {
    id: string;
    company_id: string;
    journal_number: string;
    period_id: string;
    journal_date: string;
    status: JournalStatus;
    reference_type?: string; // Enum 'SALES', 'PURCHASE', 'PAYMENT', 'MANUAL'
    reference_id?: string;
    reference_number?: string;
    description?: string;

    total_debit: number;
    total_credit: number;

    is_balanced: boolean; // Computed by logic, not always in DB

    created_by: string;
    created_at: string;
    posted_by?: string;
    posted_at?: string;

    lines?: JournalLine[];
}

export interface JournalLine {
    id: string;
    journal_id: string;
    account_id: string;
    description?: string;
    debit: number;
    credit: number;

    // Relationship
    account?: {
        code: string;
        name: string;
    };
}
