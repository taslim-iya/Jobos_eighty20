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
      contacts: {
        Row: {
          channel: string | null
          created_at: string
          firm: string | null
          id: string
          last_contact_date: string | null
          name: string
          notes: string | null
          role: string | null
          sequence_step: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          firm?: string | null
          id?: string
          last_contact_date?: string | null
          name: string
          notes?: string | null
          role?: string | null
          sequence_step?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          firm?: string | null
          id?: string
          last_contact_date?: string | null
          name?: string
          notes?: string | null
          role?: string | null
          sequence_step?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_status: string | null
          doc_category: string | null
          entities_count: number | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          filename: string
          id: string
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          ai_status?: string | null
          doc_category?: string | null
          entities_count?: number | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          filename: string
          id?: string
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          ai_status?: string | null
          doc_category?: string | null
          entities_count?: number | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          deadline: string | null
          description: string | null
          experience_level: string | null
          firm: string
          id: string
          location: string | null
          match_score: number | null
          source: string | null
          stage: string
          tags: string[] | null
          title: string
          track: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          experience_level?: string | null
          firm: string
          id?: string
          location?: string | null
          match_score?: number | null
          source?: string | null
          stage?: string
          tags?: string[] | null
          title: string
          track?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          experience_level?: string | null
          firm?: string
          id?: string
          location?: string | null
          match_score?: number | null
          source?: string | null
          stage?: string
          tags?: string[] | null
          title?: string
          track?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          cv_text: string | null
          display_name: string | null
          email: string | null
          experience_level: string | null
          gpa: string | null
          graduation_year: string | null
          id: string
          location: string | null
          target_track: string | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cv_text?: string | null
          display_name?: string | null
          email?: string | null
          experience_level?: string | null
          gpa?: string | null
          graduation_year?: string | null
          id?: string
          location?: string | null
          target_track?: string | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cv_text?: string | null
          display_name?: string | null
          email?: string | null
          experience_level?: string | null
          gpa?: string | null
          graduation_year?: string | null
          id?: string
          location?: string | null
          target_track?: string | null
          university?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      websites: {
        Row: {
          created_at: string
          frequency: string | null
          id: string
          jobs_found: number | null
          label: string | null
          last_scanned: string | null
          status: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          frequency?: string | null
          id?: string
          jobs_found?: number | null
          label?: string | null
          last_scanned?: string | null
          status?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          frequency?: string | null
          id?: string
          jobs_found?: number | null
          label?: string | null
          last_scanned?: string | null
          status?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
