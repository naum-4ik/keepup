
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "check_ins": {
                  Row: {
                    "created_at": string,"habit_id": string,"id": string,"local_date": string,"period_start": string,"status": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"habit_id": string,"id"?: string,"local_date": string,"period_start": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"habit_id"?: string,"id"?: string,"local_date"?: string,"period_start"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "check_ins_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"habit_freezes": {
                  Row: {
                    "created_at": string,"ends_on": string | null,"habit_id": string,"id": string,"starts_on": string
                  }
                  Insert: {
                    "created_at"?: string,"ends_on"?: string | null,"habit_id": string,"id"?: string,"starts_on": string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string | null,"habit_id"?: string,"id"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_freezes_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    }
                  ]
                },"habits": {
                  Row: {
                    "archived_at": string | null,"category": Database["public"]['Enums']["habit_category"],"created_at": string,"id": string,"owner_id": string,"period": Database["public"]['Enums']["habit_period"],"starts_on": string,"target_count": number,"title": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"category": Database["public"]['Enums']["habit_category"],"created_at"?: string,"id"?: string,"owner_id"?: string,"period": Database["public"]['Enums']["habit_period"],"starts_on": string,"target_count": number,"title": string
                  }
                  Update: {
                    "archived_at"?: string | null,"category"?: Database["public"]['Enums']["habit_category"],"created_at"?: string,"id"?: string,"owner_id"?: string,"period"?: Database["public"]['Enums']["habit_period"],"starts_on"?: string,"target_count"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "habits_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"period_results": {
                  Row: {
                    "finalized_at": string,"habit_id": string,"outcome": string,"period_start": string
                  }
                  Insert: {
                    "finalized_at"?: string,"habit_id": string,"outcome": string,"period_start": string
                  }
                  Update: {
                    "finalized_at"?: string,"habit_id"?: string,"outcome"?: string,"period_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "period_results_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"onboarded_at": string | null,"reminder_hour": number,"timezone": string,"week_start": number
                  }
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"onboarded_at"?: string | null,"reminder_hour"?: number,"timezone"?: string,"week_start"?: number
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"onboarded_at"?: string | null,"reminder_hour"?: number,"timezone"?: string,"week_start"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "check_in":
{ Args: { "p_habit_id": string }; Returns: {
              "created_at": string,
"habit_id": string,
"id": string,
"local_date": string,
"period_start": string,
"status": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "check_ins"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_habit":
{ Args: { "p_habit_id": string }; Returns: undefined
                           },
"freeze_habit":
{ Args: { "p_ends_on"?: string,"p_habit_id": string,"p_starts_on": string }; Returns: {
              "created_at": string,
"ends_on": string | null,
"habit_id": string,
"id": string,
"starts_on": string
            }
                          SetofOptions: {
        from: "*"
        to: "habit_freezes"
        isOneToOne: true
        isSetofReturn: false
      } },
"habit_history":
{ Args: { "p_habit_id": string,"p_limit"?: number }; Returns: {
              "outcome": string,"period_start": string
            }[]
                           },
"habit_summaries":
{ Args: Record<PropertyKey, never>; Returns: {
              "archived_at": string,"best_streak": number,"category": Database["public"]['Enums']["habit_category"],"checked_in_today": boolean,"created_at": string,"current_streak": number,"days_left": number,"done_count": number,"frozen": boolean,"frozen_until": string,"habit_id": string,"not_started": boolean,"period": Database["public"]['Enums']["habit_period"],"period_start": string,"starts_on": string,"target_count": number,"title": string
            }[]
                           },
"is_valid_timezone":
{ Args: { "tz": string }; Returns: boolean
                           },
"undo_check_in":
{ Args: { "p_check_in_id": string }; Returns: undefined
                           },
"unfreeze_habit":
{ Args: { "p_habit_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "habit_category": "health"|"fitness"|"mind"|"learning"|"people"|"home"|"money"|"break_habit","habit_period": "day"|"week"|"month"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "habit_category": ["health", "fitness", "mind", "learning", "people", "home", "money", "break_habit"],"habit_period": ["day", "week", "month"]
          }
        }
} as const

