-- =============================================================
-- Odonto Gestión — Gastos recurrentes
-- Agrega soporte para gastos que se repiten mensualmente (alquiler,
-- sueldos, servicios). Al crear un gasto "parent" recurrente, una
-- función genera N instancias futuras enlazadas.
-- =============================================================

CREATE TYPE recurrence_frequency AS ENUM ('monthly', 'weekly', 'yearly');

ALTER TABLE gastos
  ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN recurrence_frequency recurrence_frequency,
  ADD COLUMN recurrence_day INTEGER,                     -- día del mes (1-31) o día de semana (0-6)
  ADD COLUMN parent_expense_id UUID REFERENCES gastos(id) ON DELETE CASCADE;

CREATE INDEX idx_gastos_parent ON gastos(parent_expense_id);
CREATE INDEX idx_gastos_recurring ON gastos(is_recurring) WHERE is_recurring = true;

-- Genera instancias futuras de un gasto recurrente. Se llama desde el
-- cliente después de crear el "parent" con is_recurring=true.
-- p_months: cuántas instancias generar (default 12).
CREATE OR REPLACE FUNCTION generate_recurring_expense_instances(
  p_parent_id UUID,
  p_months INTEGER DEFAULT 12
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_parent gastos%ROWTYPE;
  v_user_clinic UUID;
  v_next_fecha DATE;
  v_next_venc DATE;
  v_count INTEGER := 0;
  i INTEGER;
BEGIN
  SELECT * INTO v_parent FROM gastos WHERE id = p_parent_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gasto_not_found'; END IF;

  -- Seguridad: solo el admin de la clínica (o super-admin) puede generar
  IF NOT (is_super_admin() OR v_parent.clinic_id = get_user_clinic_id()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT v_parent.is_recurring THEN
    RAISE EXCEPTION 'parent_not_recurring';
  END IF;

  FOR i IN 1..p_months LOOP
    -- Por ahora solo soportamos mensual. Weekly/yearly quedan para futuro.
    IF v_parent.recurrence_frequency = 'monthly' THEN
      v_next_fecha := v_parent.fecha + (i || ' months')::INTERVAL;
      v_next_venc := CASE WHEN v_parent.fecha_vencimiento IS NOT NULL
                          THEN (v_parent.fecha_vencimiento + (i || ' months')::INTERVAL)::DATE
                          ELSE NULL END;
    ELSIF v_parent.recurrence_frequency = 'weekly' THEN
      v_next_fecha := v_parent.fecha + (i * 7 || ' days')::INTERVAL;
      v_next_venc := CASE WHEN v_parent.fecha_vencimiento IS NOT NULL
                          THEN (v_parent.fecha_vencimiento + (i * 7 || ' days')::INTERVAL)::DATE
                          ELSE NULL END;
    ELSIF v_parent.recurrence_frequency = 'yearly' THEN
      v_next_fecha := v_parent.fecha + (i || ' years')::INTERVAL;
      v_next_venc := CASE WHEN v_parent.fecha_vencimiento IS NOT NULL
                          THEN (v_parent.fecha_vencimiento + (i || ' years')::INTERVAL)::DATE
                          ELSE NULL END;
    ELSE
      CONTINUE;
    END IF;

    INSERT INTO gastos (
      clinic_id, sede_id, created_by, fecha, concepto, categoria, monto, tipo,
      estado_pago, fecha_vencimiento, notas,
      is_recurring, recurrence_frequency, recurrence_day, parent_expense_id
    ) VALUES (
      v_parent.clinic_id, v_parent.sede_id, v_parent.created_by, v_next_fecha,
      v_parent.concepto, v_parent.categoria, v_parent.monto, v_parent.tipo,
      'pendiente', v_next_venc, v_parent.notas,
      false, v_parent.recurrence_frequency, v_parent.recurrence_day, v_parent.id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
