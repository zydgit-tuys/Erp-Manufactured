export type PeriodStatus = 'open' | 'closed';

export interface AccountingPeriod {
    id: string;
    company_id: string;
    period_code: string;
    name: string;
    start_date: string;
    end_date: string;
    fiscal_year: number;
    status: PeriodStatus;
    closed_at: string | null;
    closed_by: string | null;
    reopened_at: string | null;
    reopened_by: string | null;
    created_at: string;
    created_by: string;
}
