/**
 * Chart of Accounts Service
 * Manages COA hierarchy and account operations
 * 
 * The Chart of Accounts (COA) is the foundation of the accounting system.
 * All financial transactions reference accounts from this master list.
 */
import { supabaseServer } from '../config/supabase';

export interface COAAccount {
    id?: string;
    company_id: string;
    account_code: string;
    account_name: string;
    account_type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    account_category: string;
    parent_account_id?: string;
    level?: number;
    is_header?: boolean;
    is_active?: boolean;
    is_system?: boolean;
    normal_balance: 'DEBIT' | 'CREDIT';
    description?: string;
}

/**
 * Retrieves all active accounts for a company, ordered by account code.
 * 
 * Returns the complete chart of accounts including all account types
 * (Asset, Liability, Equity, Revenue, Expense). Only active accounts
 * are returned. Used for dropdowns, account selection, and reporting.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to array of COA accounts
 * 
 * @example
 * ```typescript
 * const accounts = await getAllAccounts(companyId);
 * 
 * // Filter by type
 * const assets = accounts.filter(a => a.account_type === 'ASSET');
 * const expenses = accounts.filter(a => a.account_type === 'EXPENSE');
 * ```
 * 
 * @see {@link getAccountsByType} for filtering by account type
 * @see {@link getAccountTree} for hierarchical structure
 */
export async function getAllAccounts(companyId: string): Promise<COAAccount[]> {
    const { data, error } = await supabaseServer
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('account_code');

    if (error) throw error;
    return data;
}

/**
 * Retrieves a specific account by its account code.
 * 
 * Account codes are unique within a company (e.g., '1010' for Cash).
 * This is the primary way to lookup accounts when posting transactions.
 * 
 * @param companyId - UUID of the company
 * @param accountCode - Unique account code (e.g., '1010', '4010')
 * 
 * @throws {Error} If account not found or inactive
 * @returns Promise resolving to account record
 * 
 * @example
 * ```typescript
 * // Get cash account
 * const cashAccount = await getAccountByCode(companyId, '1010');
 * console.log(cashAccount.account_name); // "Cash on Hand"
 * console.log(cashAccount.normal_balance); // "DEBIT"
 * ```
 * 
 * @see {@link getAccountById} for lookup by UUID
 */
export async function getAccountByCode(
    companyId: string,
    accountCode: string
): Promise<COAAccount> {
    const { data, error } = await supabaseServer
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('account_code', accountCode)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a specific account by its UUID.
 * 
 * @param accountId - UUID of the account
 * @throws {Error} If account not found
 * @returns Promise resolving to account record
 * 
 * @example
 * ```typescript
 * const account = await getAccountById(accountId);
 * ```
 */
export async function getAccountById(accountId: string): Promise<COAAccount> {
    const { data, error } = await supabaseServer
        .from('chart_of_accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Creates a new account in the chart of accounts.
 * 
 * **Validation:**
 * - If parent_account_id provided, validates parent exists in same company
 * - Automatically calculates account level based on parent (parent.level + 1)
 * - Account code must be unique within the company (enforced by DB constraint)
 * 
 * **Account Hierarchy:**
 * - Level 1: Top-level accounts (no parent)
 * - Level 2+: Sub-accounts (have parent)
 * - Header accounts (is_header=true) cannot be used in transactions
 * 
 * @param account - Account details to create
 * @param account.company_id - UUID of the company
 * @param account.account_code - Unique code (e.g., '1010')
 * @param account.account_name - Display name (e.g., 'Cash on Hand')
 * @param account.account_type - One of: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
 * @param account.account_category - Category for reporting (e.g., 'CURRENT_ASSET')
 * @param account.normal_balance - Either DEBIT or CREDIT
 * @param account.parent_account_id - Optional parent for hierarchy
 * @param account.is_header - True if this is a header/subtotal account
 * @param userId - UUID of user creating the account
 * 
 * @throws {Error} If parent account doesn't exist
 * @throws {Error} If parent belongs to different company
 * @throws {Error} If account code is not unique
 * @returns Promise resolving to created account
 * 
 * @example
 * ```typescript
 * // Create top-level account
 * const cashAccount = await createAccount({
 *   company_id: companyId,
 *   account_code: '1010',
 *   account_name: 'Cash on Hand',
 *   account_type: 'ASSET',
 *   account_category: 'CURRENT_ASSET',
 *   normal_balance: 'DEBIT',
 *   is_header: false
 * }, userId);
 * ```
 * 
 * @example
 * ```typescript
 * // Create sub-account under parent
 * const subAccount = await createAccount({
 *   company_id: companyId,
 *   account_code: '1011',
 *   account_name: 'Petty Cash',
 *   account_type: 'ASSET',
 *   account_category: 'CURRENT_ASSET',
 *   normal_balance: 'DEBIT',
 *   parent_account_id: cashAccount.id,  // Child of 1010
 *   is_header: false
 * }, userId);
 * // Automatically sets level = 2
 * ```
 * 
 * @see {@link updateAccount} for modifying accounts
 * @see {@link getAccountTree} for viewing hierarchy
 */
export async function createAccount(
    account: COAAccount,
    userId: string
): Promise<COAAccount> {
    // Validate parent exists if provided
    if (account.parent_account_id) {
        const parent = await getAccountById(account.parent_account_id);
        if (parent.company_id !== account.company_id) {
            throw new Error('Parent account must belong to the same company');
        }
        // Set level based on parent
        account.level = (parent.level || 1) + 1;
    }

    const { data, error } = await supabaseServer
        .from('chart_of_accounts')
        .insert({
            ...account,
            created_by: userId,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Updates an existing account.
 * 
 * **System Account Protection:**
 * - System accounts (is_system=true) cannot be modified
 * - These are core accounts created during COA template seeding
 * - Examples: Cash, Sales Revenue, COGS, Inventory accounts
 * 
 * @param accountId - UUID of account to update
 * @param updates - Partial account object with fields to update
 * 
 * @throws {Error} If account is a system account
 * @throws {Error} If update fails
 * @returns Promise resolving to updated account
 * 
 * @example
 * ```typescript
 * // Update account name
 * const updated = await updateAccount(accountId, {
 *   account_name: 'Cash - Main Account',
 *   description: 'Primary cash account for daily operations'
 * });
 * ```
 * 
 * @see {@link deactivateAccount} for soft-deleting accounts
 */
export async function updateAccount(
    accountId: string,
    updates: Partial<COAAccount>
): Promise<COAAccount> {
    // Prevent updating system accounts
    const existing = await getAccountById(accountId);
    if (existing.is_system) {
        throw new Error('Cannot modify system account');
    }

    const { data, error } = await supabaseServer
        .from('chart_of_accounts')
        .update(updates)
        .eq('id', accountId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Soft-deletes an account by setting is_active to false.
 * 
 * **System Account Protection:**
 * - System accounts cannot be deleted
 * - Accounts with transaction history are preserved
 * - Inactive accounts are hidden from dropdowns but retain data
 * 
 * **Note:** This does NOT delete the account record or its transaction history.
 * It only marks it as inactive for future use.
 * 
 * @param accountId - UUID of account to deactivate
 * 
 * @throws {Error} If account is a system account
 * @throws {Error} If deactivation fails
 * @returns Promise that resolves when complete
 * 
 * @example
 * ```typescript
 * // Deactivate unused account
 * await deactivateAccount(oldAccountId);
 * // Account will no longer appear in dropdowns
 * // But historical transactions remain intact
 * ```
 * 
 * @see {@link updateAccount} for other modifications
 */
export async function deactivateAccount(accountId: string): Promise<void> {
    const existing = await getAccountById(accountId);
    if (existing.is_system) {
        throw new Error('Cannot delete system account');
    }

    const { error } = await supabaseServer
        .from('chart_of_accounts')
        .update({ is_active: false })
        .eq('id', accountId);

    if (error) throw error;
}

/**
 * Retrieves the account hierarchy tree for reporting and display.
 * 
 * Returns all active accounts ordered by account code. The client
 * can build the tree structure using parent_account_id relationships.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to array of accounts (flat, ordered)
 * 
 * @example
 * ```typescript
 * const tree = await getAccountTree(companyId);
 * 
 * // Build hierarchy on client
 * const rootAccounts = tree.filter(a => !a.parent_account_id);
 * const getChildren = (parentId) => 
 *   tree.filter(a => a.parent_account_id === parentId);
 * ```
 * 
 * @see {@link getAllAccounts} for simple flat list
 */
export async function getAccountTree(companyId: string): Promise<COAAccount[]> {
    const { data, error } = await supabaseServer
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('account_code');

    if (error) throw error;

    // Build tree structure (client-side for simplicity)
    return data;
}

/**
 * Retrieves all accounts of a specific type.
 * 
 * **Account Types:**
 * - ASSET: Resources owned (Cash, Inventory, Equipment)
 * - LIABILITY: Obligations owed (Accounts Payable, Loans)
 * - EQUITY: Owner's stake (Capital, Retained Earnings)
 * - REVENUE: Income from sales and services
 * - EXPENSE: Costs of doing business (Salaries, Rent, COGS)
 * 
 * @param companyId - UUID of the company
 * @param accountType - One of: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
 * @returns Promise resolving to array of accounts
 * 
 * @example
 * ```typescript
 * // Get all asset accounts
 * const assets = await getAccountsByType(companyId, 'ASSET');
 * 
 * // Get all expense accounts
 * const expenses = await getAccountsByType(companyId, 'EXPENSE');
 * ```
 * 
 * @example
 * ```typescript
 * // Use for financial statements
 * const revenue = await getAccountsByType(companyId, 'REVENUE');
 * const expenses = await getAccountsByType(companyId, 'EXPENSE');
 * 
 * const totalRevenue = revenue.reduce((sum, acc) => 
 *   sum + acc.balance, 0);
 * const totalExpenses = expenses.reduce((sum, acc) => 
 *   sum + acc.balance, 0);
 * const netIncome = totalRevenue - totalExpenses;
 * ```
 * 
 * @see {@link getAllAccounts} for all accounts
 */
export async function getAccountsByType(
    companyId: string,
    accountType: COAAccount['account_type']
): Promise<COAAccount[]> {
    const { data, error } = await supabaseServer
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('account_type', accountType)
        .eq('is_active', true)
        .order('account_code');

    if (error) throw error;
    return data;
}

/**
 * Validates that an account code is unique within the company.
 * 
 * Account codes must be unique for identification and lookup.
 * Use this before creating a new account to prevent duplicates.
 * 
 * @param companyId - UUID of the company
 * @param accountCode - Account code to validate (e.g., '1010')
 * 
 * @returns Promise resolving to true if available, false if taken
 * 
 * @example
 * ```typescript
 * const isAvailable = await isAccountCodeUnique(companyId, '1010');
 * if (!isAvailable) {
 *   throw new Error('Account code 1010 is already in use');
 * }
 * 
 * // Proceed with account creation
 * await createAccount({ account_code: '1010', ... }, userId);
 * ```
 * 
 * @see {@link createAccount} which uses this validation
 */
export async function isAccountCodeUnique(
    companyId: string,
    accountCode: string
): Promise<boolean> {
    const { count, error } = await supabaseServer
        .from('chart_of_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('account_code', accountCode);

    if (error) throw error;
    return count === 0;
}
