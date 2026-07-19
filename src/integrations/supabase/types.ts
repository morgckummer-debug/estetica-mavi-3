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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          arquivada: boolean
          autoriza_foto: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          como_conheceu: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado_civil: string | null
          excluida: boolean
          id: string
          nascimento: string | null
          nome: string
          numero: string | null
          profissao: string | null
          sexo: string | null
          telefone: string | null
        }
        Insert: {
          arquivada?: boolean
          autoriza_foto?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          como_conheceu?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          excluida?: boolean
          id?: string
          nascimento?: string | null
          nome: string
          numero?: string | null
          profissao?: string | null
          sexo?: string | null
          telefone?: string | null
        }
        Update: {
          arquivada?: boolean
          autoriza_foto?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          como_conheceu?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          excluida?: boolean
          id?: string
          nascimento?: string | null
          nome?: string
          numero?: string | null
          profissao?: string | null
          sexo?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      contratos: {
        Row: {
          autoriza_foto: boolean
          cliente_id: string
          created_at: string
          data_contrato: string
          estado_civil: string | null
          forma_pagamento: string | null
          id: string
          itens: Json
          pdf_path: string | null
          profissao: string | null
        }
        Insert: {
          autoriza_foto?: boolean
          cliente_id: string
          created_at?: string
          data_contrato?: string
          estado_civil?: string | null
          forma_pagamento?: string | null
          id?: string
          itens?: Json
          pdf_path?: string | null
          profissao?: string | null
        }
        Update: {
          autoriza_foto?: boolean
          cliente_id?: string
          created_at?: string
          data_contrato?: string
          estado_civil?: string | null
          forma_pagamento?: string | null
          id?: string
          itens?: Json
          pdf_path?: string | null
          profissao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas: {
        Row: {
          alertas: string[]
          arquivada: boolean
          autoriza_foto: boolean
          cliente_id: string | null
          consentimento_dados: boolean
          created_at: string
          excluida: boolean
          id: string
          medidas: Json
          nome: string
          pacotes: Json
          relatorio: string | null
          respostas: Json
          telefone: string | null
          termo_aceito: boolean
          tipo: string
        }
        Insert: {
          alertas?: string[]
          arquivada?: boolean
          autoriza_foto?: boolean
          cliente_id?: string | null
          consentimento_dados?: boolean
          created_at?: string
          excluida?: boolean
          id?: string
          medidas?: Json
          nome: string
          pacotes?: Json
          relatorio?: string | null
          respostas?: Json
          telefone?: string | null
          termo_aceito?: boolean
          tipo?: string
        }
        Update: {
          alertas?: string[]
          arquivada?: boolean
          autoriza_foto?: boolean
          cliente_id?: string | null
          consentimento_dados?: boolean
          created_at?: string
          excluida?: boolean
          id?: string
          medidas?: Json
          nome?: string
          pacotes?: Json
          relatorio?: string | null
          respostas?: Json
          telefone?: string | null
          termo_aceito?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_pacote: {
        Row: {
          atualizado_em: string
          cliente_nome: string
          concluido: boolean
          criado_em: string
          ficha_id: string
          id: string
          item: string
          pacote_numero: number
          pacote_total: number
          sessoes: Json
          token: string
        }
        Insert: {
          atualizado_em?: string
          cliente_nome: string
          concluido?: boolean
          criado_em?: string
          ficha_id: string
          id?: string
          item: string
          pacote_numero: number
          pacote_total: number
          sessoes?: Json
          token?: string
        }
        Update: {
          atualizado_em?: string
          cliente_nome?: string
          concluido?: boolean
          criado_em?: string
          ficha_id?: string
          id?: string
          item?: string
          pacote_numero?: number
          pacote_total?: number
          sessoes?: Json
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_pacote_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes: {
        Row: {
          areas: string[]
          arquivado: boolean
          confirmado: boolean
          confirmado_em: string | null
          created_at: string
          data: string
          ficha_id: string
          id: string
          observacao: string | null
          token: string
        }
        Insert: {
          areas?: string[]
          arquivado?: boolean
          confirmado?: boolean
          confirmado_em?: string | null
          created_at?: string
          data?: string
          ficha_id: string
          id?: string
          observacao?: string | null
          token?: string
        }
        Update: {
          areas?: string[]
          arquivado?: boolean
          confirmado?: boolean
          confirmado_em?: string | null
          created_at?: string
          data?: string
          ficha_id?: string
          id?: string
          observacao?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirmar_sessao: { Args: { p_token: string }; Returns: string }
      encontrar_ou_criar_cliente: {
        Args: {
          p_autoriza_foto?: boolean
          p_bairro?: string
          p_cep?: string
          p_cidade?: string
          p_como_conheceu?: string
          p_complemento?: string
          p_cpf?: string
          p_email?: string
          p_endereco?: string
          p_estado_civil?: string
          p_nascimento?: string
          p_nome: string
          p_numero?: string
          p_profissao?: string
          p_sexo?: string
          p_telefone: string
        }
        Returns: string
      }
      relatorio_pacote_por_token: {
        Args: { p_token: string }
        Returns: {
          cliente_nome: string
          concluido: boolean
          item: string
          pacote_total: number
          sessoes: Json
        }[]
      }
      sessao_por_token: {
        Args: { p_token: string }
        Returns: {
          areas: string[]
          confirmado: boolean
          confirmado_em: string
          data: string
          observacao: string
          primeiro_nome: string
        }[]
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
  public: {
    Enums: {},
  },
} as const
