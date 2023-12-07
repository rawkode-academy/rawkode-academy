export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      episode_channel: {
        Row: {
          channel: string
          episode_id: string
          remote_id: string
        }
        Insert: {
          channel: string
          episode_id: string
          remote_id: string
        }
        Update: {
          channel?: string
          episode_id?: string
          remote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_channel_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["slug"]
          }
        ]
      }
      episode_guests: {
        Row: {
          episode_id: string
          person_id: string
        }
        Insert: {
          episode_id: string
          person_id: string
        }
        Update: {
          episode_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_guests_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "episode_guests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["github_handle"]
          }
        ]
      }
      episode_statistics: {
        Row: {
          channel: string
          comment_count: number
          dislike_count: number
          episode_id: string
          favorite_count: number
          like_count: number
          view_count: number
        }
        Insert: {
          channel: string
          comment_count?: number
          dislike_count?: number
          episode_id: string
          favorite_count?: number
          like_count?: number
          view_count?: number
        }
        Update: {
          channel?: string
          comment_count?: number
          dislike_count?: number
          episode_id?: string
          favorite_count?: number
          like_count?: number
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "episode_statistics_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["slug"]
          }
        ]
      }
      episode_technologies: {
        Row: {
          episode_id: string
          technology_id: string
        }
        Insert: {
          episode_id: string
          technology_id: string
        }
        Update: {
          episode_id?: string
          technology_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_technologies_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "episode_technologies_technology_id_fkey"
            columns: ["technology_id"]
            isOneToOne: false
            referencedRelation: "technologies"
            referencedColumns: ["slug"]
          }
        ]
      }
      episodes: {
        Row: {
          duration: unknown | null
          links: string[] | null
          live: boolean
          published_at: string | null
          scheduled_for: string | null
          show_id: string | null
          slug: string
          title: string
          visibility: string | null
        }
        Insert: {
          duration?: unknown | null
          links?: string[] | null
          live: boolean
          published_at?: string | null
          scheduled_for?: string | null
          show_id?: string | null
          slug: string
          title: string
          visibility?: string | null
        }
        Update: {
          duration?: unknown | null
          links?: string[] | null
          live?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          show_id?: string | null
          slug?: string
          title?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["slug"]
          }
        ]
      }
      people: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          biography: string | null
          github_handle: string
          name: string | null
          website: string | null
          x_handle: string | null
          youtube_handle: string | null
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          biography?: string | null
          github_handle: string
          name?: string | null
          website?: string | null
          x_handle?: string | null
          youtube_handle?: string | null
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          biography?: string | null
          github_handle?: string
          name?: string | null
          website?: string | null
          x_handle?: string | null
          youtube_handle?: string | null
        }
        Relationships: []
      }
      show_hosts: {
        Row: {
          person_id: string
          show_id: string
        }
        Insert: {
          person_id: string
          show_id: string
        }
        Update: {
          person_id?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_hosts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["github_handle"]
          },
          {
            foreignKeyName: "show_hosts_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["slug"]
          }
        ]
      }
      shows: {
        Row: {
          description: string | null
          name: string
          slug: string
          visibility: string | null
          hosts: unknown | null
        }
        Insert: {
          description?: string | null
          name: string
          slug: string
          visibility?: string | null
        }
        Update: {
          description?: string | null
          name?: string
          slug?: string
          visibility?: string | null
        }
        Relationships: []
      }
      technologies: {
        Row: {
          aliases: string[] | null
          description: string
          documentation_url: string
          github_organization: string | null
          logo_url: string | null
          name: string
          oss_licensed: boolean
          repository_url: string | null
          slug: string
          tagline: string
          tags: string[] | null
          website_url: string
        }
        Insert: {
          aliases?: string[] | null
          description: string
          documentation_url: string
          github_organization?: string | null
          logo_url?: string | null
          name: string
          oss_licensed?: boolean
          repository_url?: string | null
          slug: string
          tagline: string
          tags?: string[] | null
          website_url: string
        }
        Update: {
          aliases?: string[] | null
          description?: string
          documentation_url?: string
          github_organization?: string | null
          logo_url?: string | null
          name?: string
          oss_licensed?: boolean
          repository_url?: string | null
          slug?: string
          tagline?: string
          tags?: string[] | null
          website_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hosts: {
        Args: {
          "": unknown
        }
        Returns: {
          auth_id: string | null
          avatar_url: string | null
          biography: string | null
          github_handle: string
          name: string | null
          website: string | null
          x_handle: string | null
          youtube_handle: string | null
        }[]
      }
      person_is_host: {
        Args: {
          github_handle: unknown
        }
        Returns: boolean
      }
      person_was_guest: {
        Args: {
          github_handle: unknown
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      chapter: {
        time: unknown
        title: string
      }
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
      Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
      Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
  ? Database["public"]["Enums"][PublicEnumNameOrOptions]
  : never
