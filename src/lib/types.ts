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
      blind_structures: {
        Row: {
          club_id: string
          created_at: string
          id: string
          levels: Json
          name: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          levels?: Json
          name: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          levels?: Json
          name?: string
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
      club_invites: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          used_by_user_id?: string | null
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
      club_members: {
        Row: {
          club_id: string
          display_name: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          display_name: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          club_id?: string
          display_name?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
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
      prize_structures: {
        Row: {
          club_id: string
          created_at: string
          id: string
          name: string
          payouts: Json
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          name: string
          payouts?: Json
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          name?: string
          payouts?: Json
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
      tournament_players: {
        Row: {
          addon: boolean
          created_at: string
          finish_position: number | null
          guest_name: string | null
          id: string
          member_club_id: string | null
          member_user_id: string | null
          rebuys: number
          tournament_id: string
        }
        Insert: {
          addon?: boolean
          created_at?: string
          finish_position?: number | null
          guest_name?: string | null
          id?: string
          member_club_id?: string | null
          member_user_id?: string | null
          rebuys?: number
          tournament_id: string
        }
        Update: {
          addon?: boolean
          created_at?: string
          finish_position?: number | null
          guest_name?: string | null
          id?: string
          member_club_id?: string | null
          member_user_id?: string | null
          rebuys?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_players_member_club_id_member_user_id_fkey"
            columns: ["member_club_id", "member_user_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["club_id", "user_id"]
          },
          {
            foreignKeyName: "tournament_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          addon_amount: number | null
          blind_structure_id: string | null
          buy_in: number
          club_id: string
          created_at: string
          date: string
          format: string
          id: string
          name: string
          prize_structure_id: string | null
          rebuy_amount: number | null
          status: string
        }
        Insert: {
          addon_amount?: number | null
          blind_structure_id?: string | null
          buy_in: number
          club_id: string
          created_at?: string
          date: string
          format: string
          id?: string
          name: string
          prize_structure_id?: string | null
          rebuy_amount?: number | null
          status?: string
        }
        Update: {
          addon_amount?: number | null
          blind_structure_id?: string | null
          buy_in?: number
          club_id?: string
          created_at?: string
          date?: string
          format?: string
          id?: string
          name?: string
          prize_structure_id?: string | null
          rebuy_amount?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_blind_structure_id_fkey"
            columns: ["blind_structure_id"]
            isOneToOne: false
            referencedRelation: "blind_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
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
export type ClubMember = Database['public']['Tables']['club_members']['Row'];
export type Role = 'admin' | 'member';

export type ClubContext = {
  club: Club;
  member: ClubMember;
  role: Role;
};

export interface BlindStructure {
  id: string;
  club_id: string;
  name: string;
  levels: import('./tournaments').BlindLevel[];
  created_at: string;
}

export interface PrizeStructure {
  id: string;
  club_id: string;
  name: string;
  payouts: import('./tournaments').Payout[];
  created_at: string;
}

export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  date: string;
  format: 'freezeout' | 'rebuy';
  buy_in: number;
  rebuy_amount: number | null;
  addon_amount: number | null;
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
  member_club_id: string | null;
  member_user_id: string | null;
  guest_name: string | null;
  rebuys: number;
  addon: boolean;
  finish_position: number | null;
  payout_amount: number | null;  // ← add this line
  created_at: string;
  club_members?: { display_name: string } | null;
}

export type ClubInvite = Database['public']['Tables']['club_invites']['Row'];
