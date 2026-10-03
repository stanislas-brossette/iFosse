
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "audit_events": {
                  Row: {
                    "actor_member_id": string | null,"created_at": string,"event_type": string,"id": string,"payload": NonNullable<Json>,"session_id": string | null,"target_member_id": string | null
                  }
                  Insert: {
                    "actor_member_id"?: string | null,"created_at"?: string,"event_type": string,"id"?: string,"payload"?: NonNullable<Json>,"session_id"?: string | null,"target_member_id"?: string | null
                  }
                  Update: {
                    "actor_member_id"?: string | null,"created_at"?: string,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>,"session_id"?: string | null,"target_member_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_actor_member_id_fkey"
      columns: ["actor_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_target_member_id_fkey"
      columns: ["target_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_session_fk"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"car_offers": {
                  Row: {
                    "created_at": string,"departure_time": string | null,"driver_member_id": string,"id": string,"meeting_point": string,"note": string,"passenger_capacity": number,"session_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"departure_time"?: string | null,"driver_member_id": string,"id"?: string,"meeting_point"?: string,"note"?: string,"passenger_capacity": number,"session_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"departure_time"?: string | null,"driver_member_id"?: string,"id"?: string,"meeting_point"?: string,"note"?: string,"passenger_capacity"?: number,"session_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "car_offers_driver_member_id_fkey"
      columns: ["driver_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "car_offers_session_id_driver_member_id_fkey"
      columns: ["session_id","driver_member_id"]
isOneToOne: true
      referencedRelation: "session_participations"
      referencedColumns: ["session_id","member_id"]
    },{
      foreignKeyName: "car_offers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"car_passengers": {
                  Row: {
                    "car_offer_id": string,"joined_at": string,"member_id": string,"session_id": string
                  }
                  Insert: {
                    "car_offer_id": string,"joined_at"?: string,"member_id": string,"session_id": string
                  }
                  Update: {
                    "car_offer_id"?: string,"joined_at"?: string,"member_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "car_passengers_car_offer_id_session_id_fkey"
      columns: ["car_offer_id","session_id"]
isOneToOne: false
      referencedRelation: "car_offers"
      referencedColumns: ["id","session_id"]
    },{
      foreignKeyName: "car_passengers_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "car_passengers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "car_passengers_session_id_member_id_fkey"
      columns: ["session_id","member_id"]
isOneToOne: true
      referencedRelation: "session_participations"
      referencedColumns: ["session_id","member_id"]
    }
                  ]
                },"members": {
                  Row: {
                    "auth_user_id": string | null,"caci_expiry_date": string | null,"created_at": string,"current_level": string,"email": string,"first_name": string,"has_usual_car": boolean,"id": string,"last_name": string,"phone": string | null,"preparing_level": string | null,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"usual_meeting_point": string,"usual_passenger_seats": number
                  }
                  Insert: {
                    "auth_user_id"?: string | null,"caci_expiry_date"?: string | null,"created_at"?: string,"current_level"?: string,"email": string,"first_name": string,"has_usual_car"?: boolean,"id"?: string,"last_name": string,"phone"?: string | null,"preparing_level"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"usual_meeting_point"?: string,"usual_passenger_seats"?: number
                  }
                  Update: {
                    "auth_user_id"?: string | null,"caci_expiry_date"?: string | null,"created_at"?: string,"current_level"?: string,"email"?: string,"first_name"?: string,"has_usual_car"?: boolean,"id"?: string,"last_name"?: string,"phone"?: string | null,"preparing_level"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"usual_meeting_point"?: string,"usual_passenger_seats"?: number
                  }
                  Relationships: [

                  ]
                },"palanquee_draft": {
                  Row: {
                    "group_number": number,"is_leader": boolean,"member_id": string,"session_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "group_number": number,"is_leader"?: boolean,"member_id": string,"session_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "group_number"?: number,"is_leader"?: boolean,"member_id"?: string,"session_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "palanquee_draft_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "palanquee_draft_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "palanquee_drafts"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "palanquee_draft_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"palanquee_drafts": {
                  Row: {
                    "selection_publication_id": string,"session_id": string
                  }
                  Insert: {
                    "selection_publication_id": string,"session_id": string
                  }
                  Update: {
                    "selection_publication_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "palanquee_drafts_selection_publication_id_session_id_fkey"
      columns: ["selection_publication_id","session_id"]
isOneToOne: false
      referencedRelation: "selection_publications"
      referencedColumns: ["id","session_id"]
    },{
      foreignKeyName: "palanquee_drafts_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"palanquee_publication_members": {
                  Row: {
                    "group_number": number,"is_leader": boolean,"member_id": string,"publication_id": string
                  }
                  Insert: {
                    "group_number": number,"is_leader": boolean,"member_id": string,"publication_id": string
                  }
                  Update: {
                    "group_number"?: number,"is_leader"?: boolean,"member_id"?: string,"publication_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "palanquee_publication_members_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "palanquee_publication_members_publication_id_fkey"
      columns: ["publication_id"]
isOneToOne: false
      referencedRelation: "palanquee_publications"
      referencedColumns: ["id"]
    }
                  ]
                },"palanquee_publications": {
                  Row: {
                    "id": string,"published_at": string,"published_by": string | null,"selection_publication_id": string,"session_id": string,"version": number
                  }
                  Insert: {
                    "id"?: string,"published_at"?: string,"published_by"?: string | null,"selection_publication_id": string,"session_id": string,"version": number
                  }
                  Update: {
                    "id"?: string,"published_at"?: string,"published_by"?: string | null,"selection_publication_id"?: string,"session_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "palanquee_publications_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "palanquee_publications_selection_publication_id_session_id_fkey"
      columns: ["selection_publication_id","session_id"]
isOneToOne: false
      referencedRelation: "selection_publications"
      referencedColumns: ["id","session_id"]
    },{
      foreignKeyName: "palanquee_publications_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"selection_draft": {
                  Row: {
                    "member_id": string,"session_id": string,"state": Database["public"]['Enums']["selection_state"],"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "member_id": string,"session_id": string,"state"?: Database["public"]['Enums']["selection_state"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "member_id"?: string,"session_id"?: string,"state"?: Database["public"]['Enums']["selection_state"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "selection_draft_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "selection_draft_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "selection_drafts"
      referencedColumns: ["session_id"]
    },{
      foreignKeyName: "selection_draft_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"selection_drafts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"session_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"session_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "selection_drafts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "selection_drafts_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"selection_publication_members": {
                  Row: {
                    "member_id": string,"publication_id": string,"rsvp_revision": number,"state": Database["public"]['Enums']["selection_state"]
                  }
                  Insert: {
                    "member_id": string,"publication_id": string,"rsvp_revision": number,"state": Database["public"]['Enums']["selection_state"]
                  }
                  Update: {
                    "member_id"?: string,"publication_id"?: string,"rsvp_revision"?: number,"state"?: Database["public"]['Enums']["selection_state"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "selection_publication_members_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "selection_publication_members_publication_id_fkey"
      columns: ["publication_id"]
isOneToOne: false
      referencedRelation: "selection_publications"
      referencedColumns: ["id"]
    }
                  ]
                },"selection_publications": {
                  Row: {
                    "id": string,"published_at": string,"published_by": string | null,"session_id": string,"version": number
                  }
                  Insert: {
                    "id"?: string,"published_at"?: string,"published_by"?: string | null,"session_id": string,"version": number
                  }
                  Update: {
                    "id"?: string,"published_at"?: string,"published_by"?: string | null,"session_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "selection_publications_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "selection_publications_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"session_participations": {
                  Row: {
                    "attendance_status": Database["public"]['Enums']["attendance_state"],"member_id": string,"payment_status": Database["public"]['Enums']["payment_state"],"rsvp": Database["public"]['Enums']["rsvp_state"],"rsvp_revision": number,"session_id": string,"transport_mode": Database["public"]['Enums']["transport_state"],"updated_at": string
                  }
                  Insert: {
                    "attendance_status"?: Database["public"]['Enums']["attendance_state"],"member_id": string,"payment_status"?: Database["public"]['Enums']["payment_state"],"rsvp"?: Database["public"]['Enums']["rsvp_state"],"rsvp_revision"?: number,"session_id": string,"transport_mode"?: Database["public"]['Enums']["transport_state"],"updated_at"?: string
                  }
                  Update: {
                    "attendance_status"?: Database["public"]['Enums']["attendance_state"],"member_id"?: string,"payment_status"?: Database["public"]['Enums']["payment_state"],"rsvp"?: Database["public"]['Enums']["rsvp_state"],"rsvp_revision"?: number,"session_id"?: string,"transport_mode"?: Database["public"]['Enums']["transport_state"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_participations_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_participations_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "address": string,"capacity": number,"created_at": string,"created_by": string | null,"date": string,"end_time": string,"end_time_estimated": boolean,"id": string,"import_source_hash": string | null,"import_source_key": string | null,"notes": string,"registration_open": boolean,"school_holiday": boolean,"start_time": string,"status": Database["public"]['Enums']["session_status"],"title": string,"updated_at": string,"venue": string
                  }
                  Insert: {
                    "address"?: string,"capacity"?: number,"created_at"?: string,"created_by"?: string | null,"date": string,"end_time": string,"end_time_estimated"?: boolean,"id"?: string,"import_source_hash"?: string | null,"import_source_key"?: string | null,"notes"?: string,"registration_open"?: boolean,"school_holiday"?: boolean,"start_time": string,"status"?: Database["public"]['Enums']["session_status"],"title"?: string,"updated_at"?: string,"venue"?: string
                  }
                  Update: {
                    "address"?: string,"capacity"?: number,"created_at"?: string,"created_by"?: string | null,"date"?: string,"end_time"?: string,"end_time_estimated"?: boolean,"id"?: string,"import_source_hash"?: string | null,"import_source_key"?: string | null,"notes"?: string,"registration_open"?: boolean,"school_holiday"?: boolean,"start_time"?: string,"status"?: Database["public"]['Enums']["session_status"],"title"?: string,"updated_at"?: string,"venue"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "bootstrap_president":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"close_session_bilan":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"current_member_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_member_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["member_role"]
                           },
"current_selected_ids":
{ Args: { "p_session_id": string }; Returns: {
              "member_id": string
            }[]
                           },
"delete_session":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"discard_palanquee_draft":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"discard_selection_draft":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"ensure_palanquee_draft":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"ensure_selection_draft":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"get_admin_readiness":
{ Args: { "p_session_id": string }; Returns: {
              "caci_ready": boolean,"caci_status": string,"member_id": string,"payment_ready": boolean,"payment_status": Database["public"]['Enums']["payment_state"],"selection_ready": boolean,"selection_state": string,"transport_mode": Database["public"]['Enums']["transport_state"],"transport_ready": boolean
            }[]
                           },
"get_bilan_state":
{ Args: { "p_session_id": string }; Returns: {
              "dived_count": number,"session_ended": boolean,"unknown_selected_count": number
            }[]
                           },
"get_car_offers":
{ Args: { "p_session_id": string }; Returns: {
              "departure_time": string,"driver_member_id": string,"first_name": string,"id": string,"last_name": string,"meeting_point": string,"note": string,"occupied": number,"passenger_capacity": number
            }[]
                           },
"get_current_palanquees":
{ Args: { "p_session_id": string }; Returns: {
              "current_level": string,"first_name": string,"group_number": number,"is_leader": boolean,"last_name": string,"member_id": string,"needs_review": boolean,"preparing_level": string,"publication_id": string,"publication_version": number,"selection_publication_id": string,"selection_version": number
            }[]
                           },
"get_current_selection":
{ Args: { "p_session_id": string }; Returns: {
              "current_level": string,"first_name": string,"last_name": string,"member_id": string,"preparing_level": string,"publication_id": string,"publication_version": number,"rsvp": Database["public"]['Enums']["rsvp_state"],"state": string
            }[]
                           },
"get_palanquee_state":
{ Args: { "p_session_id": string }; Returns: {
              "needs_review": boolean,"publication_id": string,"publication_version": number,"selection_publication_id": string,"selection_version": number
            }[]
                           },
"get_season_counts":
{ Args: { "p_start_year": number }; Returns: {
              "completed_count": number,"first_name": string,"last_name": string,"member_id": string
            }[]
                           },
"get_session_attendance":
{ Args: { "p_session_id": string }; Returns: {
              "attendance_status": Database["public"]['Enums']["attendance_state"],"first_name": string,"last_name": string,"member_id": string
            }[]
                           },
"get_session_responses":
{ Args: { "p_session_id": string }; Returns: {
              "current_level": string,"first_name": string,"last_name": string,"member_id": string,"preparing_level": string,"rsvp": Database["public"]['Enums']["rsvp_state"]
            }[]
                           },
"get_session_transport":
{ Args: { "p_session_id": string }; Returns: {
              "car_offer_id": string,"first_name": string,"last_name": string,"member_id": string,"mode": Database["public"]['Enums']["transport_state"]
            }[]
                           },
"import_season_calendar":
{ Args: { "p_sessions": Json }; Returns: {
              "created": boolean,"session_id": string,"source_key": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_president":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_car":
{ Args: { "p_car_offer_id": string,"p_session_id": string }; Returns: undefined
                           },
"lock_transport_session":
{ Args: { "p_session_id": string }; Returns: string
                           },
"offer_car":
{ Args: { "p_departure_time"?: string,"p_meeting_point": string,"p_note": string,"p_passenger_capacity": number,"p_session_id": string }; Returns: string
                           },
"provision_member":
{ Args: { "p_auth_user_id": string,"p_first_name": string,"p_last_name": string }; Returns: string
                           },
"publish_palanquees":
{ Args: { "p_session_id": string }; Returns: string
                           },
"publish_selection":
{ Args: { "p_session_id": string }; Returns: string
                           },
"recover_president":
{ Args: { "p_member_id": string,"p_reason": string }; Returns: undefined
                           },
"reopen_session_bilan":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"save_session":
{ Args: { "p_address": string,"p_capacity": number,"p_date": string,"p_end_time": string,"p_end_time_estimated": boolean,"p_id"?: string,"p_notes": string,"p_registration_open": boolean,"p_school_holiday": boolean,"p_start_time": string,"p_title": string,"p_venue": string }; Returns: string
                           },
"session_has_ended":
{ Args: { "p_date": string,"p_end_time": string }; Returns: boolean
                           },
"set_attendance":
{ Args: { "p_member_id": string,"p_session_id": string,"p_status": Database["public"]['Enums']["attendance_state"] }; Returns: undefined
                           },
"set_draft_palanquee":
{ Args: { "p_group_number"?: number,"p_is_leader"?: boolean,"p_member_id": string,"p_session_id": string }; Returns: undefined
                           },
"set_draft_selection":
{ Args: { "p_member_id": string,"p_session_id": string,"p_state": Database["public"]['Enums']["selection_state"] }; Returns: undefined
                           },
"set_member_caci":
{ Args: { "p_expiry_date"?: string,"p_member_id": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_member_id": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: undefined
                           },
"set_own_transport":
{ Args: { "p_mode": Database["public"]['Enums']["transport_state"],"p_session_id": string }; Returns: undefined
                           },
"set_payment_status":
{ Args: { "p_member_id": string,"p_session_id": string,"p_status": Database["public"]['Enums']["payment_state"] }; Returns: undefined
                           },
"set_session_rsvp":
{ Args: { "p_confirm_caci_warning"?: boolean,"p_member_id"?: string,"p_rsvp": Database["public"]['Enums']["rsvp_state"],"p_session_id": string }; Returns: undefined
                           },
"transfer_presidency":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"transport_eligible":
{ Args: { "p_member_id": string,"p_session_id": string }; Returns: boolean
                           },
"update_own_profile":
{ Args: { "p_current_level": string,"p_first_name": string,"p_has_usual_car": boolean,"p_last_name": string,"p_phone": string,"p_preparing_level": string,"p_usual_meeting_point": string,"p_usual_passenger_seats": number }; Returns: undefined
                           }
          }
          Enums: {
            "attendance_state": "unknown"|"dived"|"absent"|"not_dived","member_role": "member"|"admin"|"president","payment_state": "unpaid"|"paid"|"free","rsvp_state": "unanswered"|"yes"|"maybe"|"no","selection_state": "waiting"|"selected"|"declined","session_status": "open"|"closed","transport_state": "unset"|"needs"|"own"|"driver"|"passenger"
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
  "public": {
          Enums: {
            "attendance_state": ["unknown", "dived", "absent", "not_dived"],"member_role": ["member", "admin", "president"],"payment_state": ["unpaid", "paid", "free"],"rsvp_state": ["unanswered", "yes", "maybe", "no"],"selection_state": ["waiting", "selected", "declined"],"session_status": ["open", "closed"],"transport_state": ["unset", "needs", "own", "driver", "passenger"]
          }
        }
} as const
