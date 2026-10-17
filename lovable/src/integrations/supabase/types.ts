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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assistant_messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id?: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_entries: {
        Row: {
          code: string
          company_id: string
          created_at: string
          details: Json
          id: string
          kind: string
          name: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          details?: Json
          id?: string
          kind: string
          name: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_entries_company_id_fkey"
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
          bank: string | null
          chief_accountant: string | null
          created_at: string
          director: string | null
          iban: string | null
          id: string
          idno: string | null
          name: string
          vat_payer: boolean
        }
        Insert: {
          address?: string | null
          bank?: string | null
          chief_accountant?: string | null
          created_at?: string
          director?: string | null
          iban?: string | null
          id?: string
          idno?: string | null
          name: string
          vat_payer?: boolean
        }
        Update: {
          address?: string | null
          bank?: string | null
          chief_accountant?: string | null
          created_at?: string
          director?: string | null
          iban?: string | null
          id?: string
          idno?: string | null
          name?: string
          vat_payer?: boolean
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string
          date: string
          description: string
          id: string
          invoice_details: Json | null
          kind: string
          number: string
          paid: number
          partner_id: string | null
          partner_name: string
          status: string
          total: number
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          invoice_details?: Json | null
          kind: string
          number: string
          paid?: number
          partner_id?: string | null
          partner_name: string
          status?: string
          total: number
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          id?: string
          invoice_details?: Json | null
          kind?: string
          number?: string
          paid?: number
          partner_id?: string | null
          partner_name?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "catalog_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_ai_state: {
        Row: {
          blocked_at: string
          company_id: string
          reason: string
          resumable: boolean
          status: number
        }
        Insert: {
          blocked_at?: string
          company_id: string
          reason: string
          resumable?: boolean
          status: number
        }
        Update: {
          blocked_at?: string
          company_id?: string
          reason?: string
          resumable?: boolean
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_ai_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          credit: string
          date: string
          debit: string
          document_id: string
          id: string
          operation: string
          posted_by: string | null
          state: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          credit: string
          date: string
          debit: string
          document_id: string
          id?: string
          operation: string
          posted_by?: string | null
          state?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          credit?: string
          date?: string
          debit?: string
          document_id?: string
          id?: string
          operation?: string
          posted_by?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string
          date: string
          document_id: string
          id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by: string
          date: string
          document_id: string
          id?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string
          date?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          company_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_payment: {
        Args: { _amount: number; _date: string; _doc: string }
        Returns: undefined
      }
      company_role: {
        Args: { _company: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      confirm_document: { Args: { _doc: string }; Returns: undefined }
      has_perm: { Args: { _company: string; _perm: string }; Returns: boolean }
      invoice_storage_access: {
        Args: { _name: string; _perm: string }
        Returns: boolean
      }
      post_entry: { Args: { _entry: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "director"
        | "chief_accountant"
        | "accountant"
        | "cashier"
        | "warehouse"
        | "operator"
        | "auditor"
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
  public: {
    Enums: {
      app_role: [
        "admin",
        "director",
        "chief_accountant",
        "accountant",
        "cashier",
        "warehouse",
        "operator",
        "auditor",
      ],
    },
  },
} as const
