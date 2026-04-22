-- =============================================================
-- Odonto Gestión — Seed de datos demo
-- Pobla una clínica existente con datos fake para testing/demos.
-- Re-ejecutable: borra los datos previos y los vuelve a crear.
--
-- Uso:
--   1. Crear la clínica via /signup (o manualmente insertando en clinics).
--   2. SELECT seed_demo_data('<clinic_id_uuid>');
-- =============================================================

CREATE OR REPLACE FUNCTION seed_demo_data(p_clinic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sede_palermo UUID;
  v_sede_recoleta UUID;
  v_sede_belgrano UUID;
  v_prod_ids UUID[];
  v_prod_id UUID;
  v_today DATE := CURRENT_DATE;
  v_clinic_exists BOOLEAN;
  i INT;
  v_nombres TEXT[] := ARRAY[
    'María González','Juan Pérez','Laura Fernández','Diego López','Sofía Rodríguez',
    'Martín García','Valentina Sánchez','Lucas Martínez','Camila Torres','Nicolás Díaz',
    'Julieta Romero','Federico Ruiz','Agustina Silva','Matías Castro','Florencia Morales',
    'Sebastián Núñez','Carolina Vega','Tomás Herrera','Lucía Ortiz','Alejandro Ramos'
  ];
  v_profesionales TEXT[] := ARRAY[
    'Dr. Martínez','Dra. Fernández','Dr. Gómez','Dra. López','Dr. Sosa','Dra. Ramírez'
  ];
  v_tratamientos TEXT[] := ARRAY[
    'Consulta','Limpieza','Ortodoncia','Implante','Conducto','Extracción',
    'Blanqueamiento','Prótesis','Corona','Carilla'
  ];
  v_tipos_pago tipo_pago[] := ARRAY[
    'efectivo','transferencia','tarjeta_debito','tarjeta_credito','mercado_pago'
  ]::tipo_pago[];
  v_estados_turno estado_turno[] := ARRAY[
    'agendado','atendido','no_asistio','cancelado','atendido','atendido','agendado','atendido'
  ]::estado_turno[];
  v_origenes origen_turno[] := ARRAY[
    'whatsapp','web','telefono','instagram','presencial','whatsapp','web'
  ]::origen_turno[];
  v_cats_gasto TEXT[] := ARRAY[
    'personal','laboratorio','sueldos','publicidad','limpieza',
    'implantes','insumos','alquiler','servicios','otros'
  ];
  v_conceptos_gasto TEXT[] := ARRAY[
    'Sueldos quincena','Alquiler local','Material laboratorio','Publicidad Instagram',
    'Productos limpieza','Kit implantes','Anestesia','Luz','Internet','Papelería',
    'Guantes descartables','Mantenimiento sillón','Radiografías','Cena equipo'
  ];
  v_productos TEXT[] := ARRAY[
    'Guantes nitrilo','Mascarillas','Anestesia local','Composite A2','Composite A3',
    'Ionómero vidrio','Hilo dental','Enjuague bucal','Cepillos interdentales','Eyectores'
  ];
  v_unidades TEXT[] := ARRAY['caja x100','caja x50','ampolla','jeringa','unidad','rollo','caja x25','frasco','caja x10','bolsa x100'];
  v_lab_tipos TEXT[] := ARRAY['Corona','Prótesis removible','Carilla','Férula','Puente','Implante'];
  v_laboratorios TEXT[] := ARRAY['Lab Dentix','Lab Smile','Lab Precisión','Lab 3D','Lab Buenos Aires'];
  v_lab_estados estado_laboratorio[] := ARRAY[
    'escaneado','enviada','en_proceso','retirada','colocada','a_revisar'
  ]::estado_laboratorio[];
BEGIN
  -- Validar que la clínica existe
  SELECT EXISTS (SELECT 1 FROM clinics WHERE id = p_clinic_id) INTO v_clinic_exists;
  IF NOT v_clinic_exists THEN
    RAISE EXCEPTION 'clinic % no existe', p_clinic_id;
  END IF;

  -- Limpiar datos demo previos de esta clínica
  DELETE FROM laboratorio_historial WHERE clinic_id = p_clinic_id;
  DELETE FROM laboratorio_casos WHERE clinic_id = p_clinic_id;
  DELETE FROM stock_movimientos WHERE clinic_id = p_clinic_id;
  DELETE FROM stock_productos WHERE clinic_id = p_clinic_id;
  DELETE FROM deudas WHERE clinic_id = p_clinic_id;
  DELETE FROM gastos WHERE clinic_id = p_clinic_id;
  DELETE FROM cobranzas WHERE clinic_id = p_clinic_id;
  DELETE FROM turnos WHERE clinic_id = p_clinic_id;
  DELETE FROM sedes WHERE clinic_id = p_clinic_id;

  -- SEDES
  INSERT INTO sedes (clinic_id, nombre, direccion, activa)
  VALUES (p_clinic_id, 'Palermo', 'Av. Santa Fe 3450, CABA', true)
  RETURNING id INTO v_sede_palermo;

  INSERT INTO sedes (clinic_id, nombre, direccion, activa)
  VALUES (p_clinic_id, 'Recoleta', 'Av. Callao 1234, CABA', true)
  RETURNING id INTO v_sede_recoleta;

  INSERT INTO sedes (clinic_id, nombre, direccion, activa)
  VALUES (p_clinic_id, 'Belgrano', 'Av. Cabildo 2500, CABA', true)
  RETURNING id INTO v_sede_belgrano;

  -- TURNOS: ±15 días, ~40 turnos
  FOR i IN 1..40 LOOP
    INSERT INTO turnos (clinic_id, sede_id, fecha, hora, paciente, profesional, estado, origen, notas)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano])[1 + (i % 3)],
      v_today + ((i % 30) - 15),
      (ARRAY['09:00','10:00','11:00','14:00','15:00','16:00','17:00','18:00'])[1 + (i % 8)]::TIME,
      v_nombres[1 + (i % array_length(v_nombres, 1))],
      v_profesionales[1 + (i % array_length(v_profesionales, 1))],
      -- Fechas pasadas: estados cerrados; futuras: agendado
      CASE WHEN v_today + ((i % 30) - 15) < v_today
           THEN v_estados_turno[1 + (i % array_length(v_estados_turno, 1))]
           ELSE 'agendado'::estado_turno END,
      v_origenes[1 + (i % array_length(v_origenes, 1))],
      CASE WHEN i % 4 = 0 THEN 'Paciente nuevo' ELSE NULL END
    );
  END LOOP;

  -- COBRANZAS: últimos 30 días, ~50 registros
  FOR i IN 1..50 LOOP
    INSERT INTO cobranzas (clinic_id, sede_id, fecha, paciente, tratamiento, tipo_pago, monto, es_cuota, notas)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano])[1 + (i % 3)],
      v_today - (i % 30),
      v_nombres[1 + (i % array_length(v_nombres, 1))],
      v_tratamientos[1 + (i % array_length(v_tratamientos, 1))],
      v_tipos_pago[1 + (i % array_length(v_tipos_pago, 1))],
      (5000 + (i * 1250) + (i % 7) * 3500)::NUMERIC(12,2),
      (i % 5 = 0),
      NULL
    );
  END LOOP;

  -- GASTOS: últimos 30 días, ~20 registros, mix pagado/pendiente
  FOR i IN 1..20 LOOP
    INSERT INTO gastos (clinic_id, sede_id, fecha, fecha_vencimiento, concepto, categoria, monto, tipo, estado_pago, notas)
    VALUES (
      p_clinic_id,
      CASE WHEN i % 4 = 0 THEN NULL  -- general (sin sede)
           ELSE (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano])[1 + (i % 3)]
      END,
      v_today - (i % 30),
      CASE WHEN i % 3 = 0 THEN v_today + (i % 15) ELSE NULL END,
      v_conceptos_gasto[1 + (i % array_length(v_conceptos_gasto, 1))],
      v_cats_gasto[1 + (i % array_length(v_cats_gasto, 1))],
      (2500 + (i * 2800))::NUMERIC(12,2),
      CASE WHEN i % 3 = 0 THEN 'fijo' ELSE 'variable' END::tipo_gasto,
      CASE WHEN i % 4 = 0 THEN 'pendiente' ELSE 'pagado' END::estado_pago_gasto,
      NULL
    );
  END LOOP;

  -- DEUDAS: 6 activas
  FOR i IN 1..6 LOOP
    INSERT INTO deudas (clinic_id, sede_id, paciente, tratamiento, monto_total, monto_cobrado, fecha_inicio, fecha_vencimiento, estado, notas)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano])[1 + (i % 3)],
      v_nombres[i],
      v_tratamientos[1 + (i % array_length(v_tratamientos, 1))],
      (80000 + i * 15000)::NUMERIC(12,2),
      CASE WHEN i % 2 = 0 THEN (20000 * i)::NUMERIC(12,2) ELSE 0::NUMERIC(12,2) END,
      v_today - (i * 7),
      v_today + (i * 10),
      CASE WHEN i % 2 = 0 THEN 'parcial' ELSE 'pendiente' END::estado_deuda,
      'Plan en cuotas'
    );
  END LOOP;

  -- STOCK PRODUCTOS + MOVIMIENTOS
  v_prod_ids := ARRAY[]::UUID[];
  FOR i IN 1..array_length(v_productos, 1) LOOP
    INSERT INTO stock_productos (clinic_id, sede_id, nombre, medida, categoria, unidad, stock_minimo, precio_compra, activo)
    VALUES (
      p_clinic_id,
      CASE WHEN i % 3 = 0 THEN NULL
           ELSE (ARRAY[v_sede_palermo, v_sede_recoleta])[1 + (i % 2)] END,
      v_productos[i],
      CASE WHEN i % 2 = 0 THEN 'mediano' ELSE 'chico' END,
      'Insumos',
      v_unidades[i],
      (5 + (i % 5) * 2),
      (1500 + i * 350)::NUMERIC(12,2),
      true
    )
    RETURNING id INTO v_prod_id;
    v_prod_ids := array_append(v_prod_ids, v_prod_id);
  END LOOP;

  -- Movimientos: entrada inicial + salidas recientes
  FOR i IN 1..array_length(v_prod_ids, 1) LOOP
    -- Entrada grande hace 30 días
    INSERT INTO stock_movimientos (clinic_id, sede_id, producto_id, fecha, tipo, cantidad, motivo)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano])[1 + (i % 3)],
      v_prod_ids[i],
      v_today - 30,
      'entrada',
      50,
      'Compra inicial'
    );
    -- Algunas salidas para dejar stock bajo en algunos productos
    INSERT INTO stock_movimientos (clinic_id, sede_id, producto_id, fecha, tipo, cantidad, motivo)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano])[1 + (i % 3)],
      v_prod_ids[i],
      v_today - (i % 20),
      'salida',
      CASE WHEN i % 3 = 0 THEN 48 ELSE (10 + i * 2) END,
      'Uso en turnos'
    );
  END LOOP;

  -- LABORATORIO CASOS: 8
  FOR i IN 1..8 LOOP
    INSERT INTO laboratorio_casos (clinic_id, sede_id, paciente, profesional, tipo, laboratorio, estado, notas)
    VALUES (
      p_clinic_id,
      (ARRAY[v_sede_palermo, v_sede_recoleta, v_sede_belgrano])[1 + (i % 3)],
      v_nombres[i + 8],
      v_profesionales[1 + (i % array_length(v_profesionales, 1))],
      v_lab_tipos[1 + (i % array_length(v_lab_tipos, 1))],
      v_laboratorios[1 + (i % array_length(v_laboratorios, 1))],
      v_lab_estados[1 + (i % array_length(v_lab_estados, 1))],
      CASE WHEN i % 2 = 0 THEN 'Paciente con alergia a metales' ELSE NULL END
    );
  END LOOP;

  RETURN format(
    'Seed OK en clínica %s: 3 sedes, 40 turnos, 50 cobranzas, 20 gastos, 6 deudas, %s productos + movimientos, 8 casos lab',
    p_clinic_id,
    array_length(v_prod_ids, 1)
  );
END;
$$;

-- Conveniencia: obtener el clinic_id de una clínica por su nombre exacto
CREATE OR REPLACE FUNCTION get_clinic_id_by_nombre(p_nombre TEXT)
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM clinics WHERE nombre = p_nombre LIMIT 1;
$$;
