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
      admin_rules: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          json_rules: Json
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          json_rules?: Json
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          json_rules?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_templates: {
        Row: {
          active: boolean | null
          content: string
          created_at: string
          id: string
          name: string
          seniority: string | null
          track: string | null
          type: string
          updated_at: string
          version: number | null
        }
        Insert: {
          active?: boolean | null
          content?: string
          created_at?: string
          id?: string
          name: string
          seniority?: string | null
          track?: string | null
          type: string
          updated_at?: string
          version?: number | null
        }
        Update: {
          active?: boolean | null
          content?: string
          created_at?: string
          id?: string
          name?: string
          seniority?: string | null
          track?: string | null
          type?: string
          updated_at?: string
          version?: number | null
        }
        Relationships: []
      }
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
      crawl_runs: {
        Row: {
          created_at: string
          ended_at: string | null
          errors: string[] | null
          id: string
          pages_crawled: number | null
          source_id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          errors?: string[] | null
          id?: string
          pages_crawled?: number | null
          source_id: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          errors?: string[] | null
          id?: string
          pages_crawled?: number | null
          source_id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
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
          apply_url: string | null
          created_at: string
          deadline: string | null
          deadline_at: string | null
          description: string | null
          experience_level: string | null
          extracted_json: Json | null
          firm: string
          hash: string | null
          id: string
          location: string | null
          match_score: number | null
          posted_at: string | null
          remote_flag: boolean | null
          source: string | null
          source_id: string | null
          source_job_url: string | null
          stage: string
          tags: string[] | null
          title: string
          track: string | null
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          apply_url?: string | null
          created_at?: string
          deadline?: string | null
          deadline_at?: string | null
          description?: string | null
          experience_level?: string | null
          extracted_json?: Json | null
          firm: string
          hash?: string | null
          id?: string
          location?: string | null
          match_score?: number | null
          posted_at?: string | null
          remote_flag?: boolean | null
          source?: string | null
          source_id?: string | null
          source_job_url?: string | null
          stage?: string
          tags?: string[] | null
          title: string
          track?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          apply_url?: string | null
          created_at?: string
          deadline?: string | null
          deadline_at?: string | null
          description?: string | null
          experience_level?: string | null
          extracted_json?: Json | null
          firm?: string
          hash?: string | null
          id?: string
          location?: string | null
          match_score?: number | null
          posted_at?: string | null
          remote_flag?: boolean | null
          source?: string | null
          source_id?: string | null
          source_job_url?: string | null
          stage?: string
          tags?: string[] | null
          title?: string
          track?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_source_id_fk"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_job_matches: {
        Row: {
          created_at: string
          id: string
          job_id: string
          match_reasons: string[] | null
          match_score: number | null
          profile_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          match_reasons?: string[] | null
          match_score?: number | null
          profile_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          match_reasons?: string[] | null
          match_score?: number | null
          profile_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_blacklist: string[] | null
          created_at: string
          cv_text: string | null
          display_name: string | null
          email: string | null
          experience_level: string | null
          gpa: string | null
          graduation_year: string | null
          id: string
          industries: string[] | null
          keywords_exclude: string[] | null
          keywords_include: string[] | null
          location: string | null
          locations: string[] | null
          salary_min: number | null
          skills: string[] | null
          start_date: string | null
          target_track: string | null
          target_tracks: string[] | null
          university: string | null
          updated_at: string
          user_id: string
          visa_status: string | null
        }
        Insert: {
          company_blacklist?: string[] | null
          created_at?: string
          cv_text?: string | null
          display_name?: string | null
          email?: string | null
          experience_level?: string | null
          gpa?: string | null
          graduation_year?: string | null
          id?: string
          industries?: string[] | null
          keywords_exclude?: string[] | null
          keywords_include?: string[] | null
          location?: string | null
          locations?: string[] | null
          salary_min?: number | null
          skills?: string[] | null
          start_date?: string | null
          target_track?: string | null
          target_tracks?: string[] | null
          university?: string | null
          updated_at?: string
          user_id: string
          visa_status?: string | null
        }
        Update: {
          company_blacklist?: string[] | null
          created_at?: string
          cv_text?: string | null
          display_name?: string | null
          email?: string | null
          experience_level?: string | null
          gpa?: string | null
          graduation_year?: string | null
          id?: string
          industries?: string[] | null
          keywords_exclude?: string[] | null
          keywords_include?: string[] | null
          location?: string | null
          locations?: string[] | null
          salary_min?: number | null
          skills?: string[] | null
          start_date?: string | null
          target_track?: string | null
          target_tracks?: string[] | null
          university?: string | null
          updated_at?: string
          user_id?: string
          visa_status?: string | null
        }
        Relationships: []
      }
      raw_pages: {
        Row: {
          created_at: string
          fetched_at: string | null
          hash: string | null
          html_text: string | null
          id: string
          json_text: Json | null
          source_id: string
          url: string
        }
        Insert: {
          created_at?: string
          fetched_at?: string | null
          hash?: string | null
          html_text?: string | null
          id?: string
          json_text?: Json | null
          source_id: string
          url: string
        }
        Update: {
          created_at?: string
          fetched_at?: string | null
          hash?: string | null
          html_text?: string | null
          id?: string
          json_text?: Json | null
          source_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_pages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          allowlist_paths: string[] | null
          base_url: string
          crawl_type: string | null
          created_at: string
          enabled: boolean | null
          frequency_minutes: number | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          allowlist_paths?: string[] | null
          base_url: string
          crawl_type?: string | null
          created_at?: string
          enabled?: boolean | null
          frequency_minutes?: number | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          allowlist_paths?: string[] | null
          base_url?: string
          crawl_type?: string | null
          created_at?: string
          enabled?: boolean | null
          frequency_minutes?: number | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          created_at: string
          extracted_json: Json | null
          file_path: string
          file_type: string | null
          id: string
          owner_id: string
          owner_type: string
        }
        Insert: {
          created_at?: string
          extracted_json?: Json | null
          file_path: string
          file_type?: string | null
          id?: string
          owner_id: string
          owner_type?: string
        }
        Update: {
          created_at?: string
          extracted_json?: Json | null
          file_path?: string
          file_type?: string | null
          id?: string
          owner_id?: string
          owner_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      websites: {
        Row: {
          created_at: string
          frequency: string | null
          id: string
          job_titles: string[] | null
          jobs_found: number | null
          keywords: string[] | null
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
          job_titles?: string[] | null
          jobs_found?: number | null
          keywords?: string[] | null
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
          job_titles?: string[] | null
          jobs_found?: number | null
          keywords?: string[] | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
