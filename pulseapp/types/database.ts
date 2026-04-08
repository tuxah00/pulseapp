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
      appointments: {
        Row: {
          appointment_date: string
          business_id: string
          cancellation_reason: string | null
          created_at: string | null
          customer_id: string
          deleted_at: string | null
          end_time: string
          id: string
          manage_token: string | null
          notes: string | null
          recurrence_group_id: string | null
          recurrence_pattern: Json | null
          reminder_24h_sent: boolean | null
          reminder_2h_sent: boolean | null
          review_requested: boolean | null
          service_id: string | null
          source: Database["public"]["Enums"]["appointment_source"]
          staff_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_date: string
          business_id: string
          cancellation_reason?: string | null
          created_at?: string | null
          customer_id: string
          deleted_at?: string | null
          end_time: string
          id?: string
          manage_token?: string | null
          notes?: string | null
          recurrence_group_id?: string | null
          recurrence_pattern?: Json | null
          reminder_24h_sent?: boolean | null
          reminder_2h_sent?: boolean | null
          review_requested?: boolean | null
          service_id?: string | null
          source?: Database["public"]["Enums"]["appointment_source"]
          staff_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_date?: string
          business_id?: string
          cancellation_reason?: string | null
          created_at?: string | null
          customer_id?: string
          deleted_at?: string | null
          end_time?: string
          id?: string
          manage_token?: string | null
          notes?: string | null
          recurrence_group_id?: string | null
          recurrence_pattern?: Json | null
          reminder_24h_sent?: boolean | null
          reminder_2h_sent?: boolean | null
          review_requested?: boolean | null
          service_id?: string | null
          source?: Database["public"]["Enums"]["appointment_source"]
          staff_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          business_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource: string
          resource_id: string | null
          staff_id: string | null
          staff_name: string | null
        }
        Insert: {
          action: string
          business_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource: string
          resource_id?: string | null
          staff_id?: string | null
          staff_name?: string | null
        }
        Update: {
          action?: string
          business_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource?: string
          resource_id?: string | null
          staff_id?: string | null
          staff_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      business_records: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          data: Json
          file_urls: Json | null
          id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          data?: Json
          file_urls?: Json | null
          id?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          data?: Json
          file_urls?: Json | null
          id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          district: string | null
          email: string | null
          google_maps_url: string | null
          google_place_id: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          sector: Database["public"]["Enums"]["sector_type"]
          settings: Json | null
          subscription_plan: Database["public"]["Enums"]["plan_type"]
          subscription_status: Database["public"]["Enums"]["subscription_status_type"]
          trial_ends_at: string | null
          twilio_whatsapp_sid: string | null
          updated_at: string | null
          whatsapp_mode: string | null
          whatsapp_number: string | null
          working_hours: Json | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          district?: string | null
          email?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          sector?: Database["public"]["Enums"]["sector_type"]
          settings?: Json | null
          subscription_plan?: Database["public"]["Enums"]["plan_type"]
          subscription_status?: Database["public"]["Enums"]["subscription_status_type"]
          trial_ends_at?: string | null
          twilio_whatsapp_sid?: string | null
          updated_at?: string | null
          whatsapp_mode?: string | null
          whatsapp_number?: string | null
          working_hours?: Json | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          district?: string | null
          email?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          sector?: Database["public"]["Enums"]["sector_type"]
          settings?: Json | null
          subscription_plan?: Database["public"]["Enums"]["plan_type"]
          subscription_status?: Database["public"]["Enums"]["subscription_status_type"]
          trial_ends_at?: string | null
          twilio_whatsapp_sid?: string | null
          updated_at?: string | null
          whatsapp_mode?: string | null
          whatsapp_number?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      class_attendance: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          session_id: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          id: string
          notes: string | null
          session_date: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          notes?: string | null
          session_date: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          business_id: string
          capacity: number
          color: string
          created_at: string
          day_of_week: number[]
          duration_minutes: number
          id: string
          instructor_id: string | null
          is_active: boolean
          name: string
          start_time: string
        }
        Insert: {
          business_id: string
          capacity?: number
          color?: string
          created_at?: string
          day_of_week?: number[]
          duration_minutes?: number
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          name: string
          start_time: string
        }
        Update: {
          business_id?: string
          capacity?: number
          color?: string
          created_at?: string
          day_of_week?: number[]
          duration_minutes?: number
          id?: string
          instructor_id?: string | null
          is_active?: boolean
          name?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "classes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_allergies: {
        Row: {
          allergen: string
          business_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          reaction: string | null
          reported_at: string | null
          severity: string
        }
        Insert: {
          allergen: string
          business_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          reaction?: string | null
          reported_at?: string | null
          severity?: string
        }
        Update: {
          allergen?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          reaction?: string | null
          reported_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_allergies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "customer_allergies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_allergies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_allergies_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_packages: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          expiry_date: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          package_id: string | null
          package_name: string
          price_paid: number
          purchase_date: string
          service_id: string | null
          sessions_total: number
          sessions_used: number
          staff_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          expiry_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          package_id?: string | null
          package_name: string
          price_paid?: number
          purchase_date?: string
          service_id?: string | null
          sessions_total?: number
          sessions_used?: number
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          expiry_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          package_id?: string | null
          package_name?: string
          price_paid?: number
          purchase_date?: string
          service_id?: string | null
          sessions_total?: number
          sessions_used?: number
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_packages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "customer_packages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_photos: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          photo_type: string
          photo_url: string
          protocol_id: string | null
          session_id: string | null
          tags: string[] | null
          taken_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          photo_type: string
          photo_url: string
          protocol_id?: string | null
          session_id?: string | null
          tags?: string[] | null
          taken_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          photo_type?: string
          photo_url?: string
          protocol_id?: string | null
          session_id?: string | null
          tags?: string[] | null
          taken_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "customer_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_photos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_photos_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "treatment_protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_photos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "protocol_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birthday: string | null
          business_id: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          last_visit_at: string | null
          name: string
          notes: string | null
          phone: string
          preferences: Json | null
          segment: Database["public"]["Enums"]["customer_segment"]
          total_no_shows: number | null
          total_revenue: number | null
          total_visits: number | null
          updated_at: string | null
          whatsapp_opted_in: boolean | null
        }
        Insert: {
          birthday?: string | null
          business_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_visit_at?: string | null
          name: string
          notes?: string | null
          phone: string
          preferences?: Json | null
          segment?: Database["public"]["Enums"]["customer_segment"]
          total_no_shows?: number | null
          total_revenue?: number | null
          total_visits?: number | null
          updated_at?: string | null
          whatsapp_opted_in?: boolean | null
        }
        Update: {
          birthday?: string | null
          business_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_visit_at?: string | null
          name?: string
          notes?: string | null
          phone?: string
          preferences?: Json | null
          segment?: Database["public"]["Enums"]["customer_segment"]
          total_no_shows?: number | null
          total_revenue?: number | null
          total_visits?: number | null
          updated_at?: string | null
          whatsapp_opted_in?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string | null
          created_by: string | null
          custom_interval_days: number | null
          description: string | null
          expense_date: string
          id: string
          is_recurring: boolean | null
          recurring_period: string | null
        }
        Insert: {
          amount: number
          business_id: string
          category: string
          created_at?: string | null
          created_by?: string | null
          custom_interval_days?: number | null
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          recurring_period?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string | null
          created_by?: string | null
          custom_interval_days?: number | null
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          recurring_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_queue: {
        Row: {
          appointment_id: string
          business_id: string
          created_at: string
          customer_id: string
          id: string
          message: string | null
          protocol_id: string | null
          scheduled_for: string
          status: string
          type: string
        }
        Insert: {
          appointment_id: string
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          message?: string | null
          protocol_id?: string | null
          scheduled_for: string
          status?: string
          type: string
        }
        Update: {
          appointment_id?: string
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          message?: string | null
          protocol_id?: string | null
          scheduled_for?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "today_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "follow_up_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "treatment_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string | null
          custom_interval_days: number | null
          description: string | null
          id: string
          income_date: string
          is_recurring: boolean | null
          recurring_period: string | null
        }
        Insert: {
          amount?: number
          business_id: string
          category: string
          created_at?: string | null
          custom_interval_days?: number | null
          description?: string | null
          id?: string
          income_date?: string
          is_recurring?: boolean | null
          recurring_period?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string | null
          custom_interval_days?: number | null
          description?: string | null
          id?: string
          income_date?: string
          is_recurring?: boolean | null
          recurring_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "income_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "income_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          id: string
          installment_number: number | null
          invoice_id: string
          method: string
          notes: string | null
          payment_type: string
          staff_id: string | null
          staff_name: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          id?: string
          installment_number?: number | null
          invoice_id: string
          method: string
          notes?: string | null
          payment_type?: string
          staff_id?: string | null
          staff_name?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          id?: string
          installment_number?: number | null
          invoice_id?: string
          method?: string
          notes?: string | null
          payment_type?: string
          staff_id?: string | null
          staff_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "invoice_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string | null
          customer_id: string | null
          due_date: string | null
          id: string
          installment_count: number | null
          installment_frequency: string | null
          invoice_number: string
          items: Json
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          payment_type: string | null
          pos_transaction_id: string | null
          staff_id: string | null
          staff_name: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          installment_count?: number | null
          installment_frequency?: string | null
          invoice_number: string
          items?: Json
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: string | null
          pos_transaction_id?: string | null
          staff_id?: string | null
          staff_name?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          installment_count?: number | null
          installment_frequency?: string | null
          invoice_number?: string
          items?: Json
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: string | null
          pos_transaction_id?: string | null
          staff_id?: string | null
          staff_name?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "today_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          end_date: string | null
          id: string
          notes: string | null
          plan_name: string
          price: number | null
          sessions_total: number | null
          sessions_used: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          plan_name: string
          price?: number | null
          sessions_total?: number | null
          sessions_used?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          plan_name?: string
          price?: number | null
          sessions_total?: number | null
          sessions_used?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          business_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          business_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          business_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "message_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_classification:
            | Database["public"]["Enums"]["ai_classification"]
            | null
          ai_confidence: number | null
          appointment_id: string | null
          business_id: string
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at: string | null
          customer_id: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          message_type: Database["public"]["Enums"]["message_type"]
          meta_message_id: string | null
          staff_id: string | null
          staff_name: string | null
          twilio_sid: string | null
          twilio_status: string | null
        }
        Insert: {
          ai_classification?:
            | Database["public"]["Enums"]["ai_classification"]
            | null
          ai_confidence?: number | null
          appointment_id?: string | null
          business_id: string
          channel?: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at?: string | null
          customer_id?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          meta_message_id?: string | null
          staff_id?: string | null
          staff_name?: string | null
          twilio_sid?: string | null
          twilio_status?: string | null
        }
        Update: {
          ai_classification?:
            | Database["public"]["Enums"]["ai_classification"]
            | null
          ai_confidence?: number | null
          appointment_id?: string | null
          business_id?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          content?: string
          created_at?: string | null
          customer_id?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          meta_message_id?: string | null
          staff_id?: string | null
          staff_name?: string | null
          twilio_sid?: string | null
          twilio_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "today_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          business_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          related_id: string | null
          related_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          business_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          business_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          business_id: string
          created_at: string
          customer_name: string | null
          id: string
          items: Json
          notes: string | null
          reservation_id: string | null
          status: string
          table_number: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          reservation_id?: string | null
          status?: string
          table_number?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          reservation_id?: string | null
          status?: string
          table_number?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "table_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      package_usages: {
        Row: {
          appointment_id: string | null
          business_id: string
          customer_package_id: string
          id: string
          notes: string | null
          staff_id: string | null
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          customer_package_id: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          customer_package_id?: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_usages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_usages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "today_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_usages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "package_usages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_usages_customer_package_id_fkey"
            columns: ["customer_package_id"]
            isOneToOne: false
            referencedRelation: "customer_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_usages_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string | null
          currency: string | null
          id: string
          paid_at: string | null
          paytr_merchant_oid: string | null
          paytr_response: Json | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string | null
          currency?: string | null
          id?: string
          paid_at?: string | null
          paytr_merchant_oid?: string | null
          paytr_response?: Json | null
          status: string
          subscription_id?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          paid_at?: string | null
          paytr_merchant_oid?: string | null
          paytr_response?: Json | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          business_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          storage_path: string | null
          title: string
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          storage_path?: string | null
          title: string
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "portfolio_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sessions: {
        Row: {
          actual_cash: number | null
          business_id: string
          closed_at: string | null
          created_at: string
          difference: number | null
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_cash: number
          staff_id: string
          status: string
          total_card: number | null
          total_cash: number | null
          total_refunds: number | null
          total_sales: number | null
          total_transfer: number | null
        }
        Insert: {
          actual_cash?: number | null
          business_id: string
          closed_at?: string | null
          created_at?: string
          difference?: number | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash?: number
          staff_id: string
          status?: string
          total_card?: number | null
          total_cash?: number | null
          total_refunds?: number | null
          total_sales?: number | null
          total_transfer?: number | null
        }
        Update: {
          actual_cash?: number | null
          business_id?: string
          closed_at?: string | null
          created_at?: string
          difference?: number | null
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash?: number
          staff_id?: string
          status?: string
          total_card?: number | null
          total_cash?: number | null
          total_refunds?: number | null
          total_sales?: number | null
          total_transfer?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "pos_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sessions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          discount_amount: number
          discount_type: string | null
          id: string
          invoice_id: string | null
          items: Json
          notes: string | null
          payment_status: string
          payments: Json
          receipt_number: string | null
          staff_id: string | null
          subtotal: number
          tax_amount: number
          total: number
          transaction_type: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          id?: string
          invoice_id?: string | null
          items?: Json
          notes?: string | null
          payment_status?: string
          payments?: Json
          receipt_number?: string | null
          staff_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          id?: string
          invoice_id?: string | null
          items?: Json
          notes?: string | null
          payment_status?: string
          payments?: Json
          receipt_number?: string | null
          staff_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "today_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "pos_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          business_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          min_stock_level: number
          name: string
          price: number | null
          stock_count: number
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock_level?: number
          name: string
          price?: number | null
          stock_count?: number
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock_level?: number
          name?: string
          price?: number | null
          stock_count?: number
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_sessions: {
        Row: {
          after_photo_url: string | null
          appointment_id: string | null
          before_photo_url: string | null
          business_id: string
          completed_date: string | null
          created_at: string
          id: string
          notes: string | null
          planned_date: string | null
          protocol_id: string
          session_number: number
          status: string
        }
        Insert: {
          after_photo_url?: string | null
          appointment_id?: string | null
          before_photo_url?: string | null
          business_id: string
          completed_date?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_date?: string | null
          protocol_id: string
          session_number: number
          status?: string
        }
        Update: {
          after_photo_url?: string | null
          appointment_id?: string | null
          before_photo_url?: string | null
          business_id?: string
          completed_date?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          planned_date?: string | null
          protocol_id?: string
          session_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "today_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "protocol_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_sessions_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "treatment_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          business_id: string
          converted_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          referred_customer_id: string | null
          referred_name: string | null
          referred_phone: string | null
          referrer_customer_id: string
          reward_claimed: boolean | null
          reward_type: string | null
          reward_value: number | null
          status: string
        }
        Insert: {
          business_id: string
          converted_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          referred_customer_id?: string | null
          referred_name?: string | null
          referred_phone?: string | null
          referrer_customer_id: string
          reward_claimed?: boolean | null
          reward_type?: string | null
          reward_value?: number | null
          status?: string
        }
        Update: {
          business_id?: string
          converted_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          referred_customer_id?: string | null
          referred_name?: string | null
          referred_phone?: string | null
          referrer_customer_id?: string
          reward_claimed?: boolean | null
          reward_type?: string | null
          reward_value?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "referrals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_customer_id_fkey"
            columns: ["referred_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          actual_response: string | null
          ai_response_draft: string | null
          appointment_id: string | null
          business_id: string
          comment: string | null
          created_at: string | null
          customer_id: string | null
          google_review_link_sent: boolean | null
          id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string | null
        }
        Insert: {
          actual_response?: string | null
          ai_response_draft?: string | null
          appointment_id?: string | null
          business_id: string
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          google_review_link_sent?: boolean | null
          id?: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string | null
        }
        Update: {
          actual_response?: string | null
          ai_response_draft?: string | null
          appointment_id?: string | null
          business_id?: string
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          google_review_link_sent?: boolean | null
          id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "today_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contraindications: {
        Row: {
          allergen: string
          business_id: string
          created_at: string
          id: string
          risk_level: string
          service_id: string
          warning_message: string | null
        }
        Insert: {
          allergen: string
          business_id: string
          created_at?: string
          id?: string
          risk_level?: string
          service_id: string
          warning_message?: string | null
        }
        Update: {
          allergen?: string
          business_id?: string
          created_at?: string
          id?: string
          risk_level?: string
          service_id?: string
          warning_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_contraindications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "service_contraindications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contraindications_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          service_id: string | null
          sessions_total: number
          sort_order: number
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          service_id?: string | null
          sessions_total?: number
          sort_order?: number
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          service_id?: string | null
          sessions_total?: number
          sort_order?: number
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "service_packages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_products: {
        Row: {
          id: string
          product_id: string
          quantity_per_use: number
          service_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity_per_use?: number
          service_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity_per_use?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_products_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          price: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          end_time: string | null
          id: string
          notes: string | null
          overtime_ranges: Json | null
          shift_date: string
          shift_type: string
          staff_id: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          overtime_ranges?: Json | null
          shift_date: string
          shift_type?: string
          staff_id: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          overtime_ranges?: Json | null
          shift_date?: string
          shift_type?: string
          staff_id?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "shifts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          business_id: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          role: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "staff_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          avatar_url: string | null
          business_id: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          permissions: Json | null
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string | null
          user_id: string | null
          working_hours: Json | null
        }
        Insert: {
          avatar_url?: string | null
          business_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          permissions?: Json | null
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string | null
          user_id?: string | null
          working_hours?: Json | null
        }
        Update: {
          avatar_url?: string | null
          business_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          permissions?: Json | null
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string | null
          user_id?: string | null
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "staff_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          staff_id: string | null
          type: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          staff_id?: string | null
          type: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          staff_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_address: string | null
          billing_name: string | null
          billing_tax_id: string | null
          business_id: string
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          paytr_merchant_oid: string | null
          paytr_token: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          status: Database["public"]["Enums"]["subscription_status_type"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          billing_address?: string | null
          billing_name?: string | null
          billing_tax_id?: string | null
          business_id: string
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paytr_merchant_oid?: string | null
          paytr_token?: string | null
          plan: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status_type"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          billing_address?: string | null
          billing_name?: string | null
          billing_tax_id?: string | null
          business_id?: string
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          paytr_merchant_oid?: string | null
          paytr_token?: string | null
          plan?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["subscription_status_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          business_id: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      table_reservations: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          party_size: number
          reservation_date: string
          reservation_time: string
          source: string
          status: string
          table_number: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          party_size?: number
          reservation_date: string
          reservation_time: string
          source?: string
          status?: string
          table_number?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          party_size?: number
          reservation_date?: string
          reservation_time?: string
          source?: string
          status?: string
          table_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_reservations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "table_reservations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tooth_records: {
        Row: {
          business_id: string
          condition: string
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          tooth_number: number
          treated_at: string | null
          treated_by_staff_id: string | null
          treatment: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          condition?: string
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          tooth_number: number
          treated_at?: string | null
          treated_by_staff_id?: string | null
          treatment?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          condition?: string
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          tooth_number?: number
          treated_at?: string | null
          treated_by_staff_id?: string | null
          treatment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tooth_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "tooth_records_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tooth_records_treated_by_staff_id_fkey"
            columns: ["treated_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_protocols: {
        Row: {
          business_id: string
          completed_sessions: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          interval_days: number | null
          name: string
          notes: string | null
          service_id: string | null
          status: string
          total_sessions: number
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_sessions?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          interval_days?: number | null
          name: string
          notes?: string | null
          service_id?: string | null
          status?: string
          total_sessions?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_sessions?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          interval_days?: number | null
          name?: string
          notes?: string | null
          service_id?: string | null
          status?: string
          total_sessions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_protocols_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "treatment_protocols_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_protocols_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_protocols_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_protocols_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          business_id: string
          created_at: string | null
          customer_id: string
          id: string
          is_active: boolean | null
          is_notified: boolean | null
          notes: string | null
          preferred_date: string | null
          preferred_time_end: string | null
          preferred_time_start: string | null
          service_id: string | null
          staff_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          customer_id: string
          id?: string
          is_active?: boolean | null
          is_notified?: boolean | null
          notes?: string | null
          preferred_date?: string | null
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          service_id?: string | null
          staff_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          is_active?: boolean | null
          is_notified?: boolean | null
          notes?: string | null
          preferred_date?: string | null
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          service_id?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "waitlist_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          access_token_encrypted: string
          business_id: string
          connected_at: string | null
          created_at: string | null
          display_name: string | null
          id: string
          messaging_limit: string | null
          phone_number: string
          phone_number_id: string
          quality_rating: string | null
          status: string
          updated_at: string | null
          waba_id: string
        }
        Insert: {
          access_token_encrypted: string
          business_id: string
          connected_at?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          messaging_limit?: string | null
          phone_number: string
          phone_number_id: string
          quality_rating?: string | null
          status?: string
          updated_at?: string | null
          waba_id: string
        }
        Update: {
          access_token_encrypted?: string
          business_id?: string
          connected_at?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          messaging_limit?: string | null
          phone_number?: string
          phone_number_id?: string
          quality_rating?: string | null
          status?: string
          updated_at?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "whatsapp_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          business_id: string
          context: Json
          created_at: string | null
          customer_id: string | null
          customer_phone: string
          id: string
          last_message_at: string | null
          state: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          context?: Json
          created_at?: string | null
          customer_id?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string | null
          state?: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          context?: Json
          created_at?: string | null
          customer_id?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string | null
          state?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      business_stats: {
        Row: {
          avg_rating: number | null
          business_id: string | null
          today_appointments: number | null
          today_completed: number | null
          today_no_shows: number | null
          total_customers: number | null
          total_reviews: number | null
          unread_notifications: number | null
        }
        Insert: {
          avg_rating?: never
          business_id?: string | null
          today_appointments?: never
          today_completed?: never
          today_no_shows?: never
          total_customers?: never
          total_reviews?: never
          unread_notifications?: never
        }
        Update: {
          avg_rating?: never
          business_id?: string | null
          today_appointments?: never
          today_completed?: never
          today_no_shows?: never
          total_customers?: never
          total_reviews?: never
          unread_notifications?: never
        }
        Relationships: []
      }
      today_appointments: {
        Row: {
          appointment_date: string | null
          business_id: string | null
          cancellation_reason: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string | null
          notes: string | null
          reminder_24h_sent: boolean | null
          reminder_2h_sent: boolean | null
          review_requested: boolean | null
          service_id: string | null
          service_name: string | null
          source: Database["public"]["Enums"]["appointment_source"] | null
          staff_id: string | null
          staff_name: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_business_for_user: {
        Args: {
          p_business_name: string
          p_city?: string
          p_phone?: string
          p_sector: Database["public"]["Enums"]["sector_type"]
          p_user_id: string
        }
        Returns: string
      }
      get_user_business_id: { Args: never; Returns: string }
    }
    Enums: {
      ai_classification:
        | "appointment"
        | "question"
        | "complaint"
        | "cancellation"
        | "greeting"
        | "other"
      appointment_source: "whatsapp" | "web" | "manual" | "phone"
      appointment_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      customer_segment: "new" | "regular" | "vip" | "risk" | "lost"
      message_channel: "whatsapp" | "sms" | "web"
      message_direction: "inbound" | "outbound"
      message_type: "text" | "template" | "ai_generated" | "system"
      notification_type:
        | "appointment"
        | "review"
        | "payment"
        | "customer"
        | "system"
      plan_type: "starter" | "standard" | "pro"
      review_status: "pending" | "responded" | "escalated"
      sector_type:
        | "hair_salon"
        | "beauty_salon"
        | "dental_clinic"
        | "psychologist"
        | "lawyer"
        | "restaurant"
        | "cafe"
        | "auto_service"
        | "veterinary"
        | "physiotherapy"
        | "other"
        | "spa_massage"
        | "yoga_pilates"
        | "tattoo_piercing"
        | "fitness"
        | "medical_aesthetic"
        | "car_wash"
        | "photo_studio"
        | "dietitian"
        | "tutoring"
      staff_role: "owner" | "manager" | "staff"
      subscription_status_type:
        | "trial"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
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
      ai_classification: [
        "appointment",
        "question",
        "complaint",
        "cancellation",
        "greeting",
        "other",
      ],
      appointment_source: ["whatsapp", "web", "manual", "phone"],
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      customer_segment: ["new", "regular", "vip", "risk", "lost"],
      message_channel: ["whatsapp", "sms", "web"],
      message_direction: ["inbound", "outbound"],
      message_type: ["text", "template", "ai_generated", "system"],
      notification_type: [
        "appointment",
        "review",
        "payment",
        "customer",
        "system",
      ],
      plan_type: ["starter", "standard", "pro"],
      review_status: ["pending", "responded", "escalated"],
      sector_type: [
        "hair_salon",
        "beauty_salon",
        "dental_clinic",
        "psychologist",
        "lawyer",
        "restaurant",
        "cafe",
        "auto_service",
        "veterinary",
        "physiotherapy",
        "other",
        "spa_massage",
        "yoga_pilates",
        "tattoo_piercing",
        "fitness",
        "medical_aesthetic",
        "car_wash",
        "photo_studio",
        "dietitian",
        "tutoring",
      ],
      staff_role: ["owner", "manager", "staff"],
      subscription_status_type: [
        "trial",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
    },
  },
} as const
