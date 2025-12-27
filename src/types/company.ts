export interface CompanySettings {
    modules?: {
        marketplace?: boolean;
        finance?: boolean;
        analytics?: boolean;
        manufacturing?: boolean;
    };
    [key: string]: any;
}

export interface Company {
    id: string;
    name: string;
    code?: string; // Ticker/Short code
    industry?: string;
    settings: CompanySettings;
    created_at: string;
    user_company_mapping?: {
        role: string;
    }[];
}
