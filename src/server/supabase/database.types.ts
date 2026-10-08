
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
                    "action": string,"actor_name": string | null,"changed_at": string,"changed_by": string | null,"entity_id": string,"entity_label": string | null,"entity_type": string,"field_name": string,"hospital_id": string | null,"id": number,"new_value": string | null,"old_value": string | null,"organization_id": string,"period_id": string | null,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action"?: string,"actor_name"?: string | null,"changed_at"?: string,"changed_by"?: string | null,"entity_id": string,"entity_label"?: string | null,"entity_type": string,"field_name": string,"hospital_id"?: string | null,"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"organization_id": string,"period_id"?: string | null,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_name"?: string | null,"changed_at"?: string,"changed_by"?: string | null,"entity_id"?: string,"entity_label"?: string | null,"entity_type"?: string,"field_name"?: string,"hospital_id"?: string | null,"id"?: never,"new_value"?: string | null,"old_value"?: string | null,"organization_id"?: string,"period_id"?: string | null,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"cost_items": {
                  Row: {
                    "active": boolean,"basis": string,"category": string,"created_at": string,"created_by": string | null,"department_id": string | null,"ended_from": string | null,"equipment_id": string | null,"hospital_id": string,"hospital_service_id": string | null,"id": string,"is_rt_staff": boolean,"name": string,"notes": string | null,"unit_label": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"basis": string,"category": string,"created_at"?: string,"created_by"?: string | null,"department_id"?: string | null,"ended_from"?: string | null,"equipment_id"?: string | null,"hospital_id": string,"hospital_service_id"?: string | null,"id"?: string,"is_rt_staff"?: boolean,"name": string,"notes"?: string | null,"unit_label"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"basis"?: string,"category"?: string,"created_at"?: string,"created_by"?: string | null,"department_id"?: string | null,"ended_from"?: string | null,"equipment_id"?: string | null,"hospital_id"?: string,"hospital_service_id"?: string | null,"id"?: string,"is_rt_staff"?: boolean,"name"?: string,"notes"?: string | null,"unit_label"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cost_items_hospital_id_department_id_fkey"
      columns: ["hospital_id","department_id"]
isOneToOne: false
      referencedRelation: "hospital_departments"
      referencedColumns: ["hospital_id","id"]
    },{
      foreignKeyName: "cost_items_hospital_id_equipment_id_fkey"
      columns: ["hospital_id","equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["hospital_id","id"]
    },{
      foreignKeyName: "cost_items_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cost_items_hospital_id_hospital_service_id_fkey"
      columns: ["hospital_id","hospital_service_id"]
isOneToOne: false
      referencedRelation: "hospital_services"
      referencedColumns: ["hospital_id","id"]
    }
                  ]
                },"cost_versions": {
                  Row: {
                    "amount": number,"change_reason": string | null,"cost_item_id": string,"created_at": string,"created_by": string | null,"effective_from": string,"hospital_id": string,"id": string,"notes": string | null,"void_reason": string | null,"voided": boolean,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"change_reason"?: string | null,"cost_item_id": string,"created_at"?: string,"created_by"?: string | null,"effective_from": string,"hospital_id": string,"id"?: string,"notes"?: string | null,"void_reason"?: string | null,"voided"?: boolean,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"change_reason"?: string | null,"cost_item_id"?: string,"created_at"?: string,"created_by"?: string | null,"effective_from"?: string,"hospital_id"?: string,"id"?: string,"notes"?: string | null,"void_reason"?: string | null,"voided"?: boolean,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cost_versions_hospital_id_cost_item_id_fkey"
      columns: ["hospital_id","cost_item_id"]
isOneToOne: false
      referencedRelation: "cost_items"
      referencedColumns: ["hospital_id","id"]
    }
                  ]
                },"equipment": {
                  Row: {
                    "acquired_on": string | null,"active": boolean,"category": string,"created_at": string,"created_by": string | null,"department_id": string | null,"hospital_id": string,"id": string,"name": string,"notes": string | null,"ownership": string,"quantity": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acquired_on"?: string | null,"active"?: boolean,"category"?: string,"created_at"?: string,"created_by"?: string | null,"department_id"?: string | null,"hospital_id": string,"id"?: string,"name": string,"notes"?: string | null,"ownership"?: string,"quantity"?: number,"updated_at"?: string
                  }
                  Update: {
                    "acquired_on"?: string | null,"active"?: boolean,"category"?: string,"created_at"?: string,"created_by"?: string | null,"department_id"?: string | null,"hospital_id"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"ownership"?: string,"quantity"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_hospital_id_department_id_fkey"
      columns: ["hospital_id","department_id"]
isOneToOne: false
      referencedRelation: "hospital_departments"
      referencedColumns: ["hospital_id","id"]
    },{
      foreignKeyName: "equipment_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["id"]
    }
                  ]
                },"hospital_departments": {
                  Row: {
                    "active": boolean,"beds": number | null,"category": string,"created_at": string,"created_by": string | null,"hospital_id": string,"id": string,"name": string,"notes": string | null,"rt_coverage": boolean,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"beds"?: number | null,"category"?: string,"created_at"?: string,"created_by"?: string | null,"hospital_id": string,"id"?: string,"name": string,"notes"?: string | null,"rt_coverage"?: boolean,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"beds"?: number | null,"category"?: string,"created_at"?: string,"created_by"?: string | null,"hospital_id"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"rt_coverage"?: boolean,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hospital_departments_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["id"]
    }
                  ]
                },"hospital_inputs": {
                  Row: {
                    "category": string,"data_owner": string | null,"hospital_id": string,"id": string,"key": string,"label": string,"note": string | null,"numeric_value": number | null,"organization_id": string,"source_type": Database["public"]['Enums']["input_source_type"],"text_value": string | null,"unit": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"data_owner"?: string | null,"hospital_id": string,"id"?: string,"key": string,"label": string,"note"?: string | null,"numeric_value"?: number | null,"organization_id": string,"source_type": Database["public"]['Enums']["input_source_type"],"text_value"?: string | null,"unit": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"data_owner"?: string | null,"hospital_id"?: string,"id"?: string,"key"?: string,"label"?: string,"note"?: string | null,"numeric_value"?: number | null,"organization_id"?: string,"source_type"?: Database["public"]['Enums']["input_source_type"],"text_value"?: string | null,"unit"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "hospital_inputs_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hospital_inputs_hospital_org_fkey"
      columns: ["organization_id","hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "hospital_inputs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"hospital_members": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"hospital_id": string,"id": string,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"hospital_id": string,"id"?: string,"role": Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"hospital_id"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hospital_members_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["id"]
    }
                  ]
                },"hospital_service_departments": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"department_id": string,"hospital_id": string,"hospital_service_id": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"department_id": string,"hospital_id": string,"hospital_service_id": string,"id"?: string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"department_id"?: string,"hospital_id"?: string,"hospital_service_id"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hospital_service_departments_hospital_id_department_id_fkey"
      columns: ["hospital_id","department_id"]
isOneToOne: false
      referencedRelation: "hospital_departments"
      referencedColumns: ["hospital_id","id"]
    },{
      foreignKeyName: "hospital_service_departments_hospital_id_hospital_service__fkey"
      columns: ["hospital_id","hospital_service_id"]
isOneToOne: false
      referencedRelation: "hospital_services"
      referencedColumns: ["hospital_id","id"]
    }
                  ]
                },"hospital_services": {
                  Row: {
                    "active": boolean,"created_at": string,"created_by": string | null,"hospital_id": string,"id": string,"notes": string | null,"organization_id": string,"service_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"hospital_id": string,"id"?: string,"notes"?: string | null,"organization_id": string,"service_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"created_by"?: string | null,"hospital_id"?: string,"id"?: string,"notes"?: string | null,"organization_id"?: string,"service_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hospital_services_organization_id_hospital_id_fkey"
      columns: ["organization_id","hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "hospital_services_organization_id_service_id_fkey"
      columns: ["organization_id","service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"hospitals": {
                  Row: {
                    "active": boolean,"code": string,"created_at": string,"created_by": string | null,"currency": string,"hospital_type": string | null,"id": string,"location": string | null,"name": string,"notes": string | null,"organization_id": string,"total_beds": number | null,"updated_at": string,"workbook_model_enabled": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"hospital_type"?: string | null,"id"?: string,"location"?: string | null,"name": string,"notes"?: string | null,"organization_id": string,"total_beds"?: number | null,"updated_at"?: string,"workbook_model_enabled"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"hospital_type"?: string | null,"id"?: string,"location"?: string | null,"name"?: string,"notes"?: string | null,"organization_id"?: string,"total_beds"?: number | null,"updated_at"?: string,"workbook_model_enabled"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "hospitals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"operating_periods": {
                  Row: {
                    "created_at": string,"created_by": string | null,"finalized_at": string | null,"finalized_by": string | null,"finalized_snapshot": Json | null,"hospital_id": string,"id": string,"locked_at": string | null,"locked_by": string | null,"notes": string | null,"period_month": string,"status": Database["public"]['Enums']["period_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"finalized_at"?: string | null,"finalized_by"?: string | null,"finalized_snapshot"?: Json | null,"hospital_id": string,"id"?: string,"locked_at"?: string | null,"locked_by"?: string | null,"notes"?: string | null,"period_month": string,"status"?: Database["public"]['Enums']["period_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"finalized_at"?: string | null,"finalized_by"?: string | null,"finalized_snapshot"?: Json | null,"hospital_id"?: string,"id"?: string,"locked_at"?: string | null,"locked_by"?: string | null,"notes"?: string | null,"period_month"?: string,"status"?: Database["public"]['Enums']["period_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operating_periods_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
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
                },"period_cost_entries": {
                  Row: {
                    "change_reason": string | null,"cost_item_id": string,"hospital_id": string,"id": string,"notes": string | null,"period_id": string,"quantity": number | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "change_reason"?: string | null,"cost_item_id": string,"hospital_id": string,"id"?: string,"notes"?: string | null,"period_id": string,"quantity"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "change_reason"?: string | null,"cost_item_id"?: string,"hospital_id"?: string,"id"?: string,"notes"?: string | null,"period_id"?: string,"quantity"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "period_cost_entries_hospital_id_cost_item_id_fkey"
      columns: ["hospital_id","cost_item_id"]
isOneToOne: false
      referencedRelation: "cost_items"
      referencedColumns: ["hospital_id","id"]
    },{
      foreignKeyName: "period_cost_entries_hospital_id_period_id_fkey"
      columns: ["hospital_id","period_id"]
isOneToOne: false
      referencedRelation: "operating_periods"
      referencedColumns: ["hospital_id","id"]
    }
                  ]
                },"period_savings": {
                  Row: {
                    "amount": number,"category": string,"change_reason": string | null,"created_at": string,"description": string,"hospital_id": string,"id": string,"period_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": string,"change_reason"?: string | null,"created_at"?: string,"description": string,"hospital_id": string,"id"?: string,"period_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"change_reason"?: string | null,"created_at"?: string,"description"?: string,"hospital_id"?: string,"id"?: string,"period_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "period_savings_hospital_id_period_id_fkey"
      columns: ["hospital_id","period_id"]
isOneToOne: false
      referencedRelation: "operating_periods"
      referencedColumns: ["hospital_id","id"]
    }
                  ]
                },"period_stats": {
                  Row: {
                    "admissions": number | null,"change_reason": string | null,"department_id": string | null,"hospital_id": string,"id": string,"occupied_bed_days": number | null,"patients": number | null,"period_id": string,"updated_at": string,"updated_by": string | null,"ventilator_days": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admissions"?: number | null,"change_reason"?: string | null,"department_id"?: string | null,"hospital_id": string,"id"?: string,"occupied_bed_days"?: number | null,"patients"?: number | null,"period_id": string,"updated_at"?: string,"updated_by"?: string | null,"ventilator_days"?: number | null
                  }
                  Update: {
                    "admissions"?: number | null,"change_reason"?: string | null,"department_id"?: string | null,"hospital_id"?: string,"id"?: string,"occupied_bed_days"?: number | null,"patients"?: number | null,"period_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"ventilator_days"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "period_stats_hospital_id_department_id_fkey"
      columns: ["hospital_id","department_id"]
isOneToOne: false
      referencedRelation: "hospital_departments"
      referencedColumns: ["hospital_id","id"]
    },{
      foreignKeyName: "period_stats_hospital_id_period_id_fkey"
      columns: ["hospital_id","period_id"]
isOneToOne: false
      referencedRelation: "operating_periods"
      referencedColumns: ["hospital_id","id"]
    }
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
                    "approved_at": string | null,"approved_by": string | null,"approved_snapshot": Json | null,"created_at": string,"created_by": string | null,"high_savings_pct": number,"hospital_id": string,"id": string,"is_default": boolean,"low_savings_pct": number,"mid_savings_pct": number,"occupancy_rate": number,"organization_id": string,"package_price": number,"savings_level": Database["public"]['Enums']["savings_level"],"scenario_name": string,"status": Database["public"]['Enums']["scenario_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"approved_snapshot"?: Json | null,"created_at"?: string,"created_by"?: string | null,"high_savings_pct"?: number,"hospital_id": string,"id"?: string,"is_default"?: boolean,"low_savings_pct"?: number,"mid_savings_pct"?: number,"occupancy_rate": number,"organization_id": string,"package_price": number,"savings_level"?: Database["public"]['Enums']["savings_level"],"scenario_name": string,"status"?: Database["public"]['Enums']["scenario_status"],"updated_at"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"approved_snapshot"?: Json | null,"created_at"?: string,"created_by"?: string | null,"high_savings_pct"?: number,"hospital_id"?: string,"id"?: string,"is_default"?: boolean,"low_savings_pct"?: number,"mid_savings_pct"?: number,"occupancy_rate"?: number,"organization_id"?: string,"package_price"?: number,"savings_level"?: Database["public"]['Enums']["savings_level"],"scenario_name"?: string,"status"?: Database["public"]['Enums']["scenario_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scenario_assumptions_hospital_id_fkey"
      columns: ["hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scenario_assumptions_hospital_org_fkey"
      columns: ["organization_id","hospital_id"]
isOneToOne: false
      referencedRelation: "hospitals"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "scenario_assumptions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"service_activity": {
                  Row: {
                    "change_reason": string | null,"department_id": string | null,"hospital_id": string,"hospital_service_id": string,"id": string,"notes": string | null,"period_id": string,"quantity": number | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "change_reason"?: string | null,"department_id"?: string | null,"hospital_id": string,"hospital_service_id": string,"id"?: string,"notes"?: string | null,"period_id": string,"quantity"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "change_reason"?: string | null,"department_id"?: string | null,"hospital_id"?: string,"hospital_service_id"?: string,"id"?: string,"notes"?: string | null,"period_id"?: string,"quantity"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_activity_hospital_id_department_id_fkey"
      columns: ["hospital_id","department_id"]
isOneToOne: false
      referencedRelation: "hospital_departments"
      referencedColumns: ["hospital_id","id"]
    },{
      foreignKeyName: "service_activity_hospital_id_hospital_service_id_fkey"
      columns: ["hospital_id","hospital_service_id"]
isOneToOne: false
      referencedRelation: "hospital_services"
      referencedColumns: ["hospital_id","id"]
    },{
      foreignKeyName: "service_activity_hospital_id_period_id_fkey"
      columns: ["hospital_id","period_id"]
isOneToOne: false
      referencedRelation: "operating_periods"
      referencedColumns: ["hospital_id","id"]
    }
                  ]
                },"service_price_versions": {
                  Row: {
                    "amount": number,"billing_unit": Database["public"]['Enums']["billing_unit"],"change_reason": string | null,"created_at": string,"created_by": string | null,"currency": string,"effective_from": string,"hospital_id": string,"hospital_service_id": string,"id": string,"notes": string | null,"void_reason": string | null,"voided": boolean,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"billing_unit": Database["public"]['Enums']["billing_unit"],"change_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"effective_from": string,"hospital_id": string,"hospital_service_id": string,"id"?: string,"notes"?: string | null,"void_reason"?: string | null,"voided"?: boolean,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"billing_unit"?: Database["public"]['Enums']["billing_unit"],"change_reason"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"effective_from"?: string,"hospital_id"?: string,"hospital_service_id"?: string,"id"?: string,"notes"?: string | null,"void_reason"?: string | null,"voided"?: boolean,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_price_versions_hospital_id_hospital_service_id_fkey"
      columns: ["hospital_id","hospital_service_id"]
isOneToOne: false
      referencedRelation: "hospital_services"
      referencedColumns: ["hospital_id","id"]
    }
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"category": string,"code": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string,"organization_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category"?: string,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"category"?: string,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"workbook_input_templates": {
                  Row: {
                    "category": string,"data_owner": string | null,"default_value": number | null,"key": string,"label": string,"note": string | null,"sort_order": number,"source_type": Database["public"]['Enums']["input_source_type"],"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"data_owner"?: string | null,"default_value"?: number | null,"key": string,"label": string,"note"?: string | null,"sort_order": number,"source_type": Database["public"]['Enums']["input_source_type"],"unit": string
                  }
                  Update: {
                    "category"?: string,"data_owner"?: string | null,"default_value"?: number | null,"key"?: string,"label"?: string,"note"?: string | null,"sort_order"?: number,"source_type"?: Database["public"]['Enums']["input_source_type"],"unit"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "service_price_timeline": {
                  Row: {
                    "amount": number | null,"billing_unit": Database["public"]['Enums']["billing_unit"] | null,"change_reason": string | null,"created_at": string | null,"created_by": string | null,"currency": string | null,"effective_from": string | null,"effective_to": string | null,"hospital_id": string | null,"hospital_service_id": string | null,"id": string | null,"notes": string | null,"void_reason": string | null,"voided": boolean | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_price_versions_hospital_id_hospital_service_id_fkey"
      columns: ["hospital_id","hospital_service_id"]
isOneToOne: false
      referencedRelation: "hospital_services"
      referencedColumns: ["hospital_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "enable_workbook_model":
{ Args: { "p_hospital": string }; Returns: undefined
                           },
"set_default_scenario":
{ Args: { "scenario_id": string }; Returns: undefined
                           },
"set_period_status":
{ Args: { "p_period": string,"p_reason"?: string,"p_snapshot"?: Json,"p_status": Database["public"]['Enums']["period_status"] }; Returns: undefined
                           }
          }
          Enums: {
            "app_role": "admin"|"manager"|"viewer"|"referring_physician"|"patient","billing_unit": "per_procedure"|"per_patient"|"per_session"|"per_day"|"per_ventilator_day"|"per_hour"|"per_case"|"monthly_package"|"fixed_contract"|"percentage"|"custom","input_source_type": "hospital_data"|"verified_public"|"rg_assumption","period_status": "draft"|"in_review"|"finalized"|"locked","savings_level": "low"|"mid"|"high","scenario_status": "draft"|"approved"|"archived"
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
            "app_role": ["admin", "manager", "viewer", "referring_physician", "patient"],"billing_unit": ["per_procedure", "per_patient", "per_session", "per_day", "per_ventilator_day", "per_hour", "per_case", "monthly_package", "fixed_contract", "percentage", "custom"],"input_source_type": ["hospital_data", "verified_public", "rg_assumption"],"period_status": ["draft", "in_review", "finalized", "locked"],"savings_level": ["low", "mid", "high"],"scenario_status": ["draft", "approved", "archived"]
          }
        }
} as const
