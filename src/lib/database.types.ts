
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "bootstrap_president":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"current_member_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_member_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["member_role"]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_president":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"provision_member":
{ Args: { "p_auth_user_id": string,"p_first_name": string,"p_last_name": string }; Returns: string
                           },
"recover_president":
{ Args: { "p_member_id": string,"p_reason": string }; Returns: undefined
                           },
"set_member_caci":
{ Args: { "p_expiry_date"?: string,"p_member_id": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_member_id": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: undefined
                           },
"transfer_presidency":
{ Args: { "p_member_id": string }; Returns: undefined
                           },
"update_own_profile":
{ Args: { "p_current_level": string,"p_first_name": string,"p_has_usual_car": boolean,"p_last_name": string,"p_phone": string,"p_preparing_level": string,"p_usual_meeting_point": string,"p_usual_passenger_seats": number }; Returns: undefined
                           }
          }
          Enums: {
            "member_role": "member"|"admin"|"president"
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
            "member_role": ["member", "admin", "president"]
          }
        }
} as const
