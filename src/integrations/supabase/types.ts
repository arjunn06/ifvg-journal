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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      app_analytics: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          operation: string
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      confluence_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          invoice_url: string | null
          trading_account_id: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          trading_account_id?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          invoice_url?: string | null
          trading_account_id?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_trading_account_id_fkey"
            columns: ["trading_account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          notes: string | null
          premium_access: boolean | null
          status: string
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          notes?: string | null
          premium_access?: boolean | null
          status?: string
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          notes?: string | null
          premium_access?: boolean | null
          status?: string
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      mistake_tags: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          id: string
          tag_name: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          tag_name: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          tag_name?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          attachments: string[] | null
          category: string | null
          content: string | null
          created_at: string
          id: string
          images: string[] | null
          is_favorite: boolean
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: string[] | null
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_favorite?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: string[] | null
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_favorite?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          has_completed_onboarding: boolean
          id: string
          notes: string | null
          premium_access_override: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          has_completed_onboarding?: boolean
          id?: string
          notes?: string | null
          premium_access_override?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          has_completed_onboarding?: boolean
          id?: string
          notes?: string | null
          premium_access_override?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          attempts: number | null
          blocked_until: string | null
          first_attempt: string | null
          id: string
          identifier: string
          last_attempt: string | null
        }
        Insert: {
          action: string
          attempts?: number | null
          blocked_until?: string | null
          first_attempt?: string | null
          id?: string
          identifier: string
          last_attempt?: string | null
        }
        Update: {
          action?: string
          attempts?: number | null
          blocked_until?: string | null
          first_attempt?: string | null
          id?: string
          identifier?: string
          last_attempt?: string | null
        }
        Relationships: []
      }
      security_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      strategies: {
        Row: {
          be_criteria: string | null
          created_at: string
          description: string | null
          entry_criteria: string | null
          exit_criteria: string | null
          id: string
          is_active: boolean
          market_conditions: string | null
          max_daily_risk: number | null
          max_risk_reward: number | null
          min_risk_reward: number | null
          name: string
          partial_criteria: string | null
          risk_per_trade: number | null
          rules: string | null
          timeframe: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          be_criteria?: string | null
          created_at?: string
          description?: string | null
          entry_criteria?: string | null
          exit_criteria?: string | null
          id?: string
          is_active?: boolean
          market_conditions?: string | null
          max_daily_risk?: number | null
          max_risk_reward?: number | null
          min_risk_reward?: number | null
          name: string
          partial_criteria?: string | null
          risk_per_trade?: number | null
          rules?: string | null
          timeframe?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          be_criteria?: string | null
          created_at?: string
          description?: string | null
          entry_criteria?: string | null
          exit_criteria?: string | null
          id?: string
          is_active?: boolean
          market_conditions?: string | null
          max_daily_risk?: number | null
          max_risk_reward?: number | null
          min_risk_reward?: number | null
          name?: string
          partial_criteria?: string | null
          risk_per_trade?: number | null
          rules?: string | null
          timeframe?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_confluence: {
        Row: {
          confluence_item_id: string
          created_at: string
          id: string
          is_present: boolean
          notes: string | null
          trade_id: string
        }
        Insert: {
          confluence_item_id: string
          created_at?: string
          id?: string
          is_present?: boolean
          notes?: string | null
          trade_id: string
        }
        Update: {
          confluence_item_id?: string
          created_at?: string
          id?: string
          is_present?: boolean
          notes?: string | null
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_trade_confluence_item"
            columns: ["confluence_item_id"]
            isOneToOne: false
            referencedRelation: "confluence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_trade_confluence_trade"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_mistakes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          mistake_tag: string
          severity: string | null
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          mistake_tag: string
          severity?: string | null
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          mistake_tag?: string
          severity?: string | null
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_mistakes_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          base_to_usd_rate: number | null
          commission: number | null
          confluence_score: number | null
          create_timestamp: string | null
          created_at: string
          deal_id: string | null
          deal_status: string | null
          emotions: string | null
          entry_date: string
          entry_price: number
          execution_price: number | null
          execution_time: string | null
          exit_date: string | null
          exit_price: number | null
          external_id: string | null
          filled_volume: number | null
          gross_profit: number | null
          id: string
          margin_rate: number | null
          market_price_at_entry: number | null
          market_price_at_exit: number | null
          notes: string | null
          order_id: string | null
          order_type: string | null
          pnl: number | null
          position_id: string | null
          quantity: number
          quote_to_deposit_rate: number | null
          risk_amount: number | null
          risk_reward_ratio: number | null
          screenshots: string[] | null
          session: string | null
          slippage_points: number | null
          source: string | null
          spread: number | null
          status: string
          stop_loss: number | null
          strategy_id: string | null
          swap: number | null
          symbol: string
          take_profit: number | null
          trade_type: string
          trading_account_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_to_usd_rate?: number | null
          commission?: number | null
          confluence_score?: number | null
          create_timestamp?: string | null
          created_at?: string
          deal_id?: string | null
          deal_status?: string | null
          emotions?: string | null
          entry_date: string
          entry_price: number
          execution_price?: number | null
          execution_time?: string | null
          exit_date?: string | null
          exit_price?: number | null
          external_id?: string | null
          filled_volume?: number | null
          gross_profit?: number | null
          id?: string
          margin_rate?: number | null
          market_price_at_entry?: number | null
          market_price_at_exit?: number | null
          notes?: string | null
          order_id?: string | null
          order_type?: string | null
          pnl?: number | null
          position_id?: string | null
          quantity: number
          quote_to_deposit_rate?: number | null
          risk_amount?: number | null
          risk_reward_ratio?: number | null
          screenshots?: string[] | null
          session?: string | null
          slippage_points?: number | null
          source?: string | null
          spread?: number | null
          status?: string
          stop_loss?: number | null
          strategy_id?: string | null
          swap?: number | null
          symbol: string
          take_profit?: number | null
          trade_type: string
          trading_account_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_to_usd_rate?: number | null
          commission?: number | null
          confluence_score?: number | null
          create_timestamp?: string | null
          created_at?: string
          deal_id?: string | null
          deal_status?: string | null
          emotions?: string | null
          entry_date?: string
          entry_price?: number
          execution_price?: number | null
          execution_time?: string | null
          exit_date?: string | null
          exit_price?: number | null
          external_id?: string | null
          filled_volume?: number | null
          gross_profit?: number | null
          id?: string
          margin_rate?: number | null
          market_price_at_entry?: number | null
          market_price_at_exit?: number | null
          notes?: string | null
          order_id?: string | null
          order_type?: string | null
          pnl?: number | null
          position_id?: string | null
          quantity?: number
          quote_to_deposit_rate?: number | null
          risk_amount?: number | null
          risk_reward_ratio?: number | null
          screenshots?: string[] | null
          session?: string | null
          slippage_points?: number | null
          source?: string | null
          spread?: number | null
          status?: string
          stop_loss?: number | null
          strategy_id?: string | null
          swap?: number | null
          symbol?: string
          take_profit?: number | null
          trade_type?: string
          trading_account_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_trades_account"
            columns: ["trading_account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_trades_strategy"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_accounts: {
        Row: {
          account_type: string
          breach_date: string | null
          breach_reason: string | null
          broker: string | null
          created_at: string
          currency: string
          current_balance: number
          current_drawdown: number | null
          current_equity: number
          daily_loss_limit: number | null
          equity_goal: number | null
          evaluation_certificate_url: string | null
          id: string
          initial_balance: number
          is_active: boolean
          is_prop_firm: boolean | null
          max_drawdown_reached: boolean | null
          max_loss_limit: number | null
          minimum_trading_days: number | null
          name: string
          profit_target: number | null
          start_date: string | null
          target_completion_date: string | null
          trading_days_completed: number | null
          trailing_drawdown_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          breach_date?: string | null
          breach_reason?: string | null
          broker?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          current_drawdown?: number | null
          current_equity?: number
          daily_loss_limit?: number | null
          equity_goal?: number | null
          evaluation_certificate_url?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          is_prop_firm?: boolean | null
          max_drawdown_reached?: boolean | null
          max_loss_limit?: number | null
          minimum_trading_days?: number | null
          name: string
          profit_target?: number | null
          start_date?: string | null
          target_completion_date?: string | null
          trading_days_completed?: number | null
          trailing_drawdown_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          breach_date?: string | null
          breach_reason?: string | null
          broker?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          current_drawdown?: number | null
          current_equity?: number
          daily_loss_limit?: number | null
          equity_goal?: number | null
          evaluation_certificate_url?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          is_prop_firm?: boolean | null
          max_drawdown_reached?: boolean | null
          max_loss_limit?: number | null
          minimum_trading_days?: number | null
          name?: string
          profit_target?: number | null
          start_date?: string | null
          target_completion_date?: string | null
          trading_days_completed?: number | null
          trailing_drawdown_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audit_token_access: {
        Args: { access_type: string; connection_id: string }
        Returns: undefined
      }
      check_invitation_rate_limit: {
        Args: { admin_user_id: string }
        Returns: boolean
      }
      cleanup_expired_auth_states: { Args: never; Returns: undefined }
      cleanup_expired_invitations: { Args: never; Returns: undefined }
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      get_ctrader_tokens: { Args: { connection_id: string }; Returns: Json }
      get_current_user_role: { Args: never; Returns: string }
      get_encrypted_token: { Args: { secret_id: string }; Returns: string }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      log_security_event: {
        Args: {
          action_name: string
          event_details?: Json
          resource_name?: string
        }
        Returns: undefined
      }
      migrate_tokens_to_vault: { Args: never; Returns: number }
      sanitize_text_input: {
        Args: { input_text: string; max_length?: number }
        Returns: string
      }
      store_encrypted_token: {
        Args: { token_name?: string; token_value: string }
        Returns: string
      }
      update_ctrader_tokens: {
        Args: {
          connection_id: string
          new_access_token: string
          new_expires_at: string
          new_refresh_token: string
        }
        Returns: boolean
      }
      use_invitation_token: {
        Args: { input_token: string; user_id: string }
        Returns: boolean
      }
      validate_invitation_token: {
        Args: { input_token: string }
        Returns: {
          email: string
          invitation_id: string
          is_valid: boolean
          premium_access: boolean
        }[]
      }
      validate_numeric_input: {
        Args: { input_value: number; max_val?: number; min_val?: number }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "admin" | "user"
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
      user_role: ["admin", "user"],
    },
  },
} as const
