export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          weekly_theme: string | null;
          weekly_theme_set_at: string | null;
          push_subscription: Json | null;
          notification_time: string; // "HH:MM"
          created_at: string;
        };
        Insert: {
          id: string;
          weekly_theme?: string | null;
          weekly_theme_set_at?: string | null;
          push_subscription?: Json | null;
          notification_time?: string;
          created_at?: string;
        };
        Update: {
          weekly_theme?: string | null;
          weekly_theme_set_at?: string | null;
          push_subscription?: Json | null;
          notification_time?: string;
        };
      };
      daily_entries: {
        Row: {
          id: string;
          user_id: string;
          date: string; // YYYY-MM-DD
          mood: number | null; // 0-4
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          mood?: number | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          mood?: number | null;
          completed_at?: string | null;
        };
      };
      tasks: {
        Row: {
          id: string;
          entry_id: string;
          user_id: string;
          position: number; // 1, 2, 3
          text: string;
          done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          user_id: string;
          position: number;
          text?: string;
          done?: boolean;
          created_at?: string;
        };
        Update: {
          text?: string;
          done?: boolean;
        };
      };
    };
  };
}
