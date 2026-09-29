
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
                },"group_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"group_id": string,"id": string,"revoked_at": string | null,"token": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at": string,"group_id": string,"id"?: string,"revoked_at"?: string | null,"token"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"group_id"?: string,"id"?: string,"revoked_at"?: string | null,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_invites_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "group_id": string,"joined_at": string,"left_at": string | null,"role": string,"user_id": string
                  }
                  Insert: {
                    "group_id": string,"joined_at"?: string,"left_at"?: string | null,"role"?: string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"joined_at"?: string,"left_at"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"kind": string,"name": string,"timezone": string,"week_start": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"name": string,"timezone": string,"week_start": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"timezone"?: string,"week_start"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_created_by_fkey"
      columns: ["created_by"]
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
                    "archived_at": string | null,"category": Database["public"]['Enums']["habit_category"],"created_at": string,"emoji": string,"id": string,"owner_id": string,"period": Database["public"]['Enums']["habit_period"],"starts_on": string,"target_count": number,"title": string,"week_start": number
                  }
                  Insert: {
                    "archived_at"?: string | null,"category": Database["public"]['Enums']["habit_category"],"created_at"?: string,"emoji": string,"id"?: string,"owner_id"?: string,"period": Database["public"]['Enums']["habit_period"],"starts_on": string,"target_count": number,"title": string,"week_start"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"category"?: Database["public"]['Enums']["habit_category"],"created_at"?: string,"emoji"?: string,"id"?: string,"owner_id"?: string,"period"?: Database["public"]['Enums']["habit_period"],"starts_on"?: string,"target_count"?: number,"title"?: string,"week_start"?: number
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
                    "avatar_color": string | null,"avatar_emoji": string | null,"created_at": string,"display_name": string,"group_id": string | null,"id": string,"kind": string,"onboarded_at": string | null,"purpose": string | null,"reminder_hour": number,"terms_accepted_at": string | null,"timezone": string,"week_start": number
                  }
                  Insert: {
                    "avatar_color"?: string | null,"avatar_emoji"?: string | null,"created_at"?: string,"display_name": string,"group_id"?: string | null,"id": string,"kind"?: string,"onboarded_at"?: string | null,"purpose"?: string | null,"reminder_hour"?: number,"terms_accepted_at"?: string | null,"timezone"?: string,"week_start"?: number
                  }
                  Update: {
                    "avatar_color"?: string | null,"avatar_emoji"?: string | null,"created_at"?: string,"display_name"?: string,"group_id"?: string | null,"id"?: string,"kind"?: string,"onboarded_at"?: string | null,"purpose"?: string | null,"reminder_hour"?: number,"terms_accepted_at"?: string | null,"timezone"?: string,"week_start"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
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
"create_group":
{ Args: { "p_kind"?: string,"p_name": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"id": string,
"kind": string,
"name": string,
"timezone": string,
"week_start": number
            }
                          SetofOptions: {
        from: "*"
        to: "groups"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_invite":
{ Args: { "p_group_id": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"expires_at": string,
"group_id": string,
"id": string,
"revoked_at": string | null,
"token": string
            }
                          SetofOptions: {
        from: "*"
        to: "group_invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_group":
{ Args: { "p_confirm_children"?: boolean,"p_group_id": string }; Returns: undefined
                           },
"delete_habit":
{ Args: { "p_habit_id": string }; Returns: undefined
                           },
"freeze_habit":
{ Args: { "p_ends_on"?: string,"p_habit_id": string,"p_starts_on"?: string }; Returns: {
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
"group_detail":
{ Args: { "p_group_id": string }; Returns: Json
                           },
"habit_history":
{ Args: { "p_habit_id": string,"p_limit"?: number }; Returns: {
              "outcome": string,"period_start": string
            }[]
                           },
"habit_summaries":
{ Args: Record<PropertyKey, never>; Returns: {
              "archived_at": string,"best_streak": number,"category": Database["public"]['Enums']["habit_category"],"checked_in_today": boolean,"created_at": string,"current_streak": number,"days_left": number,"done_count": number,"emoji": string,"frozen": boolean,"frozen_until": string,"habit_id": string,"not_started": boolean,"period": Database["public"]['Enums']["habit_period"],"period_start": string,"starts_on": string,"target_count": number,"title": string
            }[]
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: {
              "group_kind": string,"group_name": string,"inviter_name": string,"member_count": number
            }[]
                           },
"is_group_admin":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"is_group_member":
{ Args: { "p_group_id": string }; Returns: boolean
                           },
"is_valid_timezone":
{ Args: { "tz": string }; Returns: boolean
                           },
"leave_group":
{ Args: { "p_confirm_children"?: boolean,"p_group_id": string }; Returns: undefined
                           },
"my_groups":
{ Args: Record<PropertyKey, never>; Returns: {
              "child_count": number,"group_id": string,"joined_at": string,"kind": string,"member_count": number,"name": string,"role": string
            }[]
                           },
"remove_member":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: undefined
                           },
"revoke_invites":
{ Args: { "p_group_id": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_group_id": string,"p_role": string,"p_user_id": string }; Returns: undefined
                           },
"undo_check_in":
{ Args: { "p_check_in_id": string }; Returns: undefined
                           },
"unfreeze_habit":
{ Args: { "p_habit_id": string }; Returns: undefined
                           },
"update_group":
{ Args: { "p_group_id": string,"p_kind"?: string,"p_name"?: string,"p_timezone"?: string,"p_week_start"?: number }; Returns: {
              "created_at": string,
"created_by": string | null,
"id": string,
"kind": string,
"name": string,
"timezone": string,
"week_start": number
            }
                          SetofOptions: {
        from: "*"
        to: "groups"
        isOneToOne: true
        isSetofReturn: false
      } },
"week_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           }
          }
          Enums: {
            "habit_category": "health"|"fitness"|"mind"|"learning"|"people"|"home"|"work_money"|"break_habit","habit_period": "day"|"week"|"month"
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
            "habit_category": ["health", "fitness", "mind", "learning", "people", "home", "work_money", "break_habit"],"habit_period": ["day", "week", "month"]
          }
        }
} as const

