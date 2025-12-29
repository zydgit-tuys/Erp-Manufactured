
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';

export interface ProductVariant {
    id: string;
    product_id: string;
    sku: string;
    size?: string;
    color?: string;
    material?: string;
    price: number;
    cost_price: number;
    current_qty: number;
    attributes?: any;
    is_active: boolean;
}

export interface Product {
    id: string;
    company_id: string;
    code: string;
    name: string;
    description: string;
    category: string;
    unit_of_measure: string;
    selling_price: number;
    standard_cost?: number;
    barcode?: string;
    notes?: string;
    image_url?: string;
    status: 'active' | 'inactive';
    created_by: string;
    updated_by?: string;
    created_at: string;
    updated_at?: string;
    variants: ProductVariant[];
}

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
    payment_terms: 'COD' | 'NET_7' | 'NET_14' | 'NET_30' | 'NET_60' | 'CUSTOM';
    custom_payment_days?: number;
    credit_limit: number;
    status: 'active' | 'inactive' | 'blocked';
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
    payment_terms: 'COD' | 'NET_7' | 'NET_14' | 'NET_30' | 'NET_60' | 'CUSTOM';
    custom_payment_days?: number;
    credit_limit: number;
    credit_hold: boolean;
    status: 'active' | 'inactive' | 'blocked';
    customer_type?: string;
    discount_percentage: number;
    notes?: string;
    created_at: string;
    updated_at?: string;
}

export const useProducts = (companyId: string) => {
    return useQuery({
        queryKey: ['products', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    variants:product_variants(*)
                `)
                .eq('company_id', companyId)
                .order('name');

            if (error) throw error;
            return data as Product[];
        },
        enabled: !!companyId,
    });
};

export const useVendors = (companyId: string) => {
    return useQuery({
        queryKey: ['vendors', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vendors')
                .select('*')
                .eq('company_id', companyId)
                .order('name');

            if (error) throw error;
            return data as Vendor[];
        },
        enabled: !!companyId,
    });
};

export const useCustomers = (companyId: string) => {
    return useQuery({
        queryKey: ['customers', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('company_id', companyId)
                .order('name');

            if (error) throw error;
            return data as Customer[];
        },
        enabled: !!companyId,
    });
};

export const useSizes = (companyId: string) => {
    return useQuery({
        queryKey: ['sizes', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sizes')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .order('sort_order');
            if (error) throw error;
            return data;
        },
        enabled: !!companyId
    });
};

export const useColors = (companyId: string) => {
    return useQuery({
        queryKey: ['colors', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('colors')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .order('sort_order');
            if (error) throw error;
            return data;
        },
        enabled: !!companyId
    });
};

export const useCreateProduct = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: any) => {
            // 1. Create Product Header
            const { data: product, error: prodError } = await supabase
                .from('products')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    code: payload.code,
                    name: payload.name,
                    description: payload.description || null,
                    category: payload.category || null,
                    unit_of_measure: payload.unit_of_measure,
                    selling_price: payload.selling_price,
                    standard_cost: payload.standard_cost,
                    barcode: payload.barcode,
                    notes: payload.notes,
                    status: 'active'
                })
                .select()
                .single();

            if (prodError) throw prodError;

            // 2. Create Variants
            if (payload.variants && payload.variants.length > 0) {
                const variantsToInsert = payload.variants.map((v: any) => ({
                    company_id: companyId,
                    product_id: product.id,
                    size_id: v.size_id,
                    color_id: v.color_id,
                    sku: '',
                    unit_price: v.price || payload.selling_price,
                    unit_cost: v.cost || payload.standard_cost || 0,
                    status: 'active'
                    // SKU is auto-generated by DB trigger
                }));

                const { error: varError } = await supabase
                    .from('product_variants')
                    .insert(variantsToInsert);

                if (varError) throw varError;
            }

            return product;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: "Product Created", description: "Product and variants saved successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useCreateSize = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId } = useApp();

    return useMutation({
        mutationFn: async ({ code, name }: { code: string; name: string }) => {
            const { error } = await supabase
                .from('sizes')
                .insert({ company_id: companyId, code, name, is_active: true });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sizes'] });
            toast({ title: "Size Added", description: "New size has been created." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteSize = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('sizes').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sizes'] });
            toast({ title: "Size Deleted", description: "Size has been removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useCreateColor = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId } = useApp();

    return useMutation({
        mutationFn: async ({ code, name, hex_code }: { code: string; name: string; hex_code?: string }) => {
            const { error } = await supabase
                .from('colors')
                .insert({ company_id: companyId, code, name, hex_code, is_active: true });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['colors'] });
            toast({ title: "Color Added", description: "New color has been created." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteColor = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('colors').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['colors'] });
            toast({ title: "Color Deleted", description: "Color has been removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useCategories = (companyId: string) => {
    return useQuery({
        queryKey: ['product_categories', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('product_categories')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .order('name');
            if (error) throw error;
            return data;
        },
        enabled: !!companyId
    });
};

export const useCreateCategory = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId } = useApp();

    return useMutation({
        mutationFn: async ({ name, description }: { name: string; description?: string }) => {
            const { error } = await supabase
                .from('product_categories')
                .insert({ company_id: companyId, name, description, is_active: true });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product_categories'] });
            toast({ title: "Category Added", description: "New category has been created." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteCategory = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('product_categories').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product_categories'] });
            toast({ title: "Category Deleted", description: "Category has been removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useUpdateProduct = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const { error } = await supabase
                .from('products')
                .update({
                    name: payload.name,
                    description: payload.description,
                    category: payload.category,
                    unit_of_measure: payload.uom,
                    selling_price: payload.base_price,
                    standard_cost: payload.standard_cost,
                    image_url: payload.image_url,
                    barcode: payload.barcode,
                    notes: payload.notes
                })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: "Product Updated", description: "Product details saved successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteProduct = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: "Product Deleted", description: "Product has been removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useCreateVariant = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId } = useApp();

    return useMutation({
        mutationFn: async (payload: any) => {
            const { error } = await supabase
                .from('product_variants')
                .insert({
                    company_id: companyId,
                    product_id: payload.product_id,
                    size_id: payload.size_id,
                    color_id: payload.color_id,
                    unit_price: payload.price,
                    unit_cost: payload.cost,
                    sku: payload.sku, // database trigger will handle if empty, but we might pass it
                    status: 'active'
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: "Variant Added", description: "New SKU created." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useUpdateVariant = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const { error } = await supabase
                .from('product_variants')
                .update({
                    unit_price: payload.price,
                    unit_cost: payload.cost,
                    status: payload.status,
                    sku: payload.sku
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: "Variant Updated", description: "SKU details saved." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteVariant = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('product_variants').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast({ title: "Variant Deleted", description: "SKU removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useProduct = (id: string | undefined) => {
    return useQuery({
        queryKey: ['product', id],
        queryFn: async () => {
            if (!id) return null;
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    variants:product_variants(*)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as Product;
        },
        enabled: !!id,
    });
};

export const useVendor = (id: string | undefined) => {
    return useQuery({
        queryKey: ['vendor', id],
        queryFn: async () => {
            if (!id) return null;
            const { data, error } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as Vendor;
        },
        enabled: !!id,
    });
};

export const useCustomer = (id: string | undefined) => {
    return useQuery({
        queryKey: ['customer', id],
        queryFn: async () => {
            if (!id) return null;
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as Customer;
        },
        enabled: !!id,
    });
};

export const useCreateVendor = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: any) => {
            const { data, error } = await supabase
                .from('vendors')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    ...payload,
                    is_active: payload.is_active ?? true
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            toast({ title: "Vendor Created", description: "Vendor has been added successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useUpdateVendor = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const { error } = await supabase
                .from('vendors')
                .update(payload)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            toast({ title: "Vendor Updated", description: "Vendor details saved successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteVendor = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('vendors').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            toast({ title: "Vendor Deleted", description: "Vendor has been removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useCreateCustomer = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: any) => {
            const { data, error } = await supabase
                .from('customers')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    ...payload,
                    is_active: payload.is_active ?? true
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast({ title: "Customer Created", description: "Customer has been added successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useUpdateCustomer = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const { error } = await supabase
                .from('customers')
                .update(payload)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast({ title: "Customer Updated", description: "Customer details saved successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteCustomer = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('customers').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast({ title: "Customer Deleted", description: "Customer has been removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export interface Warehouse {
    id: string;
    company_id: string;
    code: string;
    name: string;
    address?: string;
    description?: string;
    is_active: boolean;
    created_by: string;
    created_at: string;
}

export const useWarehouses = (companyId: string) => {
    return useQuery({
        queryKey: ['warehouses', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('warehouses')
                .select('*')
                .eq('company_id', companyId)
                .order('name');
            if (error) throw error;
            return data as Warehouse[];
        },
        enabled: !!companyId
    });
};

export const useCreateWarehouse = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: any) => {
            const { data, error } = await supabase
                .from('warehouses')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    ...payload,
                    is_active: payload.is_active ?? true
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            toast({ title: "Warehouse Created", description: "Warehouse has been added successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useUpdateWarehouse = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const { error } = await supabase
                .from('warehouses')
                .update(payload)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            toast({ title: "Warehouse Updated", description: "Warehouse details saved successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteWarehouse = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('warehouses').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            toast({ title: "Warehouse Deleted", description: "Warehouse has been removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};


