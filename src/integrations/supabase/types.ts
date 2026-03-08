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
      activity_logs: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      approval_thresholds: {
        Row: {
          action_type: string
          approver_role: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          max_amount: number | null
          min_amount: number
          updated_at: string
        }
        Insert: {
          action_type?: string
          approver_role?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          max_amount?: number | null
          min_amount?: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          approver_role?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          max_amount?: number | null
          min_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_visits: {
        Row: {
          auditor_id: string
          branch_id: string
          cash_notes: string | null
          cash_ok: boolean | null
          created_at: string
          id: string
          is_surprise: boolean
          overall_notes: string | null
          overall_score: number | null
          reports_notes: string | null
          reports_ok: boolean | null
          staff_notes: string | null
          staff_ok: boolean | null
          status: string
          stock_notes: string | null
          stock_ok: boolean | null
          updated_at: string
          visit_date: string
        }
        Insert: {
          auditor_id: string
          branch_id: string
          cash_notes?: string | null
          cash_ok?: boolean | null
          created_at?: string
          id?: string
          is_surprise?: boolean
          overall_notes?: string | null
          overall_score?: number | null
          reports_notes?: string | null
          reports_ok?: boolean | null
          staff_notes?: string | null
          staff_ok?: boolean | null
          status?: string
          stock_notes?: string | null
          stock_ok?: boolean | null
          updated_at?: string
          visit_date?: string
        }
        Update: {
          auditor_id?: string
          branch_id?: string
          cash_notes?: string | null
          cash_ok?: boolean | null
          created_at?: string
          id?: string
          is_surprise?: boolean
          overall_notes?: string | null
          overall_score?: number | null
          reports_notes?: string | null
          reports_ok?: boolean | null
          staff_notes?: string | null
          staff_ok?: boolean | null
          status?: string
          stock_notes?: string | null
          stock_ok?: boolean | null
          updated_at?: string
          visit_date?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string
          currency_code: string
          current_balance: number
          id: string
          is_active: boolean
          name: string
          opening_balance: number
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency_code?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          currency_code?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          description: string
          id: string
          imported_at: string | null
          matched_entity_id: string | null
          matched_entity_type: string | null
          reference: string | null
          status: string
          transaction_date: string
          type: string
        }
        Insert: {
          amount?: number
          bank_account_id: string
          created_at?: string
          description: string
          id?: string
          imported_at?: string | null
          matched_entity_id?: string | null
          matched_entity_type?: string | null
          reference?: string | null
          status?: string
          transaction_date?: string
          type?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          description?: string
          id?: string
          imported_at?: string | null
          matched_entity_id?: string | null
          matched_entity_type?: string | null
          reference?: string | null
          status?: string
          transaction_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_grades: {
        Row: {
          attendance_score: number | null
          branch_id: string
          created_at: string
          expense_score: number | null
          grade: string | null
          graded_by: string | null
          id: string
          notes: string | null
          overall_score: number | null
          period_end: string
          period_start: string
          period_type: string
          revenue_score: number | null
          stock_score: number | null
          updated_at: string
        }
        Insert: {
          attendance_score?: number | null
          branch_id: string
          created_at?: string
          expense_score?: number | null
          grade?: string | null
          graded_by?: string | null
          id?: string
          notes?: string | null
          overall_score?: number | null
          period_end: string
          period_start: string
          period_type: string
          revenue_score?: number | null
          stock_score?: number | null
          updated_at?: string
        }
        Update: {
          attendance_score?: number | null
          branch_id?: string
          created_at?: string
          expense_score?: number | null
          grade?: string | null
          graded_by?: string | null
          id?: string
          notes?: string | null
          overall_score?: number | null
          period_end?: string
          period_start?: string
          period_type?: string
          revenue_score?: number | null
          stock_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      branch_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          created_at: string
          data: Json | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          report_type: string
          status: string
          stock_movements_count: number
          submitted_at: string | null
          submitted_by: string | null
          total_expenses: number
          total_profit: number
          total_sales: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          created_at?: string
          data?: Json | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          report_type: string
          status?: string
          stock_movements_count?: number
          submitted_at?: string | null
          submitted_by?: string | null
          total_expenses?: number
          total_profit?: number
          total_sales?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          created_at?: string
          data?: Json | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          report_type?: string
          status?: string
          stock_movements_count?: number
          submitted_at?: string | null
          submitted_by?: string | null
          total_expenses?: number
          total_profit?: number
          total_sales?: number
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          branch_id: string | null
          city: string | null
          company_name: string
          country: string | null
          created_at: string
          currency_code: string | null
          currency_symbol: string | null
          date_format: string | null
          email: string | null
          font_family: string | null
          footer_text: string | null
          header_text: string | null
          id: string
          logo_url: string | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          currency_code?: string | null
          currency_symbol?: string | null
          date_format?: string | null
          email?: string | null
          font_family?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          currency_code?: string | null
          currency_symbol?: string | null
          date_format?: string | null
          email?: string | null
          font_family?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_items: {
        Row: {
          created_at: string
          credit_note_id: string
          description: string
          id: string
          product_id: string | null
          quantity: number
          tax_rate: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          credit_note_id: string
          description: string
          id?: string
          product_id?: string | null
          quantity?: number
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          credit_note_id?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          created_at: string
          created_by: string | null
          credit_note_number: string
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          id: string
          invoice_id: string | null
          reason: string | null
          refund_method: string | null
          refunded_at: string | null
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credit_note_number: string
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          invoice_id?: string | null
          reason?: string | null
          refund_method?: string | null
          refunded_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credit_note_number?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          invoice_id?: string | null
          reason?: string | null
          refund_method?: string | null
          refunded_at?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_base: boolean
          name: string
          symbol: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_base?: boolean
          name: string
          symbol?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_base?: boolean
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          default_value: string | null
          entity_type: string
          field_label: string
          field_name: string
          field_type: Database["public"]["Enums"]["field_type"]
          id: string
          is_active: boolean | null
          is_required: boolean | null
          options: Json | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          entity_type: string
          field_label: string
          field_name: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          options?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_value?: string | null
          entity_type?: string
          field_label?: string
          field_name?: string
          field_type?: Database["public"]["Enums"]["field_type"]
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          options?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_field_values: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          field_definition_id: string
          id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          field_definition_id: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_definition_id?: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_note_items: {
        Row: {
          created_at: string
          delivery_note_id: string
          description: string
          id: string
          product_id: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          delivery_note_id: string
          description: string
          id?: string
          product_id?: string | null
          quantity?: number
        }
        Update: {
          created_at?: string
          delivery_note_id?: string
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_id: string | null
          customer_name: string
          delivery_date: string | null
          delivery_number: string
          id: string
          invoice_id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name: string
          delivery_date?: string | null
          delivery_number: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string
          delivery_date?: string | null
          delivery_number?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_approval_requests: {
        Row: {
          created_at: string
          id: string
          min_allowed_discount: number
          product_id: string
          reason: string | null
          requested_by: string
          requested_discount: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_allowed_discount: number
          product_id: string
          reason?: string | null
          requested_by: string
          requested_discount: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_allowed_discount?: number
          product_id?: string
          reason?: string | null
          requested_by?: string
          requested_discount?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_approval_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_code_usage: {
        Row: {
          customer_id: string | null
          discount_amount: number
          discount_code_id: string
          id: string
          invoice_id: string | null
          pos_sale_id: string | null
          used_at: string
        }
        Insert: {
          customer_id?: string | null
          discount_amount: number
          discount_code_id: string
          id?: string
          invoice_id?: string | null
          pos_sale_id?: string | null
          used_at?: string
        }
        Update: {
          customer_id?: string | null
          discount_amount?: number
          discount_code_id?: string
          id?: string
          invoice_id?: string | null
          pos_sale_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_code_usage_pos_sale_id_fkey"
            columns: ["pos_sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applicable_branches: string[] | null
          applicable_categories: string[] | null
          applicable_products: string[] | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          id: string
          max_discount_amount: number | null
          min_purchase_amount: number | null
          name: string
          per_customer_limit: number | null
          status: Database["public"]["Enums"]["promotion_status"]
          updated_at: string
          usage_count: number | null
          usage_limit: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          applicable_branches?: string[] | null
          applicable_categories?: string[] | null
          applicable_products?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          max_discount_amount?: number | null
          min_purchase_amount?: number | null
          name: string
          per_customer_limit?: number | null
          status?: Database["public"]["Enums"]["promotion_status"]
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          applicable_branches?: string[] | null
          applicable_categories?: string[] | null
          applicable_products?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          id?: string
          max_discount_amount?: number | null
          min_purchase_amount?: number | null
          name?: string
          per_customer_limit?: number | null
          status?: Database["public"]["Enums"]["promotion_status"]
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          created_at: string
          created_by: string | null
          document_type: string
          field_positions: Json
          id: string
          is_active: boolean
          name: string
          template_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_type: string
          field_positions?: Json
          id?: string
          is_active?: boolean
          name: string
          template_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_type?: string
          field_positions?: Json
          id?: string
          is_active?: boolean
          name?: string
          template_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_breaks: {
        Row: {
          break_end: string | null
          break_start: string
          break_type: string | null
          created_at: string
          id: string
          time_entry_id: string
        }
        Insert: {
          break_end?: string | null
          break_start: string
          break_type?: string | null
          created_at?: string
          id?: string
          time_entry_id: string
        }
        Update: {
          break_end?: string | null
          break_start?: string
          break_type?: string | null
          created_at?: string
          id?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_breaks_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "employee_time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_entries: {
        Row: {
          branch_id: string | null
          break_minutes: number | null
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["clock_status"]
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          break_minutes?: number | null
          clock_in: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["clock_status"]
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          break_minutes?: number | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["clock_status"]
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          rate: number
          to_currency: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          from_currency: string
          id?: string
          rate?: number
          to_currency: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          expense_number: string
          id: string
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          reference: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          expense_number: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          expense_number?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          created_at: string
          goods_receipt_id: string
          id: string
          product_id: string
          quantity_received: number
        }
        Insert: {
          created_at?: string
          goods_receipt_id: string
          id?: string
          product_id: string
          quantity_received?: number
        }
        Update: {
          created_at?: string
          goods_receipt_id?: string
          id?: string
          product_id?: string
          quantity_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          purchase_order_id: string
          received_at: string
          received_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id: string
          received_at?: string
          received_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          purchase_order_id?: string
          received_at?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_valuations: {
        Row: {
          calculated_at: string
          created_at: string
          id: string
          product_id: string
          total_quantity: number
          total_value: number
          unit_cost: number
          valuation_method: string
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          id?: string
          product_id: string
          total_quantity?: number
          total_value?: number
          unit_cost?: number
          valuation_method?: string
        }
        Update: {
          calculated_at?: string
          created_at?: string
          id?: string
          product_id?: string
          total_quantity?: number
          total_value?: number
          unit_cost?: number
          valuation_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_valuations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          branch_ids: string[] | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          resent_at: string | null
          resent_count: number
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          branch_ids?: string[] | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          resent_at?: string | null
          resent_count?: number
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          branch_ids?: string[] | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          resent_at?: string | null
          resent_count?: number
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount: number | null
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          tax_rate: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number | null
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity?: number
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number | null
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          discount_total: number
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          payment_terms: string | null
          project_code: string | null
          quotation_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          payment_terms?: string | null
          project_code?: string | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          discount_total?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          payment_terms?: string | null
          project_code?: string | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_overrides: {
        Row: {
          action_type: string
          created_at: string
          id: string
          manager_id: string
          metadata: Json | null
          reason: string | null
          sale_id: string | null
          shift_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          manager_id: string
          metadata?: Json | null
          reason?: string | null
          sale_id?: string | null
          shift_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          manager_id?: string
          metadata?: Json | null
          reason?: string | null
          sale_id?: string | null
          shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_overrides_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_overrides_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_number: string
          pos_sale_id: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_number: string
          pos_sale_id?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_number?: string
          pos_sale_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_pos_sale_id_fkey"
            columns: ["pos_sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_attempt_log: {
        Row: {
          attempted_at: string
          id: string
          ip_hint: string | null
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_hint?: string | null
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_hint?: string | null
        }
        Relationships: []
      }
      pos_sale_items: {
        Row: {
          created_at: string
          discount: number | null
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          tax_rate: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number | null
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          discount?: number | null
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          amount_paid: number
          branch_id: string | null
          change_amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          discount_total: number
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_number: string
          shift_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
        }
        Insert: {
          amount_paid?: number
          branch_id?: string | null
          change_amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          discount_total?: number
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number: string
          shift_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
        }
        Update: {
          amount_paid?: number
          branch_id?: string | null
          change_amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          discount_total?: number
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number?: string
          shift_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_shifts: {
        Row: {
          actual_cash: number | null
          bank_transfer_sales: number
          branch_id: string | null
          card_sales: number
          cash_difference: number | null
          cash_sales: number
          closed_at: string | null
          closed_by: string | null
          created_at: string
          expected_cash: number
          id: string
          mobile_money_sales: number
          notes: string | null
          opened_at: string
          opening_float: number
          status: string
          total_sales: number
          total_transactions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_cash?: number | null
          bank_transfer_sales?: number
          branch_id?: string | null
          card_sales?: number
          cash_difference?: number | null
          cash_sales?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          expected_cash?: number
          id?: string
          mobile_money_sales?: number
          notes?: string | null
          opened_at?: string
          opening_float?: number
          status?: string
          total_sales?: number
          total_transactions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_cash?: number | null
          bank_transfer_sales?: number
          branch_id?: string | null
          card_sales?: number
          cash_difference?: number | null
          cash_sales?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          expected_cash?: number
          id?: string
          mobile_money_sales?: number
          notes?: string | null
          opened_at?: string
          opening_float?: number
          status?: string
          total_sales?: number
          total_transactions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_number: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          manufacture_date: string | null
          notes: string | null
          product_id: string
          purchase_order_id: string | null
          quantity: number
          received_date: string
          remaining_quantity: number
          status: string
          supplier_id: string | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          batch_number: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          manufacture_date?: string | null
          notes?: string | null
          product_id: string
          purchase_order_id?: string | null
          quantity?: number
          received_date?: string
          remaining_quantity?: number
          status?: string
          supplier_id?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          batch_number?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          manufacture_date?: string | null
          notes?: string | null
          product_id?: string
          purchase_order_id?: string | null
          quantity?: number
          received_date?: string
          remaining_quantity?: number
          status?: string
          supplier_id?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          low_stock_threshold: number | null
          product_id: string
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          low_stock_threshold?: number | null
          product_id: string
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          low_stock_threshold?: number | null
          product_id?: string
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_branches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          cost_price: number | null
          created_at: string
          id: string
          is_preferred: boolean | null
          lead_time_days: number | null
          product_id: string
          supplier_id: string
          supplier_sku: string | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          id?: string
          is_preferred?: boolean | null
          lead_time_days?: number | null
          product_id: string
          supplier_id: string
          supplier_sku?: string | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          id?: string
          is_preferred?: boolean | null
          lead_time_days?: number | null
          product_id?: string
          supplier_id?: string
          supplier_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          low_stock_threshold: number | null
          min_discount_percent: number | null
          name: string
          sku: string | null
          stock_quantity: number
          tax_rate: number | null
          unit: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_discount_percent?: number | null
          name: string
          sku?: string | null
          stock_quantity?: number
          tax_rate?: number | null
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_discount_percent?: number | null
          name?: string
          sku?: string | null
          stock_quantity?: number
          tax_rate?: number | null
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          manager_pin: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          manager_pin?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          manager_pin?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          quantity_received: number | null
          total: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          quantity?: number
          quantity_received?: number | null
          total?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          quantity_received?: number | null
          total?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          received_date: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          subtotal: number
          supplier_id: string
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          received_date?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id: string
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          received_date?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id?: string
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          description: string
          discount: number | null
          id: string
          product_id: string | null
          quantity: number
          quotation_id: string
          tax_rate: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          quotation_id: string
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          discount_total: number
          id: string
          notes: string | null
          project_code: string | null
          quotation_number: string
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          discount_total?: number
          id?: string
          notes?: string | null
          project_code?: string | null
          quotation_number: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          discount_total?: number
          id?: string
          notes?: string | null
          project_code?: string | null
          quotation_number?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_items: {
        Row: {
          created_at: string
          description: string
          discount: number | null
          id: string
          product_id: string | null
          quantity: number
          receipt_id: string
          tax_rate: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          receipt_id: string
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          receipt_id?: string
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_received: number
          branch_id: string | null
          change_amount: number
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          discount_total: number
          id: string
          invoice_id: string | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_number: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_received?: number
          branch_id?: string | null
          change_amount?: number
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          discount_total?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_received?: number
          branch_id?: string | null
          change_amount?: number
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          discount_total?: number
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_items: {
        Row: {
          created_at: string
          description: string
          discount: number | null
          id: string
          product_id: string | null
          quantity: number
          recurring_invoice_id: string
          tax_rate: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          discount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          recurring_invoice_id: string
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          recurring_invoice_id?: string
          tax_rate?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_items_recurring_invoice_id_fkey"
            columns: ["recurring_invoice_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          discount_total: number
          end_date: string | null
          frequency: string
          id: string
          invoices_generated: number
          last_generated_at: string | null
          next_due_date: string
          notes: string | null
          payment_terms: string | null
          status: string
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          discount_total?: number
          end_date?: string | null
          frequency?: string
          id?: string
          invoices_generated?: number
          last_generated_at?: string | null
          next_due_date: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          discount_total?: number
          end_date?: string | null
          frequency?: string
          id?: string
          invoices_generated?: number
          last_generated_at?: string | null
          next_due_date?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          total_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          rate: number
          tax_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate?: number
          tax_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate?: number
          tax_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_returns: {
        Row: {
          created_at: string
          created_by: string | null
          filed_at: string | null
          id: string
          net_tax: number
          period_end: string
          period_start: string
          status: string
          tax_type: string
          total_input_tax: number
          total_output_tax: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filed_at?: string | null
          id?: string
          net_tax?: number
          period_end: string
          period_start: string
          status?: string
          tax_type?: string
          total_input_tax?: number
          total_output_tax?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filed_at?: string | null
          id?: string
          net_tax?: number
          period_end?: string
          period_start?: string
          status?: string
          tax_type?: string
          total_input_tax?: number
          total_output_tax?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_default: boolean
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_branch: {
        Args: { p_branch_id: string; p_user_id: string }
        Returns: boolean
      }
      get_user_branches: { Args: { p_user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_name?: string
          p_entity_type: string
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: string
      }
      process_pos_sale:
        | {
            Args: {
              p_amount_paid: number
              p_created_by: string
              p_customer_id: string
              p_customer_name: string
              p_items: Json
              p_payment_method: Database["public"]["Enums"]["payment_method"]
            }
            Returns: {
              change_amount: number
              sale_id: string
              sale_number: string
            }[]
          }
        | {
            Args: {
              p_amount_paid: number
              p_created_by: string
              p_customer_id: string
              p_customer_name: string
              p_items: Json
              p_payment_method: Database["public"]["Enums"]["payment_method"]
              p_shift_id?: string
            }
            Returns: {
              change_amount: number
              sale_id: string
              sale_number: string
            }[]
          }
      safe_delete_branch: { Args: { p_branch_id: string }; Returns: undefined }
      safe_delete_product: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      set_manager_pin: {
        Args: { p_pin: string; p_user_id: string }
        Returns: undefined
      }
      verify_manager_pin: {
        Args: { p_pin: string }
        Returns: {
          manager_id: string
          manager_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "cashier"
      clock_status: "clocked_in" | "clocked_out" | "on_break"
      discount_type: "percentage" | "fixed_amount"
      document_status:
        | "draft"
        | "pending"
        | "approved"
        | "paid"
        | "cancelled"
        | "delivered"
      field_type:
        | "text"
        | "number"
        | "date"
        | "boolean"
        | "select"
        | "multiselect"
        | "textarea"
      payment_method:
        | "cash"
        | "card"
        | "mobile_money"
        | "bank_transfer"
        | "other"
      promotion_status: "active" | "inactive" | "expired" | "scheduled"
      purchase_order_status:
        | "draft"
        | "submitted"
        | "confirmed"
        | "shipped"
        | "received"
        | "cancelled"
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
      app_role: ["admin", "staff", "cashier"],
      clock_status: ["clocked_in", "clocked_out", "on_break"],
      discount_type: ["percentage", "fixed_amount"],
      document_status: [
        "draft",
        "pending",
        "approved",
        "paid",
        "cancelled",
        "delivered",
      ],
      field_type: [
        "text",
        "number",
        "date",
        "boolean",
        "select",
        "multiselect",
        "textarea",
      ],
      payment_method: [
        "cash",
        "card",
        "mobile_money",
        "bank_transfer",
        "other",
      ],
      promotion_status: ["active", "inactive", "expired", "scheduled"],
      purchase_order_status: [
        "draft",
        "submitted",
        "confirmed",
        "shipped",
        "received",
        "cancelled",
      ],
    },
  },
} as const
