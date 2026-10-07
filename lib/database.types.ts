
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
            "achievements": {
                  Row: {
                    "badge_group": string,"code": string,"description": string,"icon": string,"name": string,"sort_order": number
                  }
                  Insert: {
                    "badge_group": string,"code": string,"description": string,"icon": string,"name": string,"sort_order": number
                  }
                  Update: {
                    "badge_group"?: string,"code"?: string,"description"?: string,"icon"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"check_ins": {
                  Row: {
                    "by_child": boolean,"client_id": string | null,"created_at": string,"habit_id": string,"id": string,"local_date": string,"logged_by": string | null,"period_start": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": string,"tapped_at": string | null,"user_id": string
                  }
                  Insert: {
                    "by_child"?: boolean,"client_id"?: string | null,"created_at"?: string,"habit_id": string,"id"?: string,"local_date": string,"logged_by"?: string | null,"period_start": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"tapped_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "by_child"?: boolean,"client_id"?: string | null,"created_at"?: string,"habit_id"?: string,"id"?: string,"local_date"?: string,"logged_by"?: string | null,"period_start"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"tapped_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "check_ins_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cheers": {
                  Row: {
                    "check_in_id": string,"created_at": string,"user_id": string
                  }
                  Insert: {
                    "check_in_id": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "check_in_id"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cheers_check_in_id_fkey"
      columns: ["check_in_id"]
isOneToOne: false
      referencedRelation: "check_ins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cheers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dismissed_cards": {
                  Row: {
                    "card": string,"dismissed_at": string,"user_id": string
                  }
                  Insert: {
                    "card": string,"dismissed_at"?: string,"user_id": string
                  }
                  Update: {
                    "card"?: string,"dismissed_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dismissed_cards_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"group_habit_participants": {
                  Row: {
                    "habit_id": string,"profile_id": string
                  }
                  Insert: {
                    "habit_id": string,"profile_id": string
                  }
                  Update: {
                    "habit_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_habit_participants_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_habit_participants_profile_id_fkey"
      columns: ["profile_id"]
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
                    "avatar_color": string | null,"avatar_emoji": string | null,"created_at": string,"created_by": string | null,"id": string,"kind": string,"name": string,"timezone": string,"week_start": number
                  }
                  Insert: {
                    "avatar_color"?: string | null,"avatar_emoji"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"name": string,"timezone": string,"week_start": number
                  }
                  Update: {
                    "avatar_color"?: string | null,"avatar_emoji"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"timezone"?: string,"week_start"?: number
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
                    "created_at": string,"created_by": string | null,"ends_on": string | null,"habit_id": string,"id": string,"starts_on": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_on"?: string | null,"habit_id": string,"id"?: string,"starts_on": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_on"?: string | null,"habit_id"?: string,"id"?: string,"starts_on"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_freezes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "habit_freezes_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "habit_freezes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"habit_user_settings": {
                  Row: {
                    "habit_id": string,"muted": boolean,"remind_at": string | null,"reminders": boolean,"user_id": string
                  }
                  Insert: {
                    "habit_id": string,"muted"?: boolean,"remind_at"?: string | null,"reminders"?: boolean,"user_id": string
                  }
                  Update: {
                    "habit_id"?: string,"muted"?: boolean,"remind_at"?: string | null,"reminders"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_user_settings_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "habit_user_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"habits": {
                  Row: {
                    "archived_at": string | null,"category": Database["public"]['Enums']["habit_category"] | null,"created_at": string,"created_by": string | null,"emoji": string,"ends_on": string | null,"finished_at": string | null,"group_id": string | null,"id": string,"owner_id": string | null,"period": Database["public"]['Enums']["habit_period"],"requires_approval": boolean,"starts_on": string,"target_count": number,"title": string,"week_start": number
                  }
                  Insert: {
                    "archived_at"?: string | null,"category"?: Database["public"]['Enums']["habit_category"] | null,"created_at"?: string,"created_by"?: string | null,"emoji": string,"ends_on"?: string | null,"finished_at"?: string | null,"group_id"?: string | null,"id"?: string,"owner_id"?: string | null,"period": Database["public"]['Enums']["habit_period"],"requires_approval"?: boolean,"starts_on": string,"target_count": number,"title": string,"week_start"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"category"?: Database["public"]['Enums']["habit_category"] | null,"created_at"?: string,"created_by"?: string | null,"emoji"?: string,"ends_on"?: string | null,"finished_at"?: string | null,"group_id"?: string | null,"id"?: string,"owner_id"?: string | null,"period"?: Database["public"]['Enums']["habit_period"],"requires_approval"?: boolean,"starts_on"?: string,"target_count"?: number,"title"?: string,"week_start"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "habits_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "habits_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "habits_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"level_ups": {
                  Row: {
                    "level": number,"reached_at": string,"seen_at": string | null,"user_id": string
                  }
                  Insert: {
                    "level": number,"reached_at"?: string,"seen_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "level"?: number,"reached_at"?: string,"seen_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "level_ups_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "category": string,"delivery": string,"enabled": boolean,"user_id": string
                  }
                  Insert: {
                    "category": string,"delivery"?: string,"enabled": boolean,"user_id": string
                  }
                  Update: {
                    "category"?: string,"delivery"?: string,"enabled"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"category": string | null,"check_in_id": string | null,"created_at": string,"dedupe_key": string | null,"group_id": string | null,"habit_id": string | null,"id": string,"kind": string,"payload": NonNullable<Json>,"push": boolean,"pushed_at": string | null,"read_at": string | null,"seen_at": string | null,"subject_id": string | null,"user_id": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"category"?: string | null,"check_in_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"group_id"?: string | null,"habit_id"?: string | null,"id"?: string,"kind": string,"payload"?: NonNullable<Json>,"push"?: boolean,"pushed_at"?: string | null,"read_at"?: string | null,"seen_at"?: string | null,"subject_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"category"?: string | null,"check_in_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"group_id"?: string | null,"habit_id"?: string | null,"id"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"push"?: boolean,"pushed_at"?: string | null,"read_at"?: string | null,"seen_at"?: string | null,"subject_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_check_in_id_fkey"
      columns: ["check_in_id"]
isOneToOne: false
      referencedRelation: "check_ins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"nudges": {
                  Row: {
                    "created_at": string,"habit_id": string,"kind": string,"local_date": string,"recipient_id": string,"sender_id": string
                  }
                  Insert: {
                    "created_at"?: string,"habit_id": string,"kind": string,"local_date": string,"recipient_id": string,"sender_id": string
                  }
                  Update: {
                    "created_at"?: string,"habit_id"?: string,"kind"?: string,"local_date"?: string,"recipient_id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "nudges_habit_id_fkey"
      columns: ["habit_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nudges_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nudges_sender_id_fkey"
      columns: ["sender_id"]
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
                    "avatar_color": string | null,"avatar_emoji": string | null,"celebrations": string,"created_at": string,"data_reset_at": string | null,"display_name": string,"group_id": string | null,"id": string,"is_demo": boolean,"kid_theme": string | null,"kind": string,"muted_until": string | null,"onboarded_at": string | null,"purpose": string | null,"reminder_hour": number,"terms_accepted_at": string | null,"timezone": string,"week_start": number
                  }
                  Insert: {
                    "avatar_color"?: string | null,"avatar_emoji"?: string | null,"celebrations"?: string,"created_at"?: string,"data_reset_at"?: string | null,"display_name": string,"group_id"?: string | null,"id": string,"is_demo"?: boolean,"kid_theme"?: string | null,"kind"?: string,"muted_until"?: string | null,"onboarded_at"?: string | null,"purpose"?: string | null,"reminder_hour"?: number,"terms_accepted_at"?: string | null,"timezone"?: string,"week_start"?: number
                  }
                  Update: {
                    "avatar_color"?: string | null,"avatar_emoji"?: string | null,"celebrations"?: string,"created_at"?: string,"data_reset_at"?: string | null,"display_name"?: string,"group_id"?: string | null,"id"?: string,"is_demo"?: boolean,"kid_theme"?: string | null,"kind"?: string,"muted_until"?: string | null,"onboarded_at"?: string | null,"purpose"?: string | null,"reminder_hour"?: number,"terms_accepted_at"?: string | null,"timezone"?: string,"week_start"?: number
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
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recap_runs": {
                  Row: {
                    "group_id": string | null,"kind": string,"period_start": string,"processed_at": string,"user_id": string | null
                  }
                  Insert: {
                    "group_id"?: string | null,"kind": string,"period_start": string,"processed_at": string,"user_id"?: string | null
                  }
                  Update: {
                    "group_id"?: string | null,"kind"?: string,"period_start"?: string,"processed_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recap_runs_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recap_runs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"treat_goals": {
                  Row: {
                    "child_id": string,"created_at": string,"created_by": string | null,"emoji": string,"id": string,"reached_at": string | null,"received_at": string | null,"target": number,"title": string
                  }
                  Insert: {
                    "child_id": string,"created_at"?: string,"created_by"?: string | null,"emoji": string,"id"?: string,"reached_at"?: string | null,"received_at"?: string | null,"target": number,"title": string
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"created_by"?: string | null,"emoji"?: string,"id"?: string,"reached_at"?: string | null,"received_at"?: string | null,"target"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treat_goals_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "treat_goals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_achievements": {
                  Row: {
                    "achievement_code": string,"seen_at": string | null,"unlocked_at": string,"user_id": string
                  }
                  Insert: {
                    "achievement_code": string,"seen_at"?: string | null,"unlocked_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievement_code"?: string,"seen_at"?: string | null,"unlocked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_achievements_achievement_code_fkey"
      columns: ["achievement_code"]
isOneToOne: false
      referencedRelation: "achievements"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "user_achievements_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"xp_events": {
                  Row: {
                    "amount": number,"created_at": string,"habit_id": string | null,"id": string,"reason": string,"source_id": string,"source_type": string,"user_id": string
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"habit_id"?: string | null,"id"?: string,"reason": string,"source_id": string,"source_type": string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"habit_id"?: string | null,"id"?: string,"reason"?: string,"source_id"?: string,"source_type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "xp_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
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
"calendar_cells":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "check_ins": number,"habit_id": string,"local_date": string,"outcome": string
            }[]
                           },
"calendar_start":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"can_act_for_profile":
{ Args: { "p_profile_id": string }; Returns: boolean
                           },
"can_manage_habit":
{ Args: { "p_habit_id": string }; Returns: boolean
                           },
"can_read_habit":
{ Args: { "p_habit_id": string }; Returns: boolean
                           },
"cancel_treat_goal":
{ Args: { "p_goal_id": string }; Returns: undefined
                           },
"check_in":
{ Args: { "p_client_id"?: string,"p_habit_id": string,"p_tapped_at"?: string }; Returns: {
              "by_child": boolean,
"client_id": string | null,
"created_at": string,
"habit_id": string,
"id": string,
"local_date": string,
"logged_by": string | null,
"period_start": string,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"tapped_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "check_ins"
        isOneToOne: true
        isSetofReturn: false
      } },
"check_in_for":
{ Args: { "p_by_child"?: boolean,"p_child_id": string,"p_client_id"?: string,"p_habit_id": string,"p_tapped_at"?: string }; Returns: {
              "by_child": boolean,
"client_id": string | null,
"created_at": string,
"habit_id": string,
"id": string,
"local_date": string,
"logged_by": string | null,
"period_start": string,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"tapped_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "check_ins"
        isOneToOne: true
        isSetofReturn: false
      } },
"check_in_with":
{ Args: { "p_children": (string)[],"p_habit_id": string }; Returns: {
              "by_child": boolean,
"client_id": string | null,
"created_at": string,
"habit_id": string,
"id": string,
"local_date": string,
"logged_by": string | null,
"period_start": string,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"tapped_at": string | null,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "check_ins"
        isOneToOne: false
        isSetofReturn: true
      } },
"cheer":
{ Args: { "p_check_in_id": string }; Returns: undefined
                           },
"child_rewards":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"child_summaries":
{ Args: { "p_child_id": string }; Returns: {
              "archived_at": string,"best_streak": number,"category": Database["public"]['Enums']["habit_category"],"checked_in_today": boolean,"created_at": string,"current_streak": number,"days_left": number,"done_count": number,"emoji": string,"frozen": boolean,"frozen_until": string,"group_done": boolean,"group_id": string,"group_name": string,"habit_id": string,"members": Json,"my_role": string,"not_started": boolean,"pending_count": number,"period": Database["public"]['Enums']["habit_period"],"period_start": string,"requires_approval": boolean,"starts_on": string,"target_count": number,"title": string
            }[]
                           },
"create_child":
{ Args: { "p_avatar_color": string,"p_avatar_emoji": string,"p_group_id": string,"p_guardian_confirmed": boolean,"p_name": string }; Returns: string
                           },
"create_child_habit":
{ Args: { "p_child_id": string,"p_emoji": string,"p_period": Database["public"]['Enums']["habit_period"],"p_starts_on"?: string,"p_target_count": number,"p_title": string }; Returns: {
              "archived_at": string | null,
"category": Database["public"]['Enums']["habit_category"] | null,
"created_at": string,
"created_by": string | null,
"emoji": string,
"ends_on": string | null,
"finished_at": string | null,
"group_id": string | null,
"id": string,
"owner_id": string | null,
"period": Database["public"]['Enums']["habit_period"],
"requires_approval": boolean,
"starts_on": string,
"target_count": number,
"title": string,
"week_start": number
            }
                          SetofOptions: {
        from: "*"
        to: "habits"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_group":
{ Args: { "p_kind"?: string,"p_name": string }; Returns: {
              "avatar_color": string | null,
"avatar_emoji": string | null,
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
"create_group_habit":
{ Args: { "p_category": Database["public"]['Enums']["habit_category"],"p_children"?: (string)[],"p_emoji": string,"p_group_id": string,"p_period": Database["public"]['Enums']["habit_period"],"p_requires_approval"?: boolean,"p_starts_on"?: string,"p_target_count": number,"p_title": string }; Returns: {
              "archived_at": string | null,
"category": Database["public"]['Enums']["habit_category"] | null,
"created_at": string,
"created_by": string | null,
"emoji": string,
"ends_on": string | null,
"finished_at": string | null,
"group_id": string | null,
"id": string,
"owner_id": string | null,
"period": Database["public"]['Enums']["habit_period"],
"requires_approval": boolean,
"starts_on": string,
"target_count": number,
"title": string,
"week_start": number
            }
                          SetofOptions: {
        from: "*"
        to: "habits"
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
"delete_account_preview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"delete_child":
{ Args: { "p_child_id": string }; Returns: undefined
                           },
"delete_group":
{ Args: { "p_confirm_children"?: boolean,"p_group_id": string }; Returns: undefined
                           },
"delete_habit":
{ Args: { "p_habit_id": string }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"delete_push_subscription":
{ Args: { "p_endpoint": string }; Returns: undefined
                           },
"dismiss_card":
{ Args: { "p_card": string }; Returns: undefined
                           },
"export_child":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"family_recaps":
{ Args: Record<PropertyKey, never>; Returns: {
              "best_emoji": string,"best_period": Database["public"]['Enums']["habit_period"],"best_streak": number,"best_title": string,"check_ins": number,"group_id": string,"group_name": string,"week_start": string
            }[]
                           },
"finish_habit":
{ Args: { "p_habit_id": string }; Returns: {
              "archived_at": string | null,
"category": Database["public"]['Enums']["habit_category"] | null,
"created_at": string,
"created_by": string | null,
"emoji": string,
"ends_on": string | null,
"finished_at": string | null,
"group_id": string | null,
"id": string,
"owner_id": string | null,
"period": Database["public"]['Enums']["habit_period"],
"requires_approval": boolean,
"starts_on": string,
"target_count": number,
"title": string,
"week_start": number
            }
                          SetofOptions: {
        from: "*"
        to: "habits"
        isOneToOne: true
        isSetofReturn: false
      } },
"freeze_habit":
{ Args: { "p_ends_on"?: string,"p_habit_id": string,"p_starts_on"?: string }; Returns: {
              "created_at": string,
"created_by": string | null,
"ends_on": string | null,
"habit_id": string,
"id": string,
"starts_on": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "habit_freezes"
        isOneToOne: true
        isSetofReturn: false
      } },
"freeze_member":
{ Args: { "p_ends_on"?: string,"p_habit_id": string,"p_profile_id"?: string,"p_starts_on"?: string }; Returns: {
              "created_at": string,
"created_by": string | null,
"ends_on": string | null,
"habit_id": string,
"id": string,
"starts_on": string,
"user_id": string | null
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
"habit_finish_summary":
{ Args: { "p_habit_id": string }; Returns: {
              "best_streak": number,"done": number,"total": number
            }[]
                           },
"habit_history":
{ Args: { "p_habit_id": string,"p_limit"?: number }; Returns: {
              "outcome": string,"period_start": string
            }[]
                           },
"habit_summaries":
{ Args: Record<PropertyKey, never>; Returns: {
              "archived_at": string,"best_streak": number,"category": Database["public"]['Enums']["habit_category"],"checked_in_today": boolean,"created_at": string,"current_streak": number,"days_left": number,"done_count": number,"emoji": string,"frozen": boolean,"frozen_until": string,"group_done": boolean,"group_id": string,"group_name": string,"habit_id": string,"members": Json,"my_role": string,"not_started": boolean,"pending_count": number,"period": Database["public"]['Enums']["habit_period"],"period_start": string,"requires_approval": boolean,"starts_on": string,"target_count": number,"title": string
            }[]
                           },
"inbox_feed":
{ Args: { "p_limit"?: number }; Returns: {
              "actor_avatar_color": string,"actor_avatar_emoji": string,"actor_name": string,"check_in_id": string,"created_at": string,"group_id": string,"group_name": string,"habit_emoji": string,"habit_id": string,"habit_title": string,"id": string,"kind": string,"payload": Json,"read_at": string,"seen_at": string,"subject_avatar_emoji": string,"subject_id": string,"subject_name": string
            }[]
                           },
"invite_membership":
{ Args: { "p_token": string }; Returns: string
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: {
              "avatar_color": string,"avatar_emoji": string,"group_kind": string,"group_name": string,"inviter_name": string,"member_count": number
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
"keep_going":
{ Args: { "p_habit_id": string }; Returns: {
              "archived_at": string | null,
"category": Database["public"]['Enums']["habit_category"] | null,
"created_at": string,
"created_by": string | null,
"emoji": string,
"ends_on": string | null,
"finished_at": string | null,
"group_id": string | null,
"id": string,
"owner_id": string | null,
"period": Database["public"]['Enums']["habit_period"],
"requires_approval": boolean,
"starts_on": string,
"target_count": number,
"title": string,
"week_start": number
            }
                          SetofOptions: {
        from: "*"
        to: "habits"
        isOneToOne: true
        isSetofReturn: false
      } },
"leave_group":
{ Args: { "p_confirm_children"?: boolean,"p_group_id": string }; Returns: undefined
                           },
"mark_badges_seen":
{ Args: { "p_codes": (string)[] }; Returns: number
                           },
"mark_feed_read":
{ Args: { "p_ids"?: (string)[] }; Returns: number
                           },
"mark_feed_seen":
{ Args: { "p_ids": (string)[] }; Returns: number
                           },
"mark_levels_seen":
{ Args: { "p_up_to": number }; Returns: number
                           },
"mark_treat_received":
{ Args: { "p_goal_id": string }; Returns: undefined
                           },
"move_child":
{ Args: { "p_child_id": string,"p_to_group_id": string }; Returns: undefined
                           },
"my_children":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_color": string,"avatar_emoji": string,"child_id": string,"created_at": string,"group_id": string,"group_name": string,"kid_theme": string,"name": string
            }[]
                           },
"my_groups":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_color": string,"avatar_emoji": string,"child_count": number,"group_id": string,"joined_at": string,"kind": string,"member_count": number,"name": string,"role": string
            }[]
                           },
"my_level":
{ Args: Record<PropertyKey, never>; Returns: {
              "level": number,"xp": number
            }[]
                           },
"nudge":
{ Args: { "p_habit_id": string,"p_kind": string,"p_recipient_id": string }; Returns: undefined
                           },
"pause_notifications":
{ Args: { "p_choice": string }; Returns: string
                           },
"pending_approvals":
{ Args: Record<PropertyKey, never>; Returns: {
              "author_avatar_color": string,"author_avatar_emoji": string,"author_id": string,"author_name": string,"check_in_id": string,"created_at": string,"group_id": string,"group_name": string,"habit_emoji": string,"habit_id": string,"habit_title": string,"local_date": string,"review_deadline": string
            }[]
                           },
"push_done":
{ Args: { "p_dead_endpoints": (string)[],"p_id": string }; Returns: undefined
                           },
"push_job":
{ Args: { "p_id": string,"p_now"?: string }; Returns: Json
                           },
"recaps":
{ Args: { "p_count"?: number,"p_kind": string }; Returns: Json[]
                           },
"refresh_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: boolean
                           },
"remove_member":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: undefined
                           },
"reset_child":
{ Args: { "p_child_id": string }; Returns: undefined
                           },
"reset_my_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"restore_habit":
{ Args: { "p_habit_id": string }; Returns: {
              "archived_at": string | null,
"category": Database["public"]['Enums']["habit_category"] | null,
"created_at": string,
"created_by": string | null,
"emoji": string,
"ends_on": string | null,
"finished_at": string | null,
"group_id": string | null,
"id": string,
"owner_id": string | null,
"period": Database["public"]['Enums']["habit_period"],
"requires_approval": boolean,
"starts_on": string,
"target_count": number,
"title": string,
"week_start": number
            }
                          SetofOptions: {
        from: "*"
        to: "habits"
        isOneToOne: true
        isSetofReturn: false
      } },
"review_check_in":
{ Args: { "p_approve": boolean,"p_check_in_id": string }; Returns: {
              "by_child": boolean,
"client_id": string | null,
"created_at": string,
"habit_id": string,
"id": string,
"local_date": string,
"logged_by": string | null,
"period_start": string,
"reviewed_at": string | null,
"reviewed_by": string | null,
"status": string,
"tapped_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "check_ins"
        isOneToOne: true
        isSetofReturn: false
      } },
"review_check_ins":
{ Args: { "p_approve": boolean,"p_check_in_ids": (string)[] }; Returns: number
                           },
"revoke_invites":
{ Args: { "p_group_id": string }; Returns: undefined
                           },
"rotate_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_old_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: boolean
                           },
"save_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: undefined
                           },
"set_celebrations":
{ Args: { "p_mode": string }; Returns: undefined
                           },
"set_child_theme":
{ Args: { "p_child_id": string,"p_theme": string }; Returns: undefined
                           },
"set_group_avatar":
{ Args: { "p_color": string,"p_emoji": string,"p_group_id": string }; Returns: {
              "avatar_color": string | null,
"avatar_emoji": string | null,
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
"set_habit_end":
{ Args: { "p_ends_on": string,"p_habit_id": string }; Returns: {
              "archived_at": string | null,
"category": Database["public"]['Enums']["habit_category"] | null,
"created_at": string,
"created_by": string | null,
"emoji": string,
"ends_on": string | null,
"finished_at": string | null,
"group_id": string | null,
"id": string,
"owner_id": string | null,
"period": Database["public"]['Enums']["habit_period"],
"requires_approval": boolean,
"starts_on": string,
"target_count": number,
"title": string,
"week_start": number
            }
                          SetofOptions: {
        from: "*"
        to: "habits"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_habit_mute":
{ Args: { "p_habit_id": string,"p_muted": boolean }; Returns: undefined
                           },
"set_habit_reminder":
{ Args: { "p_habit_id": string,"p_mode": string,"p_remind_at"?: string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_group_id": string,"p_role": string,"p_user_id": string }; Returns: undefined
                           },
"set_notification_delivery":
{ Args: { "p_category": string,"p_delivery": string }; Returns: undefined
                           },
"set_notification_pref":
{ Args: { "p_category": string,"p_enabled": boolean }; Returns: undefined
                           },
"set_treat_goal":
{ Args: { "p_child_id": string,"p_emoji": string,"p_target": number,"p_title": string }; Returns: {
              "child_id": string,
"created_at": string,
"created_by": string | null,
"emoji": string,
"id": string,
"reached_at": string | null,
"received_at": string | null,
"target": number,
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "treat_goals"
        isOneToOne: true
        isSetofReturn: false
      } },
"undo_check_in":
{ Args: { "p_check_in_id": string }; Returns: undefined
                           },
"undo_check_in_by_client":
{ Args: { "p_client_id": string }; Returns: boolean
                           },
"unfreeze_habit":
{ Args: { "p_habit_id": string }; Returns: undefined
                           },
"unfreeze_member":
{ Args: { "p_habit_id": string,"p_profile_id"?: string }; Returns: undefined
                           },
"update_child":
{ Args: { "p_avatar_color"?: string,"p_avatar_emoji"?: string,"p_child_id": string,"p_name"?: string }; Returns: undefined
                           },
"update_group":
{ Args: { "p_group_id": string,"p_kind"?: string,"p_name"?: string,"p_timezone"?: string,"p_week_start"?: number }; Returns: {
              "avatar_color": string | null,
"avatar_emoji": string | null,
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

