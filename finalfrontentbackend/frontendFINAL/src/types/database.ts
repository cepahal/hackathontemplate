/**
 * Types for the Supabase `public` schema defined in finalfrontentbackend/databaseFINAL/migrations.
 * Same shape as `supabase gen types typescript`, with CHECK-constrained text columns narrowed to
 * literal unions. Keep in sync with the SQL when a migration changes a table.
 *
 * Insert/Update describe the table. What the browser may actually write is narrower
 * (column GRANTs in 006_rls.sql and 007_ai_history.sql): see ProjectInsert, TaskInsert, ProfileUpdate, etc. below.
 */
import type { Role } from "@/types/auth";
import type { AIProvider } from "@/types/integrations";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** 1 = low, 2 = medium, 3 = high, 4 = urgent. */
export const TASK_PRIORITIES = [1, 2, 3, 4] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const ACTIVITY_TYPES = [
  "project_created",
  "project_updated",
  "project_status_changed",
  "project_deleted",
  "task_created",
  "task_completed",
  "task_reopened",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const AI_GENERATION_TYPES = ["text", "structured", "stream", "image", "file"] as const;
export type AIGenerationType = (typeof AI_GENERATION_TYPES)[number];

export const AI_GENERATION_STATUSES = ["pending", "completed", "failed", "cancelled"] as const;
export type AIGenerationStatus = (typeof AI_GENERATION_STATUSES)[number];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          role: Role;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: Role;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: Role;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string;
          status: ProjectStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          name: string;
          description?: string;
          status?: ProjectStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string;
          status?: ProjectStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string;
          completed: boolean;
          priority: TaskPriority;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string;
          completed?: boolean;
          priority?: TaskPriority;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string;
          completed?: boolean;
          priority?: TaskPriority;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      activity: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          type: ActivityType;
          message: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          type: ActivityType;
          message: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          type?: ActivityType;
          message?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generations: {
        Row: {
          id: string;
          user_id: string;
          provider: AIProvider;
          model: string;
          type: AIGenerationType;
          status: AIGenerationStatus;
          input: Json;
          output: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          provider: AIProvider;
          model: string;
          type: AIGenerationType;
          status?: AIGenerationStatus;
          input?: Json;
          output?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: AIProvider;
          model?: string;
          type?: AIGenerationType;
          status?: AIGenerationStatus;
          input?: Json;
          output?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicTables = Database["public"]["Tables"];

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]["Insert"];
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]["Update"];

export type Profile = Tables<"profiles">;
export type Project = Tables<"projects">;
export type Task = Tables<"tasks">;
export type Activity = Tables<"activity">;
export type AIGeneration = Tables<"ai_generations">;

/** Columns an authenticated user may write (matches the column GRANTs in 006_rls.sql). */
export type ProfileUpdate = Pick<TablesUpdate<"profiles">, "display_name" | "avatar_url">;
export type ProjectInsert = Pick<TablesInsert<"projects">, "name" | "description" | "status">;
export type ProjectUpdate = Pick<TablesUpdate<"projects">, "name" | "description" | "status">;
export type TaskInsert = Pick<
  TablesInsert<"tasks">,
  "project_id" | "title" | "description" | "completed" | "priority" | "due_date"
>;
export type TaskUpdate = Pick<
  TablesUpdate<"tasks">,
  "project_id" | "title" | "description" | "completed" | "priority" | "due_date"
>;
