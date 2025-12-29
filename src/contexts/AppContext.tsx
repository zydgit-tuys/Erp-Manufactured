import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AppContextType {
    companyId: string | null;
    warehouseId: string | null;
    userId: string | null;
    setCompanyId: (id: string) => void;
    setWarehouseId: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [companyId, setCompanyIdState] = useState<string | null>(null);
    const [warehouseId, setWarehouseIdState] = useState<string | null>(null);

    // Get user's default company and warehouse from profile or settings
    useEffect(() => {
        if (user) {
            // Try to get from localStorage first (user's last selection)
            const savedCompanyId = localStorage.getItem('selected_company_id');
            const savedWarehouseId = localStorage.getItem('selected_warehouse_id');

            if (savedCompanyId) {
                setCompanyIdState(savedCompanyId);
            } else {
                // Fallback: Get first company from database
                supabase
                    .from('companies')
                    .select('id')
                    .limit(1)
                    .single()
                    .then(({ data }) => {
                        if (data) {
                            setCompanyIdState(data.id);
                            localStorage.setItem('selected_company_id', data.id);
                        }
                    });
            }

            if (savedWarehouseId) {
                setWarehouseIdState(savedWarehouseId);
            } else {
                // Fallback: Get first warehouse from database
                supabase
                    .from('warehouses')
                    .select('id')
                    .limit(1)
                    .single()
                    .then(({ data }) => {
                        if (data) {
                            setWarehouseIdState(data.id);
                            localStorage.setItem('selected_warehouse_id', data.id);
                        }
                    });
            }
        }
    }, [user]);

    const setCompanyId = (id: string) => {
        setCompanyIdState(id);
        localStorage.setItem('selected_company_id', id);
    };

    const setWarehouseId = (id: string) => {
        setWarehouseIdState(id);
        localStorage.setItem('selected_warehouse_id', id);
    };

    return (
        <AppContext.Provider
            value={{
                companyId,
                warehouseId,
                userId: user?.id || null,
                setCompanyId,
                setWarehouseId,
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
