/**
 * Company Service
 * Manages company CRUD operations and tenant setup
 */
import { supabaseServer } from '../config/supabase';

export interface Company {
    id?: string;
    code: string;
    name: string;
    tax_id?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    base_currency?: string;
    fiscal_year_start_month?: number;
    is_active?: boolean;
}

/**
 * Creates a new company with automatic COA template seeding.
 * 
 * This is the primary tenant creation function. It creates a company record,
 * maps the user as admin, and automatically seeds the Chart of Accounts template
 * (60+ standard accounts). Implements rollback on failure for data consistency.
 * 
 * @param company - Company details to create
 * @param company.code - Unique company code (validated for uniqueness)
 * @param company.name - Company legal name
 * @param company.email - Company email address
 * @param company.base_currency - Base currency code (e.g., 'IDR', 'USD')
 * @param userId - UUID of the user creating the company (becomes admin)
 * 
 * @throws {Error} If company code is not unique
 * @throws {Error} If user mapping fails (triggers rollback)
 * @returns Promise resolving to object with company ID and code
 * 
 * @example
 * ```typescript
 * const result = await createCompany({
 *   code: 'ACME001',
 *   name: 'ACME Corporation',
 *   email: 'info@acme.com',
 *   base_currency: 'USD'
 * }, userId);
 * 
 * console.log(`Created company: ${result.id}`);
 * ```
 * 
 * @see {@link isCompanyCodeUnique} for code validation
 * @see {@link getUserCompanies} for retrieving user's companies
 */
export async function createCompany(
    company: Company,
    userId: string
): Promise<{ id: string; code: string }> {
    // Create company
    const { data: newCompany, error: companyError } = await supabaseServer
        .from('companies')
        .insert({
            ...company,
            created_by: userId,
        })
        .select()
        .single();

    if (companyError) throw companyError;

    // Map user to company
    const { error: mappingError } = await supabaseServer
        .from('user_company_mapping')
        .insert({
            user_id: userId,
            company_id: newCompany.id,
            role: 'admin',
            is_active: true,
        });

    if (mappingError) {
        // Rollback company creation
        await supabaseServer.from('companies').delete().eq('id', newCompany.id);
        throw mappingError;
    }

    // Seed COA template
    const { error: coaError } = await supabaseServer.rpc('seed_coa_template', {
        p_company_id: newCompany.id,
    });

    if (coaError) {
        // Log error but don't rollback (COA can be added later)
        console.error('Failed to seed COA template:', coaError);
    }

    return { id: newCompany.id, code: newCompany.code };
}

/**
 * Retrieves a company by its unique ID.
 * 
 * @param companyId - UUID of the company to retrieve
 * @throws {Error} If company not found or inactive
 * @returns Promise resolving to company record
 * 
 * @example
 * ```typescript
 * const company = await getCompanyById(companyId);
 * console.log(company.name);
 * ```
 */
export async function getCompanyById(companyId: string): Promise<Company> {
    const { data, error } = await supabaseServer
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .eq('is_active', true)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all companies accessible to a specific user.
 * 
 * Returns companies based on user_company_mapping table. Users can have
 * access to multiple companies with different roles (admin, user, etc).
 * 
 * @param userId - UUID of the user
 * @returns Promise resolving to array of companies
 * 
 * @example
 * ```typescript
 * const companies = await getUserCompanies(userId);
 * companies.forEach(c => console.log(c.name));
 * ```
 */
export async function getUserCompanies(userId: string): Promise<Company[]> {
    const { data, error } = await supabaseServer
        .from('user_company_mapping')
        .select('company:companies(*)')
        .eq('user_id', userId)
        .eq('is_active', true);

    if (error) throw error;
    return data.map((item: any) => item.company);
}

/**
 * Updates company details.
 * 
 * @param companyId - UUID of the company to update
 * @param updates - Partial company object with fields to update
 * @throws {Error} If update fails
 * @returns Promise resolving to updated company record
 */
export async function updateCompany(
    companyId: string,
    updates: Partial<Company>
): Promise<Company> {
    const { data, error } = await supabaseServer
        .from('companies')
        .update(updates)
        .eq('id', companyId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Soft deletes a company by setting is_active to false.
 * 
 * Company data is preserved for audit trail. RLS policies will prevent
 * access to inactive companies.
 * 
 * @param companyId - UUID of the company to deactivate
 * @throws {Error} If deactivation fails
 * @returns Promise that resolves when complete
 */
export async function deactivateCompany(companyId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('companies')
        .update({ is_active: false })
        .eq('id', companyId);

    if (error) throw error;
}

/**
 * Validates that a company code is unique across the system.
 * 
 * Company codes must be unique for identification purposes.
 * Use this before creating a new company to ensure no duplicates.
 * 
 * @param code - Company code to validate
 * @returns Promise resolving to true if code is available, false if taken
 * 
 * @example
 * ```typescript
 * const isAvailable = await isCompanyCodeUnique('ACME001');
 * if (!isAvailable) {
 *   throw new Error('Company code already exists');
 * }
 * ```
 */
export async function isCompanyCodeUnique(code: string): Promise<boolean> {
    const { count, error } = await supabaseServer
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('code', code);

    if (error) throw error;
    return count === 0;
}
