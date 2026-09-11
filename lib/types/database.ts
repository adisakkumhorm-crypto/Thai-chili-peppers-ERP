export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounting_connections: {
        Row: {
          config: Json
          created_at: string
          id: string
          org_id: string
          provider: Database["public"]["Enums"]["accounting_provider"]
          status: Database["public"]["Enums"]["accounting_conn_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          org_id: string
          provider: Database["public"]["Enums"]["accounting_provider"]
          status?: Database["public"]["Enums"]["accounting_conn_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["accounting_provider"]
          status?: Database["public"]["Enums"]["accounting_conn_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_sync_map: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          local_entity: string
          local_id: string
          org_id: string
          provider: Database["public"]["Enums"]["accounting_provider"]
          status: Database["public"]["Enums"]["accounting_sync_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          local_entity: string
          local_id: string
          org_id: string
          provider: Database["public"]["Enums"]["accounting_provider"]
          status?: Database["public"]["Enums"]["accounting_sync_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          local_entity?: string
          local_id?: string
          org_id?: string
          provider?: Database["public"]["Enums"]["accounting_provider"]
          status?: Database["public"]["Enums"]["accounting_sync_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_sync_map_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          body: string | null
          client_id: string | null
          created_at: string
          deal_id: string | null
          done: boolean
          due_date: string | null
          id: string
          org_id: string
          owner: string | null
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          org_id: string
          owner?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          done?: boolean
          due_date?: string | null
          id?: string
          org_id?: string
          owner?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_outputs: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          entity: string
          entity_id: string | null
          id: string
          kind: Database["public"]["Enums"]["ai_output_kind"]
          model: string | null
          org_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          entity: string
          entity_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["ai_output_kind"]
          model?: string | null
          org_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ai_output_kind"]
          model?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_outputs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_limits: {
        Row: {
          created_at: string
          id: string
          max_amount: number
          org_id: string
          role_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          max_amount?: number
          org_id: string
          role_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          max_amount?: number
          org_id?: string
          role_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_limits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json
          org_id: string
          summary: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json
          org_id: string
          summary: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json
          org_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_templates: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          implementation_checklist: Json
          internal_value_satang: number | null
          name: string
          org_id: string
          price_satang: number | null
          reusable_notes: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          implementation_checklist?: Json
          internal_value_satang?: number | null
          name: string
          org_id: string
          price_satang?: number | null
          reusable_notes?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          implementation_checklist?: Json
          internal_value_satang?: number | null
          name?: string
          org_id?: string
          price_satang?: number | null
          reusable_notes?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "template_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          id: string
          industry: string | null
          name: string
          notes: string | null
          org_id: string
          owner: string | null
          source: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          org_id: string
          owner?: string | null
          source?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          owner?: string | null
          source?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          org_id: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          org_id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      costs: {
        Row: {
          amount_satang: number
          category: Database["public"]["Enums"]["cost_category"]
          created_at: string
          id: string
          incurred_on: string
          notes: string | null
          org_id: string
          po_id: string | null
          project_id: string | null
          subtotal_satang: number
          supplier_id: string | null
          updated_at: string
          vat_amount_satang: number
          vat_rate_id: string | null
          vendor: string | null
          wht_amount_satang: number
          wht_rate_id: string | null
        }
        Insert: {
          amount_satang: number
          category?: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          id?: string
          incurred_on?: string
          notes?: string | null
          org_id: string
          po_id?: string | null
          project_id?: string | null
          subtotal_satang?: number
          supplier_id?: string | null
          updated_at?: string
          vat_amount_satang?: number
          vat_rate_id?: string | null
          vendor?: string | null
          wht_amount_satang?: number
          wht_rate_id?: string | null
        }
        Update: {
          amount_satang?: number
          category?: Database["public"]["Enums"]["cost_category"]
          created_at?: string
          id?: string
          incurred_on?: string
          notes?: string | null
          org_id?: string
          po_id?: string | null
          project_id?: string | null
          subtotal_satang?: number
          supplier_id?: string | null
          updated_at?: string
          vat_amount_satang?: number
          vat_rate_id?: string | null
          vendor?: string | null
          wht_amount_satang?: number
          wht_rate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "costs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_vat_rate_id_fkey"
            columns: ["vat_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "costs_wht_rate_id_fkey"
            columns: ["wht_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          client_id: string
          created_at: string
          currency: string
          expected_close_date: string | null
          id: string
          next_follow_up_date: string | null
          notes: string | null
          org_id: string
          owner: string | null
          source: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          value_satang: number
        }
        Insert: {
          client_id: string
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          next_follow_up_date?: string | null
          notes?: string | null
          org_id: string
          owner?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          value_satang?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          next_follow_up_date?: string | null
          notes?: string | null
          org_id?: string
          owner?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          updated_at?: string
          value_satang?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          allowed_features: Json | null
          created_at: string
          daily_wage: number
          department: string | null
          employee_code: string
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          face_descriptor: Json | null
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          nickname: string | null
          org_id: string
          position: string | null
          qr_code: string | null
          role: Database["public"]["Enums"]["employee_role"]
          shift_id: string | null
          user_id: string | null
        }
        Insert: {
          allowed_features?: Json | null
          created_at?: string
          daily_wage?: number
          department?: string | null
          employee_code: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          face_descriptor?: Json | null
          first_name: string
          id?: string
          is_active?: boolean | null
          last_name: string
          nickname?: string | null
          org_id: string
          position?: string | null
          qr_code?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          shift_id?: string | null
          user_id?: string | null
        }
        Update: {
          allowed_features?: Json | null
          created_at?: string
          daily_wage?: number
          department?: string | null
          employee_code?: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          face_descriptor?: Json | null
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string
          nickname?: string | null
          org_id?: string
          position?: string | null
          qr_code?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          shift_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          allocated_quantity: number
          created_at: string
          id: string
          location_id: string
          on_hand_quantity: number
          org_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          allocated_quantity?: number
          created_at?: string
          id?: string
          location_id: string
          on_hand_quantity?: number
          org_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          allocated_quantity?: number
          created_at?: string
          id?: string
          location_id?: string
          on_hand_quantity?: number
          org_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          batch_qr_code: string | null
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string | null
          location_id: string
          org_id: string
          product_id: string
          quantity: number
          reference_no: string | null
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Insert: {
          batch_qr_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          location_id: string
          org_id: string
          product_id: string
          quantity: number
          reference_no?: string | null
          transaction_type: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Update: {
          batch_qr_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          location_id?: string
          org_id?: string
          product_id?: string
          quantity?: number
          reference_no?: string | null
          transaction_type?: Database["public"]["Enums"]["inventory_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_satang: number
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          is_recurring: boolean
          issue_date: string
          notes: string | null
          number: string
          org_id: string
          project_id: string | null
          recurring_interval:
            | Database["public"]["Enums"]["recurring_interval"]
            | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_satang: number
          updated_at: string
          vat_amount_satang: number
          vat_rate_id: string | null
          wht_amount_satang: number
          wht_rate_id: string | null
        }
        Insert: {
          amount_satang?: number
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          issue_date?: string
          notes?: string | null
          number: string
          org_id: string
          project_id?: string | null
          recurring_interval?:
            | Database["public"]["Enums"]["recurring_interval"]
            | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_satang?: number
          updated_at?: string
          vat_amount_satang?: number
          vat_rate_id?: string | null
          wht_amount_satang?: number
          wht_rate_id?: string | null
        }
        Update: {
          amount_satang?: number
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          issue_date?: string
          notes?: string | null
          number?: string
          org_id?: string
          project_id?: string | null
          recurring_interval?:
            | Database["public"]["Enums"]["recurring_interval"]
            | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_satang?: number
          updated_at?: string
          vat_amount_satang?: number
          vat_rate_id?: string | null
          wht_amount_satang?: number
          wht_rate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vat_rate_id_fkey"
            columns: ["vat_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_wht_rate_id_fkey"
            columns: ["wht_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          created_at: string
          id: string
          org_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_number: string
          id: string
          org_id: string
          reference_id: string | null
          source: Database["public"]["Enums"]["journal_entry_source"]
          status: Database["public"]["Enums"]["journal_entry_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          entry_number: string
          id?: string
          org_id: string
          reference_id?: string | null
          source?: Database["public"]["Enums"]["journal_entry_source"]
          status?: Database["public"]["Enums"]["journal_entry_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_number?: string
          id?: string
          org_id?: string
          reference_id?: string | null
          source?: Database["public"]["Enums"]["journal_entry_source"]
          status?: Database["public"]["Enums"]["journal_entry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit_amount_satang: number
          debit_amount_satang: number
          description: string | null
          entry_id: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount_satang?: number
          debit_amount_satang?: number
          description?: string | null
          entry_id: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount_satang?: number
          debit_amount_satang?: number
          description?: string | null
          entry_id?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          employee_id: string
          id: string
          org_id: string
          personal_total: number | null
          personal_used: number | null
          sick_total: number | null
          sick_used: number | null
          vacation_total: number | null
          vacation_used: number | null
          year: number
        }
        Insert: {
          employee_id: string
          id?: string
          org_id: string
          personal_total?: number | null
          personal_used?: number | null
          sick_total?: number | null
          sick_used?: number | null
          vacation_total?: number | null
          vacation_used?: number | null
          year?: number
        }
        Update: {
          employee_id?: string
          id?: string
          org_id?: string
          personal_total?: number | null
          personal_used?: number | null
          sick_total?: number | null
          sick_used?: number | null
          vacation_total?: number | null
          vacation_used?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          is_unpaid: boolean | null
          org_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"] | null
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          is_unpaid?: boolean | null
          org_id: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"] | null
          type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          is_unpaid?: boolean | null
          org_id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"] | null
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["role_enum"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["role_enum"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["role_enum"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          org_id: string
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          org_id: string
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          org_id?: string
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          cash_balance_satang: number
          created_at: string
          id: string
          monthly_burn_satang: number | null
          org_id: string
          updated_at: string
        }
        Insert: {
          cash_balance_satang?: number
          created_at?: string
          id?: string
          monthly_burn_satang?: number | null
          org_id: string
          updated_at?: string
        }
        Update: {
          cash_balance_satang?: number
          created_at?: string
          id?: string
          monthly_burn_satang?: number | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          late_penalty_per_minute: number | null
          name: string
          ot_rate_per_hour: number | null
          slug: string
          timezone: string | null
          updated_at: string
          working_days: number[] | null
        }
        Insert: {
          created_at?: string
          id?: string
          late_penalty_per_minute?: number | null
          name: string
          ot_rate_per_hour?: number | null
          slug: string
          timezone?: string | null
          updated_at?: string
          working_days?: number[] | null
        }
        Update: {
          created_at?: string
          id?: string
          late_penalty_per_minute?: number | null
          name?: string
          ot_rate_per_hour?: number | null
          slug?: string
          timezone?: string | null
          updated_at?: string
          working_days?: number[] | null
        }
        Relationships: []
      }
      outbound_events: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          org_id: string
          payload: Json
          status: Database["public"]["Enums"]["outbound_status"]
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event_type: string
          id?: string
          org_id: string
          payload?: Json
          status?: Database["public"]["Enums"]["outbound_status"]
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event_type?: string
          id?: string
          org_id?: string
          payload?: Json
          status?: Database["public"]["Enums"]["outbound_status"]
        }
        Relationships: [
          {
            foreignKeyName: "outbound_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_satang: number
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          org_id: string
          paid_at: string
          updated_at: string
        }
        Insert: {
          amount_satang: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          org_id: string
          paid_at?: string
          updated_at?: string
        }
        Update: {
          amount_satang?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          org_id?: string
          paid_at?: string
          updated_at?: string
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
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pr_quotations: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          lead_time: string | null
          org_id: string
          payment_term: string | null
          pr_id: string
          price: number | null
          quantity: number | null
          quotation_date: string | null
          quotation_number: string | null
          remark: string | null
          status: Database["public"]["Enums"]["pr_quotation_status"]
          supplier_id: string
          unit: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          lead_time?: string | null
          org_id: string
          payment_term?: string | null
          pr_id: string
          price?: number | null
          quantity?: number | null
          quotation_date?: string | null
          quotation_number?: string | null
          remark?: string | null
          status?: Database["public"]["Enums"]["pr_quotation_status"]
          supplier_id: string
          unit?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          lead_time?: string | null
          org_id?: string
          payment_term?: string | null
          pr_id?: string
          price?: number | null
          quantity?: number | null
          quotation_date?: string | null
          quotation_number?: string | null
          remark?: string | null
          status?: Database["public"]["Enums"]["pr_quotation_status"]
          supplier_id?: string
          unit?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pr_quotations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pr_quotations_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pr_quotations_supplier_id_fkey"
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
          cost: number
          created_at: string
          description: string | null
          id: string
          max_stock: number | null
          min_stock: number
          name: string
          org_id: string
          price: number
          sku: string | null
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          max_stock?: number | null
          min_stock?: number
          name: string
          org_id: string
          price?: number
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          max_stock?: number | null
          min_stock?: number
          name?: string
          org_id?: string
          price?: number
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          assignee: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          org_id: string
          project_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          org_id: string
          project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          org_id?: string
          project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_satang: number | null
          client_id: string | null
          created_at: string
          deadline: string | null
          deal_id: string | null
          id: string
          name: string
          org_id: string
          owner: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          budget_satang?: number | null
          client_id?: string | null
          created_at?: string
          deadline?: string | null
          deal_id?: string | null
          id?: string
          name: string
          org_id: string
          owner?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          budget_satang?: number | null
          client_id?: string | null
          created_at?: string
          deadline?: string | null
          deal_id?: string | null
          id?: string
          name?: string
          org_id?: string
          owner?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_holidays_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          org_id: string
          po_id: string
          product_id: string
          project_id: string | null
          quantity: number
          received_quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          po_id: string
          product_id: string
          project_id?: string | null
          quantity?: number
          received_quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          po_id?: string
          product_id?: string
          project_id?: string | null
          quantity?: number
          received_quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          expected_date: string | null
          id: string
          notes: string | null
          org_id: string
          po_number: string
          pr_id: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          po_number: string
          pr_id?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          po_number?: string
          pr_id?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
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
      purchase_request_items: {
        Row: {
          allocated_at_request: number | null
          available_at_request: number | null
          created_at: string
          id: string
          on_hand_at_request: number | null
          org_id: string
          pr_id: string
          product_id: string
          purchase_shortage: number | null
          quantity: number
          specification: string | null
          suggested_stock_usage: number | null
          unit: string | null
        }
        Insert: {
          allocated_at_request?: number | null
          available_at_request?: number | null
          created_at?: string
          id?: string
          on_hand_at_request?: number | null
          org_id: string
          pr_id: string
          product_id: string
          purchase_shortage?: number | null
          quantity: number
          specification?: string | null
          suggested_stock_usage?: number | null
          unit?: string | null
        }
        Update: {
          allocated_at_request?: number | null
          available_at_request?: number | null
          created_at?: string
          id?: string
          on_hand_at_request?: number | null
          org_id?: string
          pr_id?: string
          product_id?: string
          purchase_shortage?: number | null
          quantity?: number
          specification?: string | null
          suggested_stock_usage?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          created_at: string
          estimated_budget: number | null
          id: string
          org_id: string
          po_created_at: string | null
          po_created_by: string | null
          po_id: string | null
          pr_number: string
          project_id: string | null
          reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_by: string
          required_date: string | null
          revision_reason: string | null
          revision_requested_at: string | null
          revision_requested_by: string | null
          selected_at: string | null
          selected_by: string | null
          selected_quotation_id: string | null
          selection_reason: string | null
          status: Database["public"]["Enums"]["pr_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          created_at?: string
          estimated_budget?: number | null
          id?: string
          org_id: string
          po_created_at?: string | null
          po_created_by?: string | null
          po_id?: string | null
          pr_number: string
          project_id?: string | null
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by: string
          required_date?: string | null
          revision_reason?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          selected_at?: string | null
          selected_by?: string | null
          selected_quotation_id?: string | null
          selection_reason?: string | null
          status?: Database["public"]["Enums"]["pr_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          created_at?: string
          estimated_budget?: number | null
          id?: string
          org_id?: string
          po_created_at?: string | null
          po_created_by?: string | null
          po_id?: string | null
          pr_number?: string
          project_id?: string | null
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string
          required_date?: string | null
          revision_reason?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          selected_at?: string | null
          selected_by?: string | null
          selected_quotation_id?: string | null
          selection_reason?: string | null
          status?: Database["public"]["Enums"]["pr_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_selected_quotation_id_fkey"
            columns: ["selected_quotation_id"]
            isOneToOne: false
            referencedRelation: "pr_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel: Database["public"]["Enums"]["reminder_channel"]
          created_at: string
          due_date: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json
          org_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          title: string
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          due_date: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json
          org_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          title: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["reminder_channel"]
          created_at?: string
          due_date?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json
          org_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_channels: {
        Row: {
          created_at: string
          fee_percentage: number | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          platform: string | null
        }
        Insert: {
          created_at?: string
          fee_percentage?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          platform?: string | null
        }
        Update: {
          created_at?: string
          fee_percentage?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          order_id: string
          org_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          order_id: string
          org_id: string
          product_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          order_id?: string
          org_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          channel_id: string | null
          courier: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          order_number: string
          org_id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          shipping_address: string | null
          status: Database["public"]["Enums"]["sales_order_status"] | null
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          courier?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_number: string
          org_id: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"] | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          courier?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          org_id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"] | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "sales_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          config: Json
          created_at: string
          id: string
          module: string
          name: string
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          module: string
          name: string
          org_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          module?: string
          name?: string
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          break_minutes: number
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          rate: number
          type: Database["public"]["Enums"]["tax_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          rate: number
          type: Database["public"]["Enums"]["tax_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          rate?: number
          type?: Database["public"]["Enums"]["tax_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      template_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          check_in: string | null
          check_in_location: Json | null
          check_in_photo: string | null
          check_out: string | null
          check_out_location: Json | null
          check_out_photo: string | null
          created_at: string
          employee_id: string
          id: string
          is_late: boolean | null
          late_minutes: number | null
          org_id: string
          ot_hours: number | null
          ot_multiplier: number | null
          project_id: string | null
          regular_hours: number | null
          status: string | null
          updated_at: string
          wage_amount: number | null
          work_date: string
        }
        Insert: {
          check_in?: string | null
          check_in_location?: Json | null
          check_in_photo?: string | null
          check_out?: string | null
          check_out_location?: Json | null
          check_out_photo?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_late?: boolean | null
          late_minutes?: number | null
          org_id: string
          ot_hours?: number | null
          ot_multiplier?: number | null
          project_id?: string | null
          regular_hours?: number | null
          status?: string | null
          updated_at?: string
          wage_amount?: number | null
          work_date?: string
        }
        Update: {
          check_in?: string | null
          check_in_location?: Json | null
          check_in_photo?: string | null
          check_out?: string | null
          check_out_location?: Json | null
          check_out_photo?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_late?: boolean | null
          late_minutes?: number | null
          org_id?: string
          ot_hours?: number | null
          ot_multiplier?: number | null
          project_id?: string | null
          regular_hours?: number | null
          status?: string | null
          updated_at?: string
          wage_amount?: number | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_automated_journal_entry: {
        Args: {
          p_description: string
          p_lines: Json
          p_org_id: string
          p_reference_id: string
          p_source: Database["public"]["Enums"]["journal_entry_source"]
        }
        Returns: string
      }
      generate_po_from_pr: {
        Args: { p_pr_id: string; p_user_id: string }
        Returns: string
      }
      rpc_cancel_sales_order_reservation: {
        Args: { p_order_id: string; p_org_id: string; p_user_id: string }
        Returns: Json
      }
      rpc_create_cost: {
        Args: {
          p_amount_satang: number
          p_category: Database["public"]["Enums"]["cost_category"]
          p_id: string
          p_incurred_on?: string
          p_notes?: string
          p_org_id: string
          p_po_id?: string
          p_project_id?: string
          p_subtotal_satang: number
          p_supplier_id?: string
          p_vat_amount_satang: number
          p_vat_rate_id?: string
          p_vendor?: string
          p_wht_amount_satang: number
          p_wht_rate_id?: string
        }
        Returns: string
      }
      rpc_create_invoice: {
        Args: {
          p_amount_satang: number
          p_client_id: string
          p_due_date?: string
          p_id: string
          p_is_recurring: boolean
          p_issue_date?: string
          p_notes?: string
          p_number: string
          p_org_id: string
          p_project_id?: string
          p_recurring_interval?: Database["public"]["Enums"]["recurring_interval"]
          p_status: Database["public"]["Enums"]["invoice_status"]
          p_subtotal_satang: number
          p_vat_amount_satang: number
          p_vat_rate_id?: string
          p_wht_amount_satang: number
          p_wht_rate_id?: string
        }
        Returns: string
      }
      rpc_delete_so_item: {
        Args: { p_item_id: string; p_org_id: string }
        Returns: undefined
      }
      rpc_issue_stock: {
        Args: {
          p_idempotency_key: string
          p_location_id?: string
          p_mode: string
          p_org_id: string
          p_product_id?: string
          p_quantity: number
          p_reference_no?: string
          p_sales_order_item_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      rpc_record_payment: {
        Args: {
          p_amount_satang: number
          p_id: string
          p_invoice_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_org_id: string
          p_paid_at?: string
        }
        Returns: string
      }
      rpc_reserve_so_item: {
        Args: {
          p_location_id: string
          p_order_id: string
          p_org_id: string
          p_product_id: string
          p_quantity: number
          p_unit_price: number
        }
        Returns: undefined
      }
      rpc_ship_sales_order: {
        Args: {
          p_idempotency_key?: string
          p_order_id: string
          p_org_id: string
          p_user_id: string
        }
        Returns: Json
      }
      rpc_test_default: {
        Args: { p_opt?: string; p_req: string }
        Returns: string
      }
      test_reorder: {
        Args: { p_a: string; p_b?: string; p_c: string }
        Returns: string
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      accounting_conn_status: "disconnected" | "connected" | "error"
      accounting_provider: "flowaccount" | "peak" | "xero" | "trcloud"
      accounting_sync_status: "pending" | "synced" | "error"
      activity_type: "note" | "call" | "email" | "meeting" | "follow_up"
      ai_output_kind: "deal_summary" | "followup_draft" | "meeting_intake"
      cost_category:
        | "software"
        | "contractor"
        | "infra"
        | "marketing"
        | "salary"
        | "other"
      deal_stage:
        | "lead"
        | "contacted"
        | "discovery"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      employee_role: "admin" | "foreman" | "staff" | "manager" | "executive"
      employment_type: "monthly" | "daily" | "part_time"
      inventory_transaction_type: "receive" | "issue" | "transfer" | "adjust"
      invoice_status:
        | "draft"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      journal_entry_source: "invoice" | "purchase_order" | "payment" | "manual"
      journal_entry_status: "draft" | "posted" | "cancelled"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "sick" | "personal" | "vacation"
      outbound_status: "queued" | "delivered" | "failed"
      payment_method:
        | "transfer"
        | "cash"
        | "card"
        | "promptpay"
        | "cheque"
        | "other"
      payment_method_type:
        | "bank_transfer"
        | "cod"
        | "credit_card"
        | "platform_wallet"
      po_status:
        | "draft"
        | "pending_approval"
        | "ordered"
        | "received"
        | "cancelled"
        | "partially_received"
      pr_quotation_status:
        | "draft"
        | "received"
        | "selected"
        | "rejected"
        | "approved"
      pr_status:
        | "draft"
        | "submitted"
        | "in_procurement"
        | "pending_approval"
        | "approved"
        | "po_created"
        | "rejected"
        | "revision_requested"
        | "cancelled"
      project_status:
        | "not_started"
        | "in_progress"
        | "review"
        | "delivered"
        | "support"
        | "paused"
        | "cancelled"
      recurring_interval: "weekly" | "monthly" | "quarterly" | "yearly"
      reminder_channel: "line" | "email" | "inapp"
      reminder_status: "pending" | "sent" | "cancelled"
      role_enum: "owner" | "admin" | "member"
      sales_order_status:
        | "pending"
        | "paid"
        | "packing"
        | "shipped"
        | "delivered"
        | "cancelled"
      task_status: "todo" | "in_progress" | "done"
      tax_type: "vat" | "wht"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      accounting_conn_status: ["disconnected", "connected", "error"],
      accounting_provider: ["flowaccount", "peak", "xero", "trcloud"],
      accounting_sync_status: ["pending", "synced", "error"],
      activity_type: ["note", "call", "email", "meeting", "follow_up"],
      ai_output_kind: ["deal_summary", "followup_draft", "meeting_intake"],
      cost_category: [
        "software",
        "contractor",
        "infra",
        "marketing",
        "salary",
        "other",
      ],
      deal_stage: [
        "lead",
        "contacted",
        "discovery",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      employee_role: ["admin", "foreman", "staff", "manager", "executive"],
      employment_type: ["monthly", "daily", "part_time"],
      inventory_transaction_type: ["receive", "issue", "transfer", "adjust"],
      invoice_status: [
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      journal_entry_source: ["invoice", "purchase_order", "payment", "manual"],
      journal_entry_status: ["draft", "posted", "cancelled"],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["sick", "personal", "vacation"],
      outbound_status: ["queued", "delivered", "failed"],
      payment_method: [
        "transfer",
        "cash",
        "card",
        "promptpay",
        "cheque",
        "other",
      ],
      payment_method_type: [
        "bank_transfer",
        "cod",
        "credit_card",
        "platform_wallet",
      ],
      po_status: [
        "draft",
        "pending_approval",
        "ordered",
        "received",
        "cancelled",
        "partially_received",
      ],
      pr_quotation_status: [
        "draft",
        "received",
        "selected",
        "rejected",
        "approved",
      ],
      pr_status: [
        "draft",
        "submitted",
        "in_procurement",
        "pending_approval",
        "approved",
        "po_created",
        "rejected",
        "revision_requested",
        "cancelled",
      ],
      project_status: [
        "not_started",
        "in_progress",
        "review",
        "delivered",
        "support",
        "paused",
        "cancelled",
      ],
      recurring_interval: ["weekly", "monthly", "quarterly", "yearly"],
      reminder_channel: ["line", "email", "inapp"],
      reminder_status: ["pending", "sent", "cancelled"],
      role_enum: ["owner", "admin", "member"],
      sales_order_status: [
        "pending",
        "paid",
        "packing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      task_status: ["todo", "in_progress", "done"],
      tax_type: ["vat", "wht"],
    },
  },
} as const

