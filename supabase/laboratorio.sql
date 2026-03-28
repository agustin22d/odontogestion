-- ============================================
-- Módulo Laboratorio — Coronas y Prótesis
-- Correr en Supabase SQL Editor (proyecto gestion: ljqnjxbrqbfbqvhufmly)
-- ============================================

-- Tipo enum para estados
CREATE TYPE estado_laboratorio AS ENUM (
  'escaneado',
  'enviada',
  'en_proceso',
  'retirada',
  'colocada',
  'a_revisar'
);

-- Tabla principal de casos
CREATE TABLE laboratorio_casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente TEXT NOT NULL,
  sede_id UUID REFERENCES sedes(id),
  profesional TEXT,
  tipo TEXT NOT NULL DEFAULT 'corona',
  laboratorio TEXT,
  estado estado_laboratorio NOT NULL DEFAULT 'escaneado',
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial de cambios de estado
CREATE TABLE laboratorio_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id UUID NOT NULL REFERENCES laboratorio_casos(id) ON DELETE CASCADE,
  estado_anterior estado_laboratorio,
  estado_nuevo estado_laboratorio NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_lab_casos_estado ON laboratorio_casos(estado);
CREATE INDEX idx_lab_casos_sede ON laboratorio_casos(sede_id);
CREATE INDEX idx_lab_historial_caso ON laboratorio_historial(caso_id);

-- RLS
ALTER TABLE laboratorio_casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratorio_historial ENABLE ROW LEVEL SECURITY;

-- Políticas: admin tiene acceso total
CREATE POLICY "laboratorio_casos_select" ON laboratorio_casos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "laboratorio_casos_insert" ON laboratorio_casos
  FOR INSERT TO authenticated WITH CHECK (
    get_user_role() = 'admin'
  );

CREATE POLICY "laboratorio_casos_update" ON laboratorio_casos
  FOR UPDATE TO authenticated USING (
    get_user_role() = 'admin'
  );

CREATE POLICY "laboratorio_casos_delete" ON laboratorio_casos
  FOR DELETE TO authenticated USING (
    get_user_role() = 'admin'
  );

CREATE POLICY "laboratorio_historial_select" ON laboratorio_historial
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "laboratorio_historial_insert" ON laboratorio_historial
  FOR INSERT TO authenticated WITH CHECK (
    get_user_role() = 'admin'
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_laboratorio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_laboratorio_updated_at
  BEFORE UPDATE ON laboratorio_casos
  FOR EACH ROW
  EXECUTE FUNCTION update_laboratorio_updated_at();
