
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
            "audit_log": {
                  Row: {
                    "action": string,"actor_name": string | null,"changed_at": string,"changed_by": string | null,"entity_id": string,"entity_type": string,"field_name": string,"id": number,"new_value": string | null,"old_value": string | null,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action"?: string,"actor_name"?: string | null,"changed_at"?: string,"changed_by"?: string | null,"entity_id": string,"entity_type": string,"field_name": string,"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"organization_id": string
                  }
                  Update: {
                    "action"?: string,"actor_name"?: string | null,"changed_at"?: string,"changed_by"?: string | null,"entity_id"?: string,"entity_type"?: string,"field_name"?: string,"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"hospital_inputs": {
                  Row: {
                    "category": string,"data_owner": string | null,"id": string,"key": string,"label": string,"note": string | null,"numeric_value": number | null,"organization_id": string,"source_type": Database["public"]['Enums']["input_source_type"],"text_value": string | null,"unit": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"data_owner"?: string | null,"id"?: string,"key": string,"label": string,"note"?: string | null,"numeric_value"?: number | null,"organization_id": string,"source_type": Database["public"]['Enums']["input_source_type"],"text_value"?: string | null,"unit": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"data_owner"?: string | null,"id"?: string,"key"?: string,"label"?: string,"note"?: string | null,"numeric_value"?: number | null,"organization_id"?: string,"source_type"?: Database["public"]['Enums']["input_source_type"],"text_value"?: string | null,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "hospital_inputs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"created_at": string,"full_name": string,"id": string,"organization_id": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"full_name": string,"id"?: string,"organization_id": string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"full_name"?: string,"id"?: string,"organization_id"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"scenario_assumptions": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"approved_snapshot": Json | null,"created_at": string,"created_by": string | null,"high_savings_pct": number,"id": string,"is_default": boolean,"low_savings_pct": number,"mid_savings_pct": number,"occupancy_rate": number,"organization_id": string,"package_price": number,"savings_level": Database["public"]['Enums']["savings_level"],"scenario_name": string,"status": Database["public"]['Enums']["scenario_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"approved_snapshot"?: Json | null,"created_at"?: string,"created_by"?: string | null,"high_savings_pct"?: number,"id"?: string,"is_default"?: boolean,"low_savings_pct"?: number,"mid_savings_pct"?: number,"occupancy_rate": number,"organization_id": string,"package_price": number,"savings_level"?: Database["public"]['Enums']["savings_level"],"scenario_name": string,"status"?: Database["public"]['Enums']["scenario_status"],"updated_at"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"approved_snapshot"?: Json | null,"created_at"?: string,"created_by"?: string | null,"high_savings_pct"?: number,"id"?: string,"is_default"?: boolean,"low_savings_pct"?: number,"mid_savings_pct"?: number,"occupancy_rate"?: number,"organization_id"?: string,"package_price"?: number,"savings_level"?: Database["public"]['Enums']["savings_level"],"scenario_name"?: string,"status"?: Database["public"]['Enums']["scenario_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scenario_assumptions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "set_default_scenario":
{ Args: { "scenario_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "admin"|"manager"|"viewer"|"referring_physician"|"patient","input_source_type": "hospital_data"|"verified_public"|"rg_assumption","savings_level": "low"|"mid"|"high","scenario_status": "draft"|"approved"|"archived"
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
            "app_role": ["admin", "manager", "viewer", "referring_physician", "patient"],"input_source_type": ["hospital_data", "verified_public", "rg_assumption"],"savings_level": ["low", "mid", "high"],"scenario_status": ["draft", "approved", "archived"]
          }
        }
} as const
