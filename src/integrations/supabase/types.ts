export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          end_date: string
          fiscal_year: number
          id: string
          name: string
          period_code: string
          reopened_at: string | null
          reopened_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["period_status"] | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          end_date: string
          fiscal_year: number
          id?: string
          name: string
          period_code: string
          reopened_at?: string | null
          reopened_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["period_status"] | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          fiscal_year?: number
          id?: string
          name?: string
          period_code?: string
          reopened_at?: string | null
          reopened_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["period_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_payment_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          created_by: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_id: string
        }
        Insert: {
          amount_allocated: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_id: string
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ar_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_vw"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "overdue_invoices_vw"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payment_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "unallocated_payments_vw"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_payments: {
        Row: {
          amount_allocated: number | null
          amount_received: number
          amount_unallocated: number | null
          bank_account: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          discount_taken: number | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          period_id: string
          reference_number: string | null
        }
        Insert: {
          amount_allocated?: number | null
          amount_received: number
          amount_unallocated?: number | null
          bank_account?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          discount_taken?: number | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          period_id: string
          reference_number?: string | null
        }
        Update: {
          amount_allocated?: number | null
          amount_received?: number
          amount_unallocated?: number | null
          bank_account?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          discount_taken?: number | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_number?: string
          period_id?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ar_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changed_fields: string[] | null
          company_id: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          operation: Database["public"]["Enums"]["audit_operation"]
          record_id: string
          session_id: string | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          changed_fields?: string[] | null
          company_id?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation: Database["public"]["Enums"]["audit_operation"]
          record_id: string
          session_id?: string | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          changed_fields?: string[] | null
          company_id?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation?: Database["public"]["Enums"]["audit_operation"]
          record_id?: string
          session_id?: string | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bins: {
        Row: {
          aisle: string | null
          code: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          level: string | null
          name: string
          rack: string | null
          warehouse_id: string
        }
        Insert: {
          aisle?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          level?: string | null
          name: string
          rack?: string | null
          warehouse_id: string
        }
        Update: {
          aisle?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          level?: string | null
          name?: string
          rack?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bins_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_headers: {
        Row: {
          base_qty: number | null
          company_id: string
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          product_id: string
          updated_at: string | null
          version: string
          yield_percentage: number | null
        }
        Insert: {
          base_qty?: number | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          product_id: string
          updated_at?: string | null
          version: string
          yield_percentage?: number | null
        }
        Update: {
          base_qty?: number | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          product_id?: string
          updated_at?: string | null
          version?: string
          yield_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_lines: {
        Row: {
          bom_id: string
          component_product_id: string | null
          id: string
          line_number: number
          material_id: string | null
          notes: string | null
          qty_per: number
          scrap_percentage: number | null
          stage: Database["public"]["Enums"]["wip_stage"] | null
          uom: Database["public"]["Enums"]["uom"] | null
        }
        Insert: {
          bom_id: string
          component_product_id?: string | null
          id?: string
          line_number: number
          material_id?: string | null
          notes?: string | null
          qty_per: number
          scrap_percentage?: number | null
          stage?: Database["public"]["Enums"]["wip_stage"] | null
          uom?: Database["public"]["Enums"]["uom"] | null
        }
        Update: {
          bom_id?: string
          component_product_id?: string | null
          id?: string
          line_number?: number
          material_id?: string | null
          notes?: string | null
          qty_per?: number
          scrap_percentage?: number | null
          stage?: Database["public"]["Enums"]["wip_stage"] | null
          uom?: Database["public"]["Enums"]["uom"] | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_category: Database["public"]["Enums"]["account_category"]
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_header: boolean | null
          is_system: boolean | null
          level: number
          normal_balance: string
          parent_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_category: Database["public"]["Enums"]["account_category"]
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_header?: boolean | null
          is_system?: boolean | null
          level?: number
          normal_balance: string
          parent_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_category?: Database["public"]["Enums"]["account_category"]
          account_code?: string
          account_name?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_header?: boolean | null
          is_system?: boolean | null
          level?: number
          normal_balance?: string
          parent_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      colors: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          hex_code: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          hex_code?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          hex_code?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          base_currency: string | null
          code: string
          created_at: string | null
          created_by: string | null
          email: string | null
          fiscal_year_start_month: number | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          base_currency?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          fiscal_year_start_month?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          base_currency?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          fiscal_year_start_month?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_credit_hold_history: {
        Row: {
          action: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          new_credit_hold: boolean
          previous_credit_hold: boolean
          reason: string
        }
        Insert: {
          action: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          new_credit_hold: boolean
          previous_credit_hold: boolean
          reason: string
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          new_credit_hold?: boolean
          previous_credit_hold?: boolean
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_hold_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_credit_hold_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_credit_hold_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_limit_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          new_limit: number
          previous_limit: number
          reason: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          new_limit: number
          previous_limit: number
          reason: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          new_limit?: number
          previous_limit?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_limit_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_credit_limit_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_credit_limit_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_price_lists: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          product_variant_id: string
          unit_price: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          product_variant_id: string
          unit_price: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          product_variant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_price_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_price_lists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_price_lists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_price_lists_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_price_lists_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          credit_hold: boolean | null
          credit_limit: number | null
          custom_payment_days: number | null
          customer_type: string | null
          discount_percentage: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: Database["public"]["Enums"]["payment_terms"] | null
          phone: string | null
          status: Database["public"]["Enums"]["partner_status"] | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          company_id: string
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_hold?: boolean | null
          credit_limit?: number | null
          custom_payment_days?: number | null
          customer_type?: string | null
          discount_percentage?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          phone?: string | null
          status?: Database["public"]["Enums"]["partner_status"] | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          company_id?: string
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_hold?: boolean | null
          credit_limit?: number | null
          custom_payment_days?: number | null
          customer_type?: string | null
          discount_percentage?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          phone?: string | null
          status?: Database["public"]["Enums"]["partner_status"] | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_lines: {
        Row: {
          do_id: string
          id: string
          line_number: number
          notes: string | null
          product_variant_id: string
          qty_delivered: number
          so_line_id: string | null
        }
        Insert: {
          do_id: string
          id?: string
          line_number: number
          notes?: string | null
          product_variant_id: string
          qty_delivered: number
          so_line_id?: string | null
        }
        Update: {
          do_id?: string
          id?: string
          line_number?: number
          notes?: string | null
          product_variant_id?: string
          qty_delivered?: number
          so_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_lines_do_id_fkey"
            columns: ["do_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_lines_do_id_fkey"
            columns: ["do_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_lines_so_line_id_fkey"
            columns: ["so_line_id"]
            isOneToOne: false
            referencedRelation: "pending_deliveries_vw"
            referencedColumns: ["so_line_id"]
          },
          {
            foreignKeyName: "delivery_note_lines_so_line_id_fkey"
            columns: ["so_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          company_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          delivered_by: string | null
          delivery_address: string | null
          do_date: string
          do_number: string
          id: string
          notes: string | null
          period_id: string
          received_at: string | null
          received_by: string | null
          so_id: string | null
          status: string | null
          vehicle_number: string | null
          warehouse_id: string
        }
        Insert: {
          company_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          delivered_by?: string | null
          delivery_address?: string | null
          do_date: string
          do_number: string
          id?: string
          notes?: string | null
          period_id: string
          received_at?: string | null
          received_by?: string | null
          so_id?: string | null
          status?: string | null
          vehicle_number?: string | null
          warehouse_id: string
        }
        Update: {
          company_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          delivered_by?: string | null
          delivery_address?: string | null
          do_date?: string
          do_number?: string
          id?: string
          notes?: string | null
          period_id?: string
          received_at?: string | null
          received_by?: string | null
          so_id?: string | null
          status?: string | null
          vehicle_number?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "outstanding_sales_orders_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "pending_deliveries_vw"
            referencedColumns: ["so_id"]
          },
          {
            foreignKeyName: "delivery_notes_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_report_structure: {
        Row: {
          account_category_filter: string | null
          account_type_filter: string | null
          company_id: string
          created_at: string | null
          display_order: number
          id: string
          parent_section_id: string | null
          report_type: string
          section_code: string
          section_name: string
        }
        Insert: {
          account_category_filter?: string | null
          account_type_filter?: string | null
          company_id: string
          created_at?: string | null
          display_order: number
          id?: string
          parent_section_id?: string | null
          report_type: string
          section_code: string
          section_name: string
        }
        Update: {
          account_category_filter?: string | null
          account_type_filter?: string | null
          company_id?: string
          created_at?: string | null
          display_order?: number
          id?: string
          parent_section_id?: string | null
          report_type?: string
          section_code?: string
          section_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_report_structure_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_report_structure_parent_section_id_fkey"
            columns: ["parent_section_id"]
            isOneToOne: false
            referencedRelation: "financial_report_structure"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_ledger: {
        Row: {
          bin_id: string
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_posted: boolean | null
          notes: string | null
          period_id: string
          product_variant_id: string
          qty_in: number | null
          qty_out: number | null
          reference_id: string | null
          reference_number: string
          reference_type: Database["public"]["Enums"]["reference_type"]
          total_cost: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          bin_id: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_posted?: boolean | null
          notes?: string | null
          period_id: string
          product_variant_id: string
          qty_in?: number | null
          qty_out?: number | null
          reference_id?: string | null
          reference_number: string
          reference_type: Database["public"]["Enums"]["reference_type"]
          total_cost?: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_cost: number
          warehouse_id: string
        }
        Update: {
          bin_id?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_posted?: boolean | null
          notes?: string | null
          period_id?: string
          product_variant_id?: string
          qty_in?: number | null
          qty_out?: number | null
          reference_id?: string | null
          reference_number?: string
          reference_type?: Database["public"]["Enums"]["reference_type"]
          total_cost?: number | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_ledger_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_ledger_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_ledger_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_notes: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          delivery_note_number: string | null
          grn_date: string
          grn_number: string
          id: string
          notes: string | null
          period_id: string
          po_id: string | null
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["grn_status"] | null
          vehicle_number: string | null
          vendor_id: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          delivery_note_number?: string | null
          grn_date: string
          grn_number: string
          id?: string
          notes?: string | null
          period_id: string
          po_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["grn_status"] | null
          vehicle_number?: string | null
          vendor_id: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          delivery_note_number?: string | null
          grn_date?: string
          grn_number?: string
          id?: string
          notes?: string | null
          period_id?: string
          po_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["grn_status"] | null
          vehicle_number?: string | null
          vendor_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "outstanding_po_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_lines: {
        Row: {
          bin_id: string
          grn_id: string
          id: string
          line_total: number | null
          material_id: string
          notes: string | null
          po_line_id: string | null
          qty_accepted: number | null
          qty_received: number
          qty_rejected: number | null
          unit_cost: number
        }
        Insert: {
          bin_id: string
          grn_id: string
          id?: string
          line_total?: number | null
          material_id: string
          notes?: string | null
          po_line_id?: string | null
          qty_accepted?: number | null
          qty_received: number
          qty_rejected?: number | null
          unit_cost: number
        }
        Update: {
          bin_id?: string
          grn_id?: string
          id?: string
          line_total?: number | null
          material_id?: string
          notes?: string | null
          po_line_id?: string | null
          qty_accepted?: number | null
          qty_received?: number
          qty_rejected?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "grn_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "goods_receipt_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_transfer_lines: {
        Row: {
          id: string
          material_id: string | null
          notes: string | null
          product_variant_id: string | null
          qty: number
          transfer_id: string
          unit_cost: number
        }
        Insert: {
          id?: string
          material_id?: string | null
          notes?: string | null
          product_variant_id?: string | null
          qty: number
          transfer_id: string
          unit_cost: number
        }
        Update: {
          id?: string
          material_id?: string | null
          notes?: string | null
          product_variant_id?: string | null
          qty?: number
          transfer_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "internal_transfer_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfer_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfer_lines_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "internal_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_transfers: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          from_bin_id: string
          from_warehouse_id: string
          id: string
          notes: string | null
          period_id: string
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["transfer_status"] | null
          to_bin_id: string
          to_warehouse_id: string
          transfer_date: string
          transfer_number: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          from_bin_id: string
          from_warehouse_id: string
          id?: string
          notes?: string | null
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"] | null
          to_bin_id: string
          to_warehouse_id: string
          transfer_date: string
          transfer_number: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          from_bin_id?: string
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"] | null
          to_bin_id?: string
          to_warehouse_id?: string
          transfer_date?: string
          transfer_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfers_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfers_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfers_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustment_lines: {
        Row: {
          adjustment_id: string
          bin_id: string
          id: string
          material_id: string | null
          notes: string | null
          product_variant_id: string | null
          qty: number
          reason_code: Database["public"]["Enums"]["adjustment_reason"] | null
          total_value: number | null
          unit_cost: number
        }
        Insert: {
          adjustment_id: string
          bin_id: string
          id?: string
          material_id?: string | null
          notes?: string | null
          product_variant_id?: string | null
          qty: number
          reason_code?: Database["public"]["Enums"]["adjustment_reason"] | null
          total_value?: number | null
          unit_cost: number
        }
        Update: {
          adjustment_id?: string
          bin_id?: string
          id?: string
          material_id?: string | null
          notes?: string | null
          product_variant_id?: string | null
          qty?: number
          reason_code?: Database["public"]["Enums"]["adjustment_reason"] | null
          total_value?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_lines_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_number: string
          adjustment_type: string
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          period_id: string
          posted_at: string | null
          posted_by: string | null
          reason: Database["public"]["Enums"]["adjustment_reason"]
          reference_id: string | null
          reference_type: string | null
          requires_approval: boolean | null
          status: Database["public"]["Enums"]["adjustment_status"] | null
          warehouse_id: string
        }
        Insert: {
          adjustment_date: string
          adjustment_number: string
          adjustment_type: string
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          reason: Database["public"]["Enums"]["adjustment_reason"]
          reference_id?: string | null
          reference_type?: string | null
          requires_approval?: boolean | null
          status?: Database["public"]["Enums"]["adjustment_status"] | null
          warehouse_id: string
        }
        Update: {
          adjustment_date?: string
          adjustment_number?: string
          adjustment_type?: string
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          reason?: Database["public"]["Enums"]["adjustment_reason"]
          reference_id?: string | null
          reference_type?: string | null
          requires_approval?: boolean | null
          status?: Database["public"]["Enums"]["adjustment_status"] | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string | null
          credit: number | null
          debit: number | null
          department_id: string | null
          description: string | null
          id: string
          journal_id: string
          project_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          department_id?: string | null
          description?: string | null
          id?: string
          journal_id: string
          project_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          credit?: number | null
          debit?: number | null
          department_id?: string | null
          description?: string | null
          id?: string
          journal_id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          journal_date: string
          journal_number: string
          period_id: string | null
          posted_at: string | null
          posted_by: string | null
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          journal_date: string
          journal_number: string
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          journal_date?: string
          journal_number?: string
          period_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journals_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_accounts: {
        Row: {
          access_token: string | null
          account_name: string
          api_key: string | null
          api_secret: string | null
          auto_sync_inventory: boolean | null
          auto_sync_orders: boolean | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          platform: Database["public"]["Enums"]["marketplace_platform"]
          refresh_token: string | null
          shop_id: string
          token_expiry: string | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          access_token?: string | null
          account_name: string
          api_key?: string | null
          api_secret?: string | null
          auto_sync_inventory?: boolean | null
          auto_sync_orders?: boolean | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          platform: Database["public"]["Enums"]["marketplace_platform"]
          refresh_token?: string | null
          shop_id: string
          token_expiry?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          access_token?: string | null
          account_name?: string
          api_key?: string | null
          api_secret?: string | null
          auto_sync_inventory?: boolean | null
          auto_sync_orders?: boolean | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          platform?: Database["public"]["Enums"]["marketplace_platform"]
          refresh_token?: string | null
          shop_id?: string
          token_expiry?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_accounts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_items: {
        Row: {
          created_at: string | null
          deal_price: number
          external_item_id: string | null
          id: string
          order_id: string
          original_price: number
          product_name: string
          product_variant_id: string | null
          quantity: number
          sku: string
        }
        Insert: {
          created_at?: string | null
          deal_price: number
          external_item_id?: string | null
          id?: string
          order_id: string
          original_price: number
          product_name: string
          product_variant_id?: string | null
          quantity: number
          sku: string
        }
        Update: {
          created_at?: string | null
          deal_price?: number
          external_item_id?: string | null
          id?: string
          order_id?: string
          original_price?: number
          product_name?: string
          product_variant_id?: string | null
          quantity?: number
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          account_id: string
          commission_fee: number | null
          company_id: string
          created_at: string | null
          currency: string | null
          customer_name: string | null
          external_order_id: string
          external_status: string
          id: string
          mapped_status: Database["public"]["Enums"]["marketplace_order_status"]
          order_date: string
          platform_fee: number | null
          seller_rebate: number | null
          shipping_fee: number | null
          so_id: string | null
          sync_error: string | null
          sync_status:
            | Database["public"]["Enums"]["marketplace_sync_status"]
            | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          commission_fee?: number | null
          company_id: string
          created_at?: string | null
          currency?: string | null
          customer_name?: string | null
          external_order_id: string
          external_status: string
          id?: string
          mapped_status: Database["public"]["Enums"]["marketplace_order_status"]
          order_date: string
          platform_fee?: number | null
          seller_rebate?: number | null
          shipping_fee?: number | null
          so_id?: string | null
          sync_error?: string | null
          sync_status?:
            | Database["public"]["Enums"]["marketplace_sync_status"]
            | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          commission_fee?: number | null
          company_id?: string
          created_at?: string | null
          currency?: string | null
          customer_name?: string | null
          external_order_id?: string
          external_status?: string
          id?: string
          mapped_status?: Database["public"]["Enums"]["marketplace_order_status"]
          order_date?: string
          platform_fee?: number | null
          seller_rebate?: number | null
          shipping_fee?: number | null
          so_id?: string | null
          sync_error?: string | null
          sync_status?:
            | Database["public"]["Enums"]["marketplace_sync_status"]
            | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "outstanding_sales_orders_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "pending_deliveries_vw"
            referencedColumns: ["so_id"]
          },
          {
            foreignKeyName: "marketplace_orders_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_settlements: {
        Row: {
          account_id: string
          amount_fees: number
          amount_gross: number
          amount_net: number
          company_id: string
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: string
          notes: string | null
          payout_date: string
          settlement_ref: string
          start_date: string | null
          status: string | null
        }
        Insert: {
          account_id: string
          amount_fees: number
          amount_gross: number
          amount_net: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          payout_date: string
          settlement_ref: string
          start_date?: string | null
          status?: string | null
        }
        Update: {
          account_id?: string
          amount_fees?: number
          amount_gross?: number
          amount_net?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          payout_date?: string
          settlement_ref?: string
          start_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_settlements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "marketplace_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_settlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      material_categories: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          category_id: string | null
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          lead_time_days: number | null
          name: string
          notes: string | null
          reorder_level: number | null
          standard_cost: number | null
          status: Database["public"]["Enums"]["product_status"] | null
          supplier_code: string | null
          unit_of_measure: Database["public"]["Enums"]["uom"] | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          lead_time_days?: number | null
          name: string
          notes?: string | null
          reorder_level?: number | null
          standard_cost?: number | null
          status?: Database["public"]["Enums"]["product_status"] | null
          supplier_code?: string | null
          unit_of_measure?: Database["public"]["Enums"]["uom"] | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          lead_time_days?: number | null
          name?: string
          notes?: string | null
          reorder_level?: number | null
          standard_cost?: number | null
          status?: Database["public"]["Enums"]["product_status"] | null
          supplier_code?: string | null
          unit_of_measure?: Database["public"]["Enums"]["uom"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_id: string
        }
        Insert: {
          amount_allocated: number
          created_at?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_id: string
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_aging_vw"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "vendor_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      period_closing_logs: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          message: string | null
          period_id: string
          status: string
          step_name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          message?: string | null
          period_id: string
          status: string
          step_name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          message?: string | null
          period_id?: string
          status?: string
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_closing_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closing_logs_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          color_id: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          image_url: string | null
          product_id: string
          size_id: string | null
          sku: string
          status: Database["public"]["Enums"]["product_status"] | null
          unit_cost: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          color_id?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_url?: string | null
          product_id: string
          size_id?: string | null
          sku: string
          status?: Database["public"]["Enums"]["product_status"] | null
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          color_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          image_url?: string | null
          product_id?: string
          size_id?: string | null
          sku?: string
          status?: Database["public"]["Enums"]["product_status"] | null
          unit_cost?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          actual_cost: number | null
          bom_id: string
          company_id: string
          completion_date: string | null
          cost_variance: number | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          period_id: string
          po_date: string
          po_number: string
          priority: number | null
          product_id: string
          qty_completed: number | null
          qty_outstanding: number | null
          qty_planned: number
          qty_rejected: number | null
          released_at: string | null
          released_by: string | null
          standard_cost: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["production_status"] | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          actual_cost?: number | null
          bom_id: string
          company_id: string
          completion_date?: string | null
          cost_variance?: number | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          period_id: string
          po_date: string
          po_number: string
          priority?: number | null
          product_id: string
          qty_completed?: number | null
          qty_outstanding?: number | null
          qty_planned: number
          qty_rejected?: number | null
          released_at?: string | null
          released_by?: string | null
          standard_cost?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["production_status"] | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          actual_cost?: number | null
          bom_id?: string
          company_id?: string
          completion_date?: string | null
          cost_variance?: number | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          period_id?: string
          po_date?: string
          po_number?: string
          priority?: number | null
          product_id?: string
          qty_completed?: number | null
          qty_outstanding?: number | null
          qty_planned?: number
          qty_rejected?: number | null
          released_at?: string | null
          released_by?: string | null
          standard_cost?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["production_status"] | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bom_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      production_reservations: {
        Row: {
          created_at: string | null
          id: string
          material_id: string
          production_order_id: string
          qty_issued: number | null
          qty_outstanding: number | null
          qty_required: number
          stage: Database["public"]["Enums"]["wip_stage"] | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id: string
          production_order_id: string
          qty_issued?: number | null
          qty_outstanding?: number | null
          qty_required: number
          stage?: Database["public"]["Enums"]["wip_stage"] | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string
          production_order_id?: string
          qty_issued?: number | null
          qty_outstanding?: number | null
          qty_required?: number
          stage?: Database["public"]["Enums"]["wip_stage"] | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_reservations_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_reservations_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_cost_detail_vw"
            referencedColumns: ["production_order_id"]
          },
          {
            foreignKeyName: "production_reservations_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_reservations_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          notes: string | null
          selling_price: number | null
          standard_cost: number | null
          status: Database["public"]["Enums"]["product_status"] | null
          unit_of_measure: Database["public"]["Enums"]["uom"] | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          selling_price?: number | null
          standard_cost?: number | null
          status?: Database["public"]["Enums"]["product_status"] | null
          unit_of_measure?: Database["public"]["Enums"]["uom"] | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category?: string | null
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          selling_price?: number | null
          standard_cost?: number | null
          status?: Database["public"]["Enums"]["product_status"] | null
          unit_of_measure?: Database["public"]["Enums"]["uom"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          description: string | null
          id: string
          line_number: number
          line_total: number | null
          material_id: string
          notes: string | null
          po_id: string
          qty_invoiced: number | null
          qty_ordered: number
          qty_outstanding: number | null
          qty_received: number | null
          unit_price: number
        }
        Insert: {
          description?: string | null
          id?: string
          line_number: number
          line_total?: number | null
          material_id: string
          notes?: string | null
          po_id: string
          qty_invoiced?: number | null
          qty_ordered: number
          qty_outstanding?: number | null
          qty_received?: number | null
          unit_price: number
        }
        Update: {
          description?: string | null
          id?: string
          line_number?: number
          line_total?: number | null
          material_id?: string
          notes?: string | null
          po_id?: string
          qty_invoiced?: number | null
          qty_ordered?: number
          qty_outstanding?: number | null
          qty_received?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "outstanding_po_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          custom_payment_days: number | null
          delivery_address: string | null
          delivery_date: string | null
          exchange_rate: number | null
          id: string
          notes: string | null
          payment_terms: Database["public"]["Enums"]["payment_terms"] | null
          period_id: string
          po_date: string
          po_number: string
          status: Database["public"]["Enums"]["po_status"] | null
          submitted_at: string | null
          submitted_by: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          vendor_id: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          custom_payment_days?: number | null
          delivery_address?: string | null
          delivery_date?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          period_id: string
          po_date: string
          po_number: string
          status?: Database["public"]["Enums"]["po_status"] | null
          submitted_at?: string | null
          submitted_by?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          vendor_id: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          custom_payment_days?: number | null
          delivery_address?: string | null
          delivery_date?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          period_id?: string
          po_date?: string
          po_number?: string
          status?: Database["public"]["Enums"]["po_status"] | null
          submitted_at?: string | null
          submitted_by?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          vendor_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_ledger: {
        Row: {
          bin_id: string
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_posted: boolean | null
          material_id: string
          notes: string | null
          period_id: string
          qty_in: number | null
          qty_out: number | null
          reference_id: string | null
          reference_number: string | null
          reference_type: Database["public"]["Enums"]["reference_type"]
          total_cost: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          bin_id: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_posted?: boolean | null
          material_id: string
          notes?: string | null
          period_id: string
          qty_in?: number | null
          qty_out?: number | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type: Database["public"]["Enums"]["reference_type"]
          total_cost?: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_cost: number
          warehouse_id: string
        }
        Update: {
          bin_id?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_posted?: boolean | null
          material_id?: string
          notes?: string | null
          period_id?: string
          qty_in?: number | null
          qty_out?: number | null
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: Database["public"]["Enums"]["reference_type"]
          total_cost?: number | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_ledger_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_ledger_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_ledger_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_lines: {
        Row: {
          discount_percentage: number | null
          do_line_id: string | null
          id: string
          invoice_id: string
          line_number: number
          line_total: number | null
          notes: string | null
          product_variant_id: string
          qty_invoiced: number
          so_line_id: string | null
          unit_price: number
        }
        Insert: {
          discount_percentage?: number | null
          do_line_id?: string | null
          id?: string
          invoice_id: string
          line_number: number
          line_total?: number | null
          notes?: string | null
          product_variant_id: string
          qty_invoiced: number
          so_line_id?: string | null
          unit_price: number
        }
        Update: {
          discount_percentage?: number | null
          do_line_id?: string | null
          id?: string
          invoice_id?: string
          line_number?: number
          line_total?: number | null
          notes?: string | null
          product_variant_id?: string
          qty_invoiced?: number
          so_line_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_lines_do_line_id_fkey"
            columns: ["do_line_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_vw"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "overdue_invoices_vw"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_so_line_id_fkey"
            columns: ["so_line_id"]
            isOneToOne: false
            referencedRelation: "pending_deliveries_vw"
            referencedColumns: ["so_line_id"]
          },
          {
            foreignKeyName: "sales_invoice_lines_so_line_id_fkey"
            columns: ["so_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          discount_amount: number | null
          do_id: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          payment_status: string | null
          payment_terms: string | null
          period_id: string
          posted_at: string | null
          posted_by: string | null
          so_id: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          discount_amount?: number | null
          do_id?: string | null
          due_date: string
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          so_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          discount_amount?: number | null
          do_id?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          so_id?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_do_id_fkey"
            columns: ["do_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_do_id_fkey"
            columns: ["do_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "outstanding_sales_orders_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "pending_deliveries_vw"
            referencedColumns: ["so_id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_lines: {
        Row: {
          discount_percentage: number | null
          id: string
          line_number: number
          line_total: number | null
          notes: string | null
          product_variant_id: string
          qty_delivered: number | null
          qty_invoiced: number | null
          qty_ordered: number
          so_id: string
          unit_price: number
        }
        Insert: {
          discount_percentage?: number | null
          id?: string
          line_number: number
          line_total?: number | null
          notes?: string | null
          product_variant_id: string
          qty_delivered?: number | null
          qty_invoiced?: number | null
          qty_ordered: number
          so_id: string
          unit_price: number
        }
        Update: {
          discount_percentage?: number | null
          id?: string
          line_number?: number
          line_total?: number | null
          notes?: string | null
          product_variant_id?: string
          qty_delivered?: number | null
          qty_invoiced?: number | null
          qty_ordered?: number
          so_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "outstanding_sales_orders_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "pending_deliveries_vw"
            referencedColumns: ["so_id"]
          },
          {
            foreignKeyName: "sales_order_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string
          delivery_address: string | null
          delivery_date: string | null
          discount_amount: number | null
          due_date: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          period_id: string
          so_date: string
          so_number: string
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          delivery_address?: string | null
          delivery_date?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          period_id: string
          so_date: string
          so_number: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          delivery_address?: string | null
          delivery_date?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          period_id?: string
          so_date?: string
          so_number?: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_pos: {
        Row: {
          amount_tendered: number | null
          change_amount: number | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference: string | null
          period_id: string
          pos_number: string
          posted_at: string | null
          posted_by: string | null
          sale_date: string
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          warehouse_id: string
        }
        Insert: {
          amount_tendered?: number | null
          change_amount?: number | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          period_id: string
          pos_number: string
          posted_at?: string | null
          posted_by?: string | null
          sale_date: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          warehouse_id: string
        }
        Update: {
          amount_tendered?: number | null
          change_amount?: number | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_reference?: string | null
          period_id?: string
          pos_number?: string
          posted_at?: string | null
          posted_by?: string | null
          sale_date?: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_pos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_pos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_pos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_pos_lines: {
        Row: {
          discount_percentage: number | null
          id: string
          line_number: number
          line_total: number | null
          notes: string | null
          pos_id: string
          product_variant_id: string
          qty: number
          unit_price: number
        }
        Insert: {
          discount_percentage?: number | null
          id?: string
          line_number: number
          line_total?: number | null
          notes?: string | null
          pos_id: string
          product_variant_id: string
          qty: number
          unit_price: number
        }
        Update: {
          discount_percentage?: number | null
          id?: string
          line_number?: number
          line_total?: number | null
          notes?: string | null
          pos_id?: string
          product_variant_id?: string
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_pos_lines_pos_id_fkey"
            columns: ["pos_id"]
            isOneToOne: false
            referencedRelation: "sales_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_pos_return_lines: {
        Row: {
          condition: string | null
          id: string
          line_number: number
          line_total: number | null
          notes: string | null
          original_line_id: string | null
          product_variant_id: string
          qty_returned: number
          return_id: string
          return_reason: string | null
          unit_price: number
        }
        Insert: {
          condition?: string | null
          id?: string
          line_number: number
          line_total?: number | null
          notes?: string | null
          original_line_id?: string | null
          product_variant_id: string
          qty_returned: number
          return_id: string
          return_reason?: string | null
          unit_price: number
        }
        Update: {
          condition?: string | null
          id?: string
          line_number?: number
          line_total?: number | null
          notes?: string | null
          original_line_id?: string | null
          product_variant_id?: string
          qty_returned?: number
          return_id?: string
          return_reason?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_pos_return_lines_original_line_id_fkey"
            columns: ["original_line_id"]
            isOneToOne: false
            referencedRelation: "sales_pos_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_return_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_return_lines_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sales_pos_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_pos_returns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          original_pos_id: string
          period_id: string
          posted_at: string | null
          posted_by: string | null
          refund_amount: number | null
          refund_method: Database["public"]["Enums"]["payment_method"]
          refund_reference: string | null
          return_date: string
          return_number: string
          return_reason: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          original_pos_id: string
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          refund_amount?: number | null
          refund_method: Database["public"]["Enums"]["payment_method"]
          refund_reference?: string | null
          return_date: string
          return_number: string
          return_reason?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          original_pos_id?: string
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          refund_amount?: number | null
          refund_method?: Database["public"]["Enums"]["payment_method"]
          refund_reference?: string | null
          return_date?: string
          return_number?: string
          return_reason?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_pos_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_pos_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_pos_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_returns_original_pos_id_fkey"
            columns: ["original_pos_id"]
            isOneToOne: false
            referencedRelation: "sales_pos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_returns_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sizes: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sizes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname: {
        Row: {
          company_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          opname_date: string
          opname_number: string
          period_id: string
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["opname_status"] | null
          warehouse_id: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          opname_date: string
          opname_number: string
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["opname_status"] | null
          warehouse_id: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          opname_date?: string
          opname_number?: string
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["opname_status"] | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_lines: {
        Row: {
          bin_id: string
          counted_at: string | null
          counted_by: string | null
          id: string
          material_id: string | null
          notes: string | null
          opname_id: string
          physical_qty: number | null
          physical_value: number | null
          product_variant_id: string | null
          reason_code: Database["public"]["Enums"]["adjustment_reason"] | null
          system_qty: number
          system_unit_cost: number
          system_value: number | null
          variance_qty: number | null
          variance_value: number | null
        }
        Insert: {
          bin_id: string
          counted_at?: string | null
          counted_by?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          opname_id: string
          physical_qty?: number | null
          physical_value?: number | null
          product_variant_id?: string | null
          reason_code?: Database["public"]["Enums"]["adjustment_reason"] | null
          system_qty?: number
          system_unit_cost?: number
          system_value?: number | null
          variance_qty?: number | null
          variance_value?: number | null
        }
        Update: {
          bin_id?: string
          counted_at?: string | null
          counted_by?: string | null
          id?: string
          material_id?: string | null
          notes?: string | null
          opname_id?: string
          physical_qty?: number | null
          physical_value?: number | null
          product_variant_id?: string | null
          reason_code?: Database["public"]["Enums"]["adjustment_reason"] | null
          system_qty?: number
          system_unit_cost?: number
          system_value?: number | null
          variance_qty?: number | null
          variance_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_lines_opname_id_fkey"
            columns: ["opname_id"]
            isOneToOne: false
            referencedRelation: "stock_opname"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_mapping: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          role: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_company_mapping_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoice_lines: {
        Row: {
          grn_line_id: string | null
          id: string
          invoice_id: string
          line_total: number | null
          material_id: string
          notes: string | null
          po_line_id: string | null
          po_unit_price: number | null
          price_variance: number | null
          qty_invoiced: number
          unit_price: number
          variance_approved: boolean | null
        }
        Insert: {
          grn_line_id?: string | null
          id?: string
          invoice_id: string
          line_total?: number | null
          material_id: string
          notes?: string | null
          po_line_id?: string | null
          po_unit_price?: number | null
          price_variance?: number | null
          qty_invoiced: number
          unit_price: number
          variance_approved?: boolean | null
        }
        Update: {
          grn_line_id?: string | null
          id?: string
          invoice_id?: string
          line_total?: number | null
          material_id?: string
          notes?: string | null
          po_line_id?: string | null
          po_unit_price?: number | null
          price_variance?: number | null
          qty_invoiced?: number
          unit_price?: number
          variance_approved?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoice_lines_grn_line_id_fkey"
            columns: ["grn_line_id"]
            isOneToOne: false
            referencedRelation: "grn_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ap_aging_vw"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "vendor_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "vendor_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoice_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invoices: {
        Row: {
          amount_outstanding: number | null
          amount_paid: number | null
          company_id: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          due_date: string
          exchange_rate: number | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          payment_terms: Database["public"]["Enums"]["payment_terms"] | null
          period_id: string
          po_id: string | null
          posted_at: string | null
          posted_by: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          vendor_id: string
        }
        Insert: {
          amount_outstanding?: number | null
          amount_paid?: number | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date: string
          exchange_rate?: number | null
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          period_id: string
          po_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          vendor_id: string
        }
        Update: {
          amount_outstanding?: number | null
          amount_paid?: number | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date?: string
          exchange_rate?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          period_id?: string
          po_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "outstanding_po_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          bank_account_id: string | null
          cleared_at: string | null
          cleared_by: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_number: string
          period_id: string
          posted_at: string | null
          posted_by: string | null
          reference_number: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          total_amount: number
          vendor_id: string
        }
        Insert: {
          bank_account_id?: string | null
          cleared_at?: string | null
          cleared_by?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_number: string
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          total_amount: number
          vendor_id: string
        }
        Update: {
          bank_account_id?: string | null
          cleared_at?: string | null
          cleared_by?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_number?: string
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          total_amount?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          credit_limit: number | null
          custom_payment_days: number | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: Database["public"]["Enums"]["payment_terms"] | null
          phone: string | null
          status: Database["public"]["Enums"]["partner_status"] | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          company_id: string
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          custom_payment_days?: number | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          phone?: string | null
          status?: Database["public"]["Enums"]["partner_status"] | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          company_id?: string
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          credit_limit?: number | null
          custom_payment_days?: number | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          phone?: string | null
          status?: Database["public"]["Enums"]["partner_status"] | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          city: string | null
          code: string
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          manager_name: string | null
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          manager_name?: string | null
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          manager_name?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      wip_ledger: {
        Row: {
          company_id: string
          cost_labor: number | null
          cost_material: number | null
          cost_overhead: number | null
          created_at: string | null
          created_by: string | null
          id: string
          is_posted: boolean | null
          notes: string | null
          period_id: string
          product_id: string
          production_order_id: string | null
          qty_in: number | null
          qty_out: number | null
          reference_id: string | null
          reference_number: string
          reference_type: Database["public"]["Enums"]["reference_type"]
          stage: Database["public"]["Enums"]["wip_stage"]
          total_cost: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          company_id: string
          cost_labor?: number | null
          cost_material?: number | null
          cost_overhead?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_posted?: boolean | null
          notes?: string | null
          period_id: string
          product_id: string
          production_order_id?: string | null
          qty_in?: number | null
          qty_out?: number | null
          reference_id?: string | null
          reference_number: string
          reference_type: Database["public"]["Enums"]["reference_type"]
          stage: Database["public"]["Enums"]["wip_stage"]
          total_cost?: number | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          unit_cost: number
          warehouse_id: string
        }
        Update: {
          company_id?: string
          cost_labor?: number | null
          cost_material?: number | null
          cost_overhead?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_posted?: boolean | null
          notes?: string | null
          period_id?: string
          product_id?: string
          production_order_id?: string | null
          qty_in?: number | null
          qty_out?: number | null
          reference_id?: string | null
          reference_number?: string
          reference_type?: Database["public"]["Enums"]["reference_type"]
          stage?: Database["public"]["Enums"]["wip_stage"]
          total_cost?: number | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wip_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wip_ledger_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wip_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wip_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_time_entries: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          labor_cost: number | null
          labor_rate: number | null
          notes: string | null
          operator_id: string
          start_time: string
          work_order_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          labor_cost?: number | null
          labor_rate?: number | null
          notes?: string | null
          operator_id: string
          start_time: string
          work_order_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          labor_cost?: number | null
          labor_rate?: number | null
          notes?: string | null
          operator_id?: string
          start_time?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_time_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_time_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          end_datetime: string | null
          id: string
          notes: string | null
          operator_id: string | null
          production_order_id: string
          qty_completed: number | null
          qty_outstanding: number | null
          qty_rejected: number | null
          qty_started: number
          stage: Database["public"]["Enums"]["wip_stage"]
          start_datetime: string | null
          status: Database["public"]["Enums"]["wo_status"] | null
          wo_number: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          end_datetime?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          production_order_id: string
          qty_completed?: number | null
          qty_outstanding?: number | null
          qty_rejected?: number | null
          qty_started: number
          stage: Database["public"]["Enums"]["wip_stage"]
          start_datetime?: string | null
          status?: Database["public"]["Enums"]["wo_status"] | null
          wo_number: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          end_datetime?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          production_order_id?: string
          qty_completed?: number | null
          qty_outstanding?: number | null
          qty_rejected?: number | null
          qty_started?: number
          stage?: Database["public"]["Enums"]["wip_stage"]
          start_datetime?: string | null
          status?: Database["public"]["Enums"]["wo_status"] | null
          wo_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_cost_detail_vw"
            referencedColumns: ["production_order_id"]
          },
          {
            foreignKeyName: "work_orders_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ap_aging_vw: {
        Row: {
          aging_bucket: string | null
          amount_outstanding: number | null
          amount_paid: number | null
          company_id: string | null
          days_overdue: number | null
          due_date: string | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          total_amount: number | null
          vendor_code: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_aging_vw: {
        Row: {
          aging_bucket: string | null
          aging_bucket_order: number | null
          amount_due: number | null
          amount_paid: number | null
          company_id: string | null
          customer_id: string | null
          customer_name: string | null
          days_overdue: number | null
          due_date: string | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      ar_payment_summary_vw: {
        Row: {
          allocation_status: string | null
          amount_allocated: number | null
          amount_received: number | null
          amount_unallocated: number | null
          company_id: string | null
          customer_id: string | null
          customer_name: string | null
          id: string | null
          invoice_count: number | null
          payment_date: string | null
          payment_method: string | null
          payment_number: string | null
          reference_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ar_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_summary_vw: {
        Row: {
          base_qty: number | null
          company_id: string | null
          component_count: number | null
          id: string | null
          is_active: boolean | null
          material_count: number | null
          product_code: string | null
          product_name: string | null
          subassembly_count: number | null
          version: string | null
          yield_percentage: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ar_balance_vw: {
        Row: {
          available_credit: number | null
          company_id: string | null
          credit_limit: number | null
          customer_id: string | null
          customer_name: string | null
          invoice_count: number | null
          overdue_amount: number | null
          total_ar_balance: number | null
          total_invoiced: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_status_vw: {
        Row: {
          available_credit: number | null
          company_id: string | null
          credit_hold: boolean | null
          credit_limit: number | null
          credit_status: string | null
          current_ar_balance: number | null
          customer_id: string | null
          customer_name: string | null
          default_payment_terms:
            | Database["public"]["Enums"]["payment_terms"]
            | null
          pending_so_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_pos_sales_vw: {
        Row: {
          cash_transactions: number | null
          company_id: string | null
          gross_sales: number | null
          non_cash_transactions: number | null
          sale_date: string | null
          total_discounts: number | null
          total_sales: number | null
          total_tax: number | null
          transaction_count: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_pos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_summary_vw: {
        Row: {
          company_id: string | null
          customer_id: string | null
          customer_name: string | null
          delivered_by: string | null
          do_date: string | null
          do_number: string | null
          id: string | null
          line_count: number | null
          received_at: string | null
          received_by: string | null
          so_id: string | null
          so_number: string | null
          status: string | null
          total_qty_delivered: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "outstanding_sales_orders_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "pending_deliveries_vw"
            referencedColumns: ["so_id"]
          },
          {
            foreignKeyName: "delivery_notes_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_balance_mv: {
        Row: {
          avg_unit_cost: number | null
          bin_id: string | null
          company_id: string | null
          current_qty: number | null
          last_movement_at: string | null
          last_transaction_date: string | null
          product_variant_id: string | null
          total_qty_in: number | null
          total_qty_out: number | null
          total_value: number | null
          transaction_count: number | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_ledger_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_ledger_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      finished_goods_summary_mv: {
        Row: {
          company_id: string | null
          last_movement_at: string | null
          overall_avg_cost: number | null
          product_variant_id: string | null
          total_current_qty: number | null
          total_value: number | null
          warehouse_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finished_goods_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finished_goods_ledger_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_financial_summary: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          company_id: string | null
          end_date: string | null
          net_credit_balance: number | null
          net_debit_balance: number | null
          period_name: string | null
          start_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_inventory_valuation: {
        Row: {
          company_id: string | null
          current_qty: number | null
          inventory_type: string | null
          item_id: string | null
          item_name: string | null
          sku: string | null
          total_value: number | null
          unit_cost: number | null
        }
        Relationships: []
      }
      mv_sales_performance: {
        Row: {
          channel: string | null
          company_id: string | null
          daily_revenue: number | null
          sale_date: string | null
          transaction_count: number | null
        }
        Relationships: []
      }
      outstanding_po_vw: {
        Row: {
          company_id: string | null
          id: string | null
          material_code: string | null
          material_id: string | null
          material_name: string | null
          po_date: string | null
          po_number: string | null
          qty_outstanding: number | null
          unit_price: number | null
          value_outstanding: number | null
          vendor_code: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      outstanding_sales_orders_vw: {
        Row: {
          company_id: string | null
          customer_id: string | null
          customer_name: string | null
          delivery_date: string | null
          id: string | null
          line_count: number | null
          so_date: string | null
          so_number: string | null
          status: string | null
          total_amount: number | null
          total_qty_delivered: number | null
          total_qty_ordered: number | null
          total_qty_pending: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      overdue_invoices_vw: {
        Row: {
          amount_due: number | null
          company_id: string | null
          customer_id: string | null
          customer_name: string | null
          days_overdue: number | null
          due_date: string | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          priority: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocation_details_vw: {
        Row: {
          amount_allocated: number | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          due_date: string | null
          id: string | null
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_remaining: number | null
          invoice_total: number | null
          payment_date: string | null
          payment_id: string | null
          payment_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ar_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "ar_aging_vw"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "overdue_invoices_vw"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoice_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payment_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "ar_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "unallocated_payments_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_summary_vw: {
        Row: {
          amount_allocated: number | null
          amount_unallocated: number | null
          company_id: string | null
          id: string | null
          invoice_count: number | null
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_number: string | null
          total_amount: number | null
          vendor_code: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_deliveries_vw: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          delivery_address: string | null
          delivery_date: string | null
          product_name: string | null
          product_variant_id: string | null
          qty_delivered: number | null
          qty_ordered: number | null
          qty_pending: number | null
          sku: string | null
          so_date: string | null
          so_id: string | null
          so_line_id: string | null
          so_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_return_rate_vw: {
        Row: {
          company_id: string | null
          return_count: number | null
          return_rate_pct: number | null
          sale_count: number | null
          total_returns: number | null
          total_sales: number | null
          txn_date: string | null
        }
        Relationships: []
      }
      pos_return_summary_vw: {
        Row: {
          company_id: string | null
          damaged_items: number | null
          resellable_items: number | null
          return_count: number | null
          return_date: string | null
          return_reason: string | null
          total_refunded: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_pos_returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pos_returns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      production_cost_detail_vw: {
        Row: {
          cost_per_unit: number | null
          cost_variance: number | null
          labor_cost_cut: number | null
          labor_cost_finish: number | null
          labor_cost_sew: number | null
          material_cost_cut: number | null
          material_cost_finish: number | null
          material_cost_sew: number | null
          po_number: string | null
          product_code: string | null
          production_order_id: string | null
          qty_completed: number | null
          qty_planned: number | null
          standard_cost: number | null
          total_actual_cost: number | null
          total_labor_cost: number | null
          total_material_cost: number | null
          total_overhead_cost: number | null
        }
        Relationships: []
      }
      production_order_summary_vw: {
        Row: {
          actual_cost: number | null
          company_id: string | null
          cost_variance: number | null
          due_date: string | null
          id: string | null
          material_count: number | null
          materials_pending: number | null
          po_date: string | null
          po_number: string | null
          priority: number | null
          product_code: string | null
          product_name: string | null
          qty_completed: number | null
          qty_outstanding: number | null
          qty_planned: number | null
          qty_rejected: number | null
          standard_cost: number | null
          status: Database["public"]["Enums"]["production_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_material_balance_mv: {
        Row: {
          avg_unit_cost: number | null
          bin_id: string | null
          company_id: string | null
          current_qty: number | null
          last_movement_at: string | null
          last_transaction_date: string | null
          material_id: string | null
          total_qty_in: number | null
          total_qty_out: number | null
          total_value: number | null
          transaction_count: number | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_ledger_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_ledger_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoice_summary_vw: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          company_id: string | null
          customer_id: string | null
          customer_name: string | null
          do_id: string | null
          do_number: string | null
          due_date: string | null
          id: string | null
          invoice_date: string | null
          invoice_number: string | null
          line_count: number | null
          payment_status: string | null
          payment_terms: string | null
          so_id: string | null
          so_number: string | null
          status: string | null
          total_amount: number | null
          total_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_do_id_fkey"
            columns: ["do_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_do_id_fkey"
            columns: ["do_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "outstanding_sales_orders_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "pending_deliveries_vw"
            referencedColumns: ["so_id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_order_summary_vw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_summary_vw: {
        Row: {
          approved_at: string | null
          company_id: string | null
          created_at: string | null
          credit_limit: number | null
          customer_id: string | null
          customer_name: string | null
          delivery_status: string | null
          due_date: string | null
          id: string | null
          line_count: number | null
          payment_terms: string | null
          so_date: string | null
          so_number: string | null
          status: string | null
          total_amount: number | null
          total_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      unallocated_payments_vw: {
        Row: {
          amount_allocated: number | null
          amount_received: number | null
          amount_unallocated: number | null
          company_id: string | null
          customer_id: string | null
          customer_name: string | null
          days_unallocated: number | null
          id: string | null
          payment_date: string | null
          payment_method: string | null
          payment_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ar_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_ar_balance_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_credit_status_vw"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ar_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      wip_balance_mv: {
        Row: {
          avg_unit_cost: number | null
          company_id: string | null
          current_qty: number | null
          last_movement_at: string | null
          last_transaction_date: string | null
          product_id: string | null
          production_order_id: string | null
          stage: Database["public"]["Enums"]["wip_stage"] | null
          total_cost_labor: number | null
          total_cost_material: number | null
          total_cost_overhead: number | null
          total_qty_in: number | null
          total_qty_out: number | null
          total_value: number | null
          transaction_count: number | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wip_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wip_ledger_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wip_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_summary_vw: {
        Row: {
          company_id: string | null
          id: string | null
          operator_email: string | null
          product_code: string | null
          product_name: string | null
          production_order: string | null
          qty_completed: number | null
          qty_outstanding: number | null
          qty_rejected: number | null
          qty_started: number | null
          stage: Database["public"]["Enums"]["wip_stage"] | null
          status: Database["public"]["Enums"]["wo_status"] | null
          total_hours: number | null
          total_labor_cost: number | null
          wo_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      allocate_payment_to_invoice: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_payment_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      approve_sales_order: {
        Args: {
          p_override_credit?: boolean
          p_so_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      auto_allocate_payment: {
        Args: { p_payment_id: string; p_user_id: string }
        Returns: {
          amount_allocated: number
          invoice_id: string
          invoice_number: string
        }[]
      }
      backflush_materials: {
        Args: {
          p_qty_completed: number
          p_user_id: string
          p_work_order_id: string
        }
        Returns: undefined
      }
      calculate_mrp: {
        Args: { p_production_order_id: string }
        Returns: {
          action: string
          available: number
          gross_requirement: number
          material_code: string
          material_id: string
          material_name: string
          net_requirement: number
          on_hand: number
          reserved_other: number
        }[]
      }
      check_customer_credit_limit: {
        Args: { p_customer_id: string; p_new_order_amount: number }
        Returns: {
          available_credit: number
          credit_exceeded: boolean
          credit_hold: boolean
          credit_limit: number
          current_ar_balance: number
          new_total: number
        }[]
      }
      complete_work_order: {
        Args: {
          p_qty_completed: number
          p_qty_rejected: number
          p_user_id: string
          p_work_order_id: string
        }
        Returns: undefined
      }
      confirm_delivery: {
        Args: { p_do_id: string; p_user_id: string }
        Returns: undefined
      }
      create_production_reservations: {
        Args: { p_production_order_id: string }
        Returns: undefined
      }
      explode_bom: {
        Args: { p_max_level?: number; p_product_id: string; p_qty: number }
        Returns: {
          component_product_id: string
          level_num: number
          material_code: string
          material_id: string
          material_name: string
          product_code: string
          product_name: string
          qty_per: number
          scrap_percentage: number
          stage: Database["public"]["Enums"]["wip_stage"]
          total_qty: number
          uom: string
        }[]
      }
      get_audit_history: {
        Args: { p_limit?: number; p_record_id: string; p_table_name: string }
        Returns: {
          changed_at: string
          changed_by: string
          changed_fields: string[]
          new_values: Json
          old_values: Json
          operation: Database["public"]["Enums"]["audit_operation"]
        }[]
      }
      get_balance_sheet: {
        Args: { p_company_id: string; p_period_id: string }
        Returns: {
          account_code: string
          account_name: string
          balance: number
          category: string
          section: string
        }[]
      }
      get_current_open_period: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_fg_aging: {
        Args: { p_company_id: string }
        Returns: {
          aging_bucket: string
          sku_count: number
          total_qty: number
          total_value: number
        }[]
      }
      get_fg_balance: {
        Args: {
          p_bin_id: string
          p_company_id: string
          p_variant_id: string
          p_warehouse_id: string
        }
        Returns: {
          avg_unit_cost: number
          current_qty: number
          last_movement_at: string
          total_value: number
        }[]
      }
      get_fg_total_available: {
        Args: { p_company_id: string; p_variant_id: string }
        Returns: number
      }
      get_hanging_wip: {
        Args: { p_company_id: string; p_days_threshold?: number }
        Returns: {
          current_qty: number
          days_hanging: number
          last_movement_at: string
          product_id: string
          production_order_id: string
          stage: Database["public"]["Enums"]["wip_stage"]
        }[]
      }
      get_income_statement: {
        Args: { p_company_id: string; p_period_id: string }
        Returns: {
          account_code: string
          account_name: string
          balance: number
          category: string
          section: string
        }[]
      }
      get_raw_material_balance: {
        Args: {
          p_bin_id: string
          p_company_id: string
          p_material_id: string
          p_warehouse_id: string
        }
        Returns: {
          avg_unit_cost: number
          current_qty: number
          last_movement_at: string
          total_value: number
        }[]
      }
      get_slow_moving_fg: {
        Args: { p_company_id: string; p_days_threshold?: number }
        Returns: {
          avg_unit_cost: number
          bin_id: string
          current_qty: number
          days_stagnant: number
          last_movement_at: string
          product_variant_id: string
          total_value: number
          warehouse_id: string
        }[]
      }
      get_trial_balance: {
        Args: { p_company_id: string; p_period_id: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          account_type: string
          net_balance: number
          total_credit: number
          total_debit: number
        }[]
      }
      get_wip_balance: {
        Args: {
          p_company_id: string
          p_production_order_id: string
          p_stage: Database["public"]["Enums"]["wip_stage"]
        }
        Returns: {
          avg_unit_cost: number
          current_qty: number
          total_cost_labor: number
          total_cost_material: number
          total_cost_overhead: number
          total_value: number
        }[]
      }
      post_grn: {
        Args: { p_grn_id: string; p_user_id: string }
        Returns: undefined
      }
      post_pos_return: {
        Args: { p_return_id: string; p_user_id: string }
        Returns: undefined
      }
      post_pos_sale: {
        Args: { p_pos_id: string; p_user_id: string }
        Returns: undefined
      }
      post_sales_invoice: {
        Args: { p_invoice_id: string; p_user_id: string }
        Returns: undefined
      }
      refresh_analytics_mvs: { Args: never; Returns: undefined }
      release_production_order: {
        Args: { p_production_order_id: string; p_user_id: string }
        Returns: undefined
      }
      seed_coa_template: { Args: { p_company_id: string }; Returns: number }
    }
    Enums: {
      account_category:
        | "CURRENT_ASSET"
        | "FIXED_ASSET"
        | "INVENTORY"
        | "CURRENT_LIABILITY"
        | "LONG_TERM_LIABILITY"
        | "CAPITAL"
        | "RETAINED_EARNINGS"
        | "SALES_REVENUE"
        | "OTHER_INCOME"
        | "COGS"
        | "OPERATING_EXPENSE"
        | "OTHER_EXPENSE"
      account_type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"
      adjustment_reason:
        | "DAMAGED"
        | "EXPIRED"
        | "LOST"
        | "FOUND"
        | "COUNTING_ERROR"
        | "QUALITY_ISSUE"
        | "SHRINKAGE"
        | "OTHER"
      adjustment_status: "draft" | "approved" | "posted" | "cancelled"
      audit_operation: "INSERT" | "UPDATE" | "DELETE"
      grn_status: "draft" | "posted" | "cancelled"
      invoice_status: "draft" | "posted" | "partial_paid" | "paid" | "cancelled"
      marketplace_order_status:
        | "pending"
        | "ready_to_ship"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "returned"
      marketplace_platform: "Shopee" | "Tokopedia" | "TikTok" | "Lazada"
      marketplace_sync_status: "pending" | "synced" | "failed" | "ignored"
      opname_status: "draft" | "counting" | "completed" | "posted"
      partner_status: "active" | "inactive" | "blocked"
      payment_method:
        | "CASH"
        | "BANK_TRANSFER"
        | "CHECK"
        | "GIRO"
        | "CREDIT_CARD"
      payment_status: "draft" | "posted" | "cancelled" | "cleared"
      payment_terms: "COD" | "NET_7" | "NET_14" | "NET_30" | "NET_60" | "CUSTOM"
      period_status: "open" | "closed"
      po_status:
        | "draft"
        | "submitted"
        | "approved"
        | "partial"
        | "closed"
        | "cancelled"
      product_status: "active" | "inactive" | "discontinued"
      production_status:
        | "planned"
        | "released"
        | "in_progress"
        | "completed"
        | "closed"
        | "cancelled"
      reference_type:
        | "PURCHASE"
        | "PRODUCTION"
        | "ADJUSTMENT"
        | "TRANSFER"
        | "SALES_RETURN"
        | "OPENING_BALANCE"
      transaction_type: "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER"
      transfer_status: "draft" | "in_transit" | "completed" | "cancelled"
      uom: "PCS" | "SET" | "PACK" | "METER" | "KG" | "LITER"
      wip_stage: "CUT" | "SEW" | "FINISH"
      wo_status: "pending" | "in_progress" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_category: [
        "CURRENT_ASSET",
        "FIXED_ASSET",
        "INVENTORY",
        "CURRENT_LIABILITY",
        "LONG_TERM_LIABILITY",
        "CAPITAL",
        "RETAINED_EARNINGS",
        "SALES_REVENUE",
        "OTHER_INCOME",
        "COGS",
        "OPERATING_EXPENSE",
        "OTHER_EXPENSE",
      ],
      account_type: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
      adjustment_reason: [
        "DAMAGED",
        "EXPIRED",
        "LOST",
        "FOUND",
        "COUNTING_ERROR",
        "QUALITY_ISSUE",
        "SHRINKAGE",
        "OTHER",
      ],
      adjustment_status: ["draft", "approved", "posted", "cancelled"],
      audit_operation: ["INSERT", "UPDATE", "DELETE"],
      grn_status: ["draft", "posted", "cancelled"],
      invoice_status: ["draft", "posted", "partial_paid", "paid", "cancelled"],
      marketplace_order_status: [
        "pending",
        "ready_to_ship",
        "in_transit",
        "delivered",
        "cancelled",
        "returned",
      ],
      marketplace_platform: ["Shopee", "Tokopedia", "TikTok", "Lazada"],
      marketplace_sync_status: ["pending", "synced", "failed", "ignored"],
      opname_status: ["draft", "counting", "completed", "posted"],
      partner_status: ["active", "inactive", "blocked"],
      payment_method: ["CASH", "BANK_TRANSFER", "CHECK", "GIRO", "CREDIT_CARD"],
      payment_status: ["draft", "posted", "cancelled", "cleared"],
      payment_terms: ["COD", "NET_7", "NET_14", "NET_30", "NET_60", "CUSTOM"],
      period_status: ["open", "closed"],
      po_status: [
        "draft",
        "submitted",
        "approved",
        "partial",
        "closed",
        "cancelled",
      ],
      product_status: ["active", "inactive", "discontinued"],
      production_status: [
        "planned",
        "released",
        "in_progress",
        "completed",
        "closed",
        "cancelled",
      ],
      reference_type: [
        "PURCHASE",
        "PRODUCTION",
        "ADJUSTMENT",
        "TRANSFER",
        "SALES_RETURN",
        "OPENING_BALANCE",
      ],
      transaction_type: ["RECEIPT", "ISSUE", "ADJUSTMENT", "TRANSFER"],
      transfer_status: ["draft", "in_transit", "completed", "cancelled"],
      uom: ["PCS", "SET", "PACK", "METER", "KG", "LITER"],
      wip_stage: ["CUT", "SEW", "FINISH"],
      wo_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
