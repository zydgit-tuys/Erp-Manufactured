
/**
 * parses Supabase/Postgres errors into user-friendly messages.
 * @param error The error object returned by Supabase or React Query
 * @returns A friendly string message
 */
export const handleSupabaseError = (error: any): string => {
    if (!error) return "An unknown error occurred.";

    const message = error.message || error.error_description || JSON.stringify(error);

    // 1. Stock Availability Errors (P0001 usually raised by our exceptions)
    if (message.toLowerCase().includes("insufficient stock")) {
        // SQL Error format: "Insufficient Stock for: Item (Req: 10, Avail: 5)"
        // We can just return the clean message part if it's already formatted well in SQL
        // Or strip technical prefixes
        return message.replace(/^Error: /, '').replace(/^Exception: /, '');
    }

    // 2. Accounting Period Locked
    if (message.toLowerCase().includes("period is closed") || message.toLowerCase().includes("period is locked")) {
        return "Action denied: The accounting period for this date is closed/locked.";
    }

    // 3. Negative Stock (Database Constraint)
    if (message.toLowerCase().includes("check_negative_stock") || message.toLowerCase().includes("violates check constraint")) {
        return "Operation failed: This action would result in negative stock.";
    }

    // 4. RLS / Permission Errors
    if (message.toLowerCase().includes("policy") || message.toLowerCase().includes("row-level security")) {
        return "Access denied: You do not have permission to perform this action.";
    }

    // 5. Unique Constraints (e.g., Duplicate SKU)
    if (message.toLowerCase().includes("duplicate key") || message.toLowerCase().includes("unique constraint")) {
        if (message.includes("code")) return "This code/SKU already exists. Please use a unique one.";
        if (message.includes("email")) return "This email address is already registered.";
        return "Duplicate entry found. Please ensure unique values.";
    }

    // Fallback: Return standard message but cleaned up
    return `System Error: ${message}`;
};
