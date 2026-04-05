export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      club_invites: {
        Row: {
          id: string
          club_id: string
          created_by: string
          created_at: string
          expires_at: string
          used_at: string | null
          used_by_user_id: string | null
          member_id: string | null
        }
        Insert: {
          id?: string
          club_id: string
          created_by: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          used_by_user_id?: string | null
          member_id?: string | null
        }
        Update: {
          id?: string
          club_id?: string
          created_by?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          used_by_user_id?: string | null
          member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          id: string
          club_id: string
          user_id: string | null
          role: string
          member_number: number | null
          first_name: string
          last_name: string
          nickname: string | null
          birthday: string | null
          country: string | null
          city: string | null
          phone: string | null
          address: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          user_id?: string | null
          role?: string
          member_number?: number | null
          first_name: string
          last_name: string
          nickname?: string | null
          birthday?: string | null
          country?: string | null
          city?: string | null
          phone?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          user_id?: string | null
          role?: string
          member_number?: number | null
          first_name?: string
          last_name?: string
          nickname?: string | null
          birthday?: string | null
          country?: string | null
          city?: string | null
          phone?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          slug?: string
        }
        Relationships: []
      }
      blind_structures: {
        Row: {
          id: string
          club_id: string
          name: string
          levels: Json
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          name: string
          levels?: Json
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          name?: string
          levels?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blind_structures_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_structures: {
        Row: {
          id: string
          club_id: string
          name: string
          payouts: Json
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          name: string
          payouts?: Json
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          name?: string
          payouts?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_structures_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          id: string
          club_id: string
          name: string
          date: string
          format: string
          buy_in_amount: number
          rebuy_amount: number | null
          addon_amount: number | null
          buy_in_fee: number | null
          rebuy_fee: number | null
          addon_fee: number | null
          buy_in_chips: number | null
          rebuy_chips: number | null
          addon_chips: number | null
          blind_structure_id: string | null
          prize_structure_id: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          name: string
          date: string
          format: string
          buy_in_amount: number
          rebuy_amount?: number | null
          addon_amount?: number | null
          buy_in_fee?: number | null
          rebuy_fee?: number | null
          addon_fee?: number | null
          buy_in_chips?: number | null
          rebuy_chips?: number | null
          addon_chips?: number | null
          blind_structure_id?: string | null
          prize_structure_id?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          name?: string
          date?: string
          format?: string
          buy_in_amount?: number
          rebuy_amount?: number | null
          addon_amount?: number | null
          buy_in_fee?: number | null
          rebuy_fee?: number | null
          addon_fee?: number | null
          buy_in_chips?: number | null
          rebuy_chips?: number | null
          addon_chips?: number | null
          blind_structure_id?: string | null
          prize_structure_id?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_blind_structure_id_fkey"
            columns: ["blind_structure_id"]
            isOneToOne: false
            referencedRelation: "blind_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_prize_structure_id_fkey"
            columns: ["prize_structure_id"]
            isOneToOne: false
            referencedRelation: "prize_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_players: {
        Row: {
          id: string
          tournament_id: string
          member_id: string
          rebuys: number
          addon: boolean
          finish_position: number | null
          payout_amount: number | null
          table_id: string | null
          seat_number: number | null
          preferred_table: number | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          member_id: string
          rebuys?: number
          addon?: boolean
          finish_position?: number | null
          payout_amount?: number | null
          table_id?: string | null
          seat_number?: number | null
          preferred_table?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          member_id?: string
          rebuys?: number
          addon?: boolean
          finish_position?: number | null
          payout_amount?: number | null
          table_id?: string | null
          seat_number?: number | null
          preferred_table?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_players_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tournament_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_tables: {
        Row: {
          id: string
          tournament_id: string
          number: number
          max_seats: number
          dealer: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          number: number
          max_seats: number
          dealer?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          number?: number
          max_seats?: number
          dealer?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_tables_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_club_ids: { Args: { user_uuid: string }; Returns: string[] }
      is_club_admin: {
        Args: { check_club_id: string; user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


export type Club = Database['public']['Tables']['clubs']['Row'];
export type Member = Database['public']['Tables']['members']['Row'];
export type Role = 'admin' | 'member' | 'guest';

export type ClubContext = {
  club: Club;
  player: Member;
  role: Role;
};

export interface BlindLevel {
  small_blind: number;
  big_blind: number;
  ante: number;
  duration_minutes: number;
}

export interface Payout {
  position: number;
  percentage: number;
}

export interface BlindStructure {
  id: string;
  club_id: string;
  name: string;
  levels: BlindLevel[];
  created_at: string;
}

export interface PrizeStructure {
  id: string;
  club_id: string;
  name: string;
  payouts: Payout[];
  created_at: string;
}

export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  date: string;
  format: 'freezeout' | 'rebuy';
  buy_in_amount: number;
  rebuy_amount: number | null;
  addon_amount: number | null;
  buy_in_fee: number | null;
  rebuy_fee: number | null;
  addon_fee: number | null;
  buy_in_chips: number | null;
  rebuy_chips: number | null;
  addon_chips: number | null;
  blind_structure_id: string | null;
  prize_structure_id: string | null;
  status: 'registration' | 'running' | 'finished';
  created_at: string;
  blind_structures?: { name: string } | null;
  prize_structures?: { name: string; payouts: { position: number; percentage: number }[] } | null;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  member_id: string;
  rebuys: number;
  addon: boolean;
  finish_position: number | null;
  payout_amount: number | null;
  created_at: string;
  members?: { id: string; first_name: string; last_name: string; nickname: string | null } | null;
  table_id: string | null;
  seat_number: number | null;
  preferred_table: number | null;
  tournament_tables?: { number: number; max_seats: number } | null;
}

export type ClubInvite = Database['public']['Tables']['club_invites']['Row'];

export interface TournamentTable {
  id: string;
  tournament_id: string;
  number: number;
  max_seats: number;
  dealer: string | null;
  created_at: string;
}
