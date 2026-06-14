CREATE OR REPLACE FUNCTION public.activar_votacion_publica(p_asamblea_id uuid, p_base_url text DEFAULT 'https://tu-dominio.com'::text)
 RETURNS TABLE(codigo text, url text, mensaje text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_codigo TEXT;
  v_url TEXT;
  v_intentos INT := 0;
  v_max_intentos INT := 10;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM asambleas WHERE id = p_asamblea_id) THEN
    RAISE EXCEPTION 'La asamblea no existe';
  END IF;

  SELECT codigo_acceso INTO v_codigo FROM asambleas WHERE id = p_asamblea_id;

  IF v_codigo IS NULL THEN
    LOOP
      v_codigo := generar_codigo_acceso();
      v_intentos := v_intentos + 1;
      IF NOT EXISTS (SELECT 1 FROM asambleas WHERE codigo_acceso = v_codigo) THEN
        EXIT;
      END IF;
      IF v_intentos >= v_max_intentos THEN
        RAISE EXCEPTION 'No se pudo generar un código único después de % intentos', v_max_intentos;
      END IF;
    END LOOP;
  END IF;

  v_url := p_base_url || '/votar/' || v_codigo;

  UPDATE asambleas
  SET
    codigo_acceso = v_codigo,
    url_publica = v_url,
    acceso_publico = true,
    session_mode = 'voting'
  WHERE id = p_asamblea_id;

  RETURN QUERY
  SELECT v_codigo, v_url, 'Votación pública activada exitosamente'::TEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.actualizar_actividad_quorum(p_asamblea_id uuid, p_email_votante text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE quorum_asamblea
  SET ultima_actividad = now()
  WHERE asamblea_id = p_asamblea_id
    AND LOWER(TRIM(email_propietario)) = LOWER(TRIM(p_email_votante))
    AND presente_virtual = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.asambleas_punto_actual_misma_asamblea()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.punto_orden_dia_actual_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.puntos_orden_dia pod
    WHERE pod.id = NEW.punto_orden_dia_actual_id AND pod.asamblea_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'punto_orden_dia_actual_id debe pertenecer a esta asamblea';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.asegurar_quorum_para_identificador(p_asamblea_id uuid, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_unidades_propias UUID[];
  v_unidades_poderes UUID[];
  v_identificador TEXT := LOWER(TRIM(p_email));
  v_es_email BOOLEAN := (v_identificador LIKE '%@%');
BEGIN
  IF NOT v_es_email OR p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN;
  END IF;

  SELECT organization_id INTO v_organization_id
  FROM asambleas WHERE id = p_asamblea_id;
  IF v_organization_id IS NULL THEN
    RETURN;
  END IF;

  SELECT ARRAY_AGG(id) INTO v_unidades_propias
  FROM unidades u
  WHERE u.organization_id = v_organization_id
    AND unidad_email_coincide(COALESCE(u.email, u.email_propietario, ''), p_email);

  SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
  FROM poderes p
  WHERE p.asamblea_id = p_asamblea_id
    AND p.estado = 'activo'
    AND LOWER(TRIM(p.email_receptor)) = v_identificador;

  IF v_unidades_propias IS NOT NULL THEN
    INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
    SELECT p_asamblea_id, u.id, TRIM(p_email), true
    FROM unnest(v_unidades_propias) AS u(id)
    ON CONFLICT (asamblea_id, unidad_id) DO UPDATE SET presente_virtual = true, hora_llegada = NOW();
  END IF;
  IF v_unidades_poderes IS NOT NULL THEN
    INSERT INTO quorum_asamblea (asamblea_id, unidad_id, email_propietario, presente_virtual)
    SELECT p_asamblea_id, u.id, TRIM(p_email), true
    FROM unnest(v_unidades_poderes) AS u(id)
    ON CONFLICT (asamblea_id, unidad_id) DO UPDATE SET presente_virtual = true, hora_llegada = NOW();
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.asegurar_unidades_demo_organizacion(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_numero TEXT;
  v_email TEXT;
  v_nombre TEXT;
  i INT;
BEGIN
  FOR i IN 1..10 LOOP
    v_numero := (100 + i)::TEXT;  -- 101..110
    v_email := 'test' || i || '@asambleas.online';
    v_nombre := 'Apto ' || v_numero;

    BEGIN
      INSERT INTO unidades (
        organization_id,
        torre,
        numero,
        coeficiente,
        tipo,
        nombre_propietario,
        propietario,
        email,
        email_propietario,
        is_demo
      ) VALUES (
        p_organization_id,
        'Demo',
        v_numero,
        10,
        'apartamento',
        v_nombre,
        v_nombre,
        v_email,
        v_email,
        true
      );
    EXCEPTION WHEN unique_violation THEN
      -- Ya existe (org, torre, numero) o (org, numero): actualizar email/is_demo
      UPDATE unidades
      SET email = v_email,
          email_propietario = v_email,
          nombre_propietario = v_nombre,
          propietario = v_nombre,
          is_demo = true,
          updated_at = TIMEZONE('utc', NOW())
      WHERE organization_id = p_organization_id
        AND ( (torre = 'Demo' AND numero = v_numero) OR (torre IS NULL AND numero = v_numero) )
        AND is_demo = true;
      IF NOT FOUND THEN
        -- Fila existe pero no es demo: no sobrescribir unidades reales
        NULL;
      END IF;
    END;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_estadisticas_pregunta(p_pregunta_id uuid)
 RETURNS TABLE(total_votos integer, total_coeficiente numeric, coeficiente_total_conjunto numeric, total_unidades integer, tipo_votacion text, porcentaje_participacion numeric, resultados jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_is_demo BOOLEAN;
  v_sandbox_reales BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_tipo_votacion TEXT;
  v_total_votos INTEGER;
  v_total_coeficiente NUMERIC(12, 6);
  v_coeficiente_conjunto NUMERIC(12, 6);
  v_total_unidades INTEGER;
  v_resultados JSONB;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM preguntas p
  JOIN asambleas a ON a.id = p.asamblea_id
  WHERE p.id = p_pregunta_id;

  v_unidades_is_demo := CASE WHEN v_is_demo AND v_sandbox_reales THEN false ELSE v_is_demo END;

  SELECT COALESCE(p.tipo_votacion, 'coeficiente')
  INTO v_tipo_votacion
  FROM preguntas p
  WHERE p.id = p_pregunta_id;

  SELECT COUNT(*)::INTEGER
  INTO v_total_unidades
  FROM unidades
  WHERE organization_id = v_organization_id
    AND is_demo = v_unidades_is_demo;

  SELECT COALESCE(SUM(coeficiente), 100)
  INTO v_coeficiente_conjunto
  FROM unidades
  WHERE organization_id = v_organization_id
    AND is_demo = v_unidades_is_demo;

  SELECT COUNT(v.id)::INTEGER
  INTO v_total_votos
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
  WHERE v.pregunta_id = p_pregunta_id;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_total_coeficiente
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
  WHERE v.pregunta_id = p_pregunta_id;

  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'opcion_id', op.id,
      'opcion_texto', op.texto_opcion,
      'color', op.color,
      'votos_cantidad', COALESCE(stats.votos_count, 0),
      'votos_coeficiente', COALESCE(stats.votos_coeficiente, 0),
      'porcentaje_votos_emitidos', COALESCE(
        CASE WHEN v_total_votos > 0 THEN
          ROUND((stats.votos_count::NUMERIC / v_total_votos * 100), 2)
        ELSE 0 END, 0
      ),
      'porcentaje_coeficiente_emitido', COALESCE(
        CASE WHEN v_total_coeficiente > 0 THEN
          ROUND((stats.votos_coeficiente / v_total_coeficiente * 100), 2)
        ELSE 0 END, 0
      ),
      'porcentaje_coeficiente_total', COALESCE(
        CASE WHEN v_coeficiente_conjunto > 0 THEN
          ROUND((stats.votos_coeficiente / v_coeficiente_conjunto * 100), 2)
        ELSE 0 END, 0
      ),
      'porcentaje_nominal_total', COALESCE(
        CASE WHEN v_total_unidades > 0 THEN
          ROUND((COALESCE(stats.votos_count, 0)::NUMERIC / v_total_unidades * 100), 2)
        ELSE 0 END, 0
      )
    ) ORDER BY op.orden
  )
  INTO v_resultados
  FROM opciones_pregunta op
  LEFT JOIN (
    SELECT
      v.opcion_id,
      COUNT(v.id)::INTEGER AS votos_count,
      SUM(u.coeficiente)::NUMERIC(12, 6) AS votos_coeficiente
    FROM votos v
    JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
    WHERE v.pregunta_id = p_pregunta_id
    GROUP BY v.opcion_id
  ) stats ON stats.opcion_id = op.id
  WHERE op.pregunta_id = p_pregunta_id;

  IF v_resultados IS NULL THEN v_resultados := '[]'::JSONB; END IF;

  RETURN QUERY SELECT
    v_total_votos,
    v_total_coeficiente,
    v_coeficiente_conjunto,
    v_total_unidades,
    v_tipo_votacion,
    CASE
      WHEN v_tipo_votacion = 'nominal' AND v_total_unidades > 0 THEN
        ROUND((v_total_votos::NUMERIC / v_total_unidades * 100), 2)
      WHEN v_tipo_votacion = 'coeficiente' AND v_coeficiente_conjunto > 0 THEN
        ROUND((v_total_coeficiente / v_coeficiente_conjunto * 100), 2)
      ELSE 0
    END AS porcentaje_participacion,
    v_resultados;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_estadisticas_preguntas(p_pregunta_ids uuid[])
 RETURNS TABLE(pregunta_id uuid, total_votos numeric, total_coeficiente numeric, coeficiente_total_conjunto numeric, porcentaje_participacion numeric, tipo_votacion text, resultados jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    pid as pregunta_id,
    coalesce((e.total_votos)::numeric, 0) as total_votos,
    coalesce((e.total_coeficiente)::numeric, 0) as total_coeficiente,
    coalesce((e.coeficiente_total_conjunto)::numeric, 100) as coeficiente_total_conjunto,
    coalesce((e.porcentaje_participacion)::numeric, 0) as porcentaje_participacion,
    coalesce((e.tipo_votacion)::text, 'coeficiente') as tipo_votacion,
    case
      when jsonb_typeof(e.resultados::jsonb) = 'array' then e.resultados::jsonb
      else '[]'::jsonb
    end as resultados
  from unnest(p_pregunta_ids) as pid
  left join lateral public.calcular_estadisticas_pregunta(pid) e on true;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_quorum_asamblea(p_asamblea_id uuid)
 RETURNS TABLE(total_unidades integer, unidades_votantes integer, unidades_pendientes integer, coeficiente_total numeric, coeficiente_votante numeric, coeficiente_pendiente numeric, porcentaje_participacion_nominal numeric, porcentaje_participacion_coeficiente numeric, quorum_alcanzado boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_is_demo BOOLEAN;
  v_sandbox_reales BOOLEAN;
  v_unidades_is_demo BOOLEAN;  -- qué unidades contar: true = demo, false = reales
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  -- Asambleas reales: solo unidades reales. Sandbox: por defecto demo; si sandbox_usar_unidades_reales entonces reales.
  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  RETURN QUERY
  WITH unidades_conjunto AS (
    SELECT
      COUNT(*)::INTEGER AS total,
      COALESCE(SUM(coeficiente), 0) AS coef_total
    FROM unidades
    WHERE organization_id = v_organization_id
      AND is_demo = v_unidades_is_demo
  ),
  unidades_votantes_data AS (
    SELECT
      COUNT(DISTINCT v.unidad_id)::INTEGER AS votantes,
      COALESCE(SUM(DISTINCT u.coeficiente), 0) AS coef_votante
    FROM votos v
    JOIN unidades u ON v.unidad_id = u.id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
    JOIN preguntas p ON v.pregunta_id = p.id
    WHERE p.asamblea_id = p_asamblea_id
  )
  SELECT
    uc.total AS total_unidades,
    COALESCE(uv.votantes, 0) AS unidades_votantes,
    (uc.total - COALESCE(uv.votantes, 0)) AS unidades_pendientes,
    uc.coef_total AS coeficiente_total,
    COALESCE(uv.coef_votante, 0) AS coeficiente_votante,
    (uc.coef_total - COALESCE(uv.coef_votante, 0)) AS coeficiente_pendiente,
    CASE
      WHEN uc.total > 0 THEN
        ROUND((COALESCE(uv.votantes, 0)::NUMERIC / uc.total::NUMERIC * 100), 2)
      ELSE 0
    END AS porcentaje_participacion_nominal,
    CASE
      WHEN uc.coef_total > 0 THEN
        ROUND((COALESCE(uv.coef_votante, 0) / uc.coef_total * 100)::NUMERIC, 2)
      ELSE 0
    END AS porcentaje_participacion_coeficiente,
    CASE
      WHEN uc.coef_total > 0 THEN
        (COALESCE(uv.coef_votante, 0) / uc.coef_total * 100) >= 50
      ELSE false
    END AS quorum_alcanzado
  FROM unidades_conjunto uc
  LEFT JOIN unidades_votantes_data uv ON true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_quorum_presencia(p_asamblea_id uuid, p_pregunta_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(total_unidades integer, total_participantes integer, participantes_activos integer, participantes_delegados_activos integer, active_coefficient_total numeric, delegated_coefficient_total numeric, total_represented_coefficient numeric, total_assembly_coefficient numeric, quorum_percentage numeric, quorum_met boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_org_id UUID;
  v_is_demo BOOLEAN;
  v_total_coef NUMERIC(12, 6);
  v_rules JSONB;
  v_threshold NUMERIC(6, 2);
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_org_id, v_is_demo
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT quorum_rules INTO v_rules
  FROM quorum_presence_config
  WHERE asamblea_id = p_asamblea_id;

  IF v_rules IS NULL THEN
    v_rules := '{"thresholdPercent":50}'::jsonb;
  END IF;

  v_threshold := COALESCE(NULLIF((v_rules->>'thresholdPercent')::NUMERIC, NULL), 50);

  SELECT COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)
    INTO v_total_coef
  FROM unidades u
  WHERE u.organization_id = v_org_id
    AND COALESCE(u.is_demo, false) = v_is_demo;

  RETURN QUERY
  WITH pu AS (
    SELECT
      qp.id AS presence_id,
      qp.status,
      qp.participant_key,
      SUM(qpu.coeficiente_propio)::NUMERIC(12, 6) AS coef_propio,
      SUM(qpu.coeficiente_delegado)::NUMERIC(12, 6) AS coef_delegado,
      SUM(qpu.total_represented_coefficient)::NUMERIC(12, 6) AS coef_total
    FROM quorum_presence qp
    LEFT JOIN quorum_presence_units qpu ON qpu.presence_id = qp.id
    WHERE qp.asamblea_id = p_asamblea_id
    GROUP BY qp.id, qp.status, qp.participant_key
  ),
  active AS (
    SELECT *
    FROM pu
    WHERE status IN ('online', 'idle')
  ),
  s AS (
    SELECT
      (SELECT COUNT(*)::INTEGER FROM unidades u WHERE u.organization_id = v_org_id AND COALESCE(u.is_demo, false) = v_is_demo) AS total_unidades,
      (SELECT COUNT(*)::INTEGER FROM pu) AS total_participantes,
      (SELECT COUNT(*)::INTEGER FROM active) AS participantes_activos,
      (SELECT COUNT(*)::INTEGER FROM active WHERE coef_delegado > 0) AS participantes_delegados_activos,
      COALESCE((SELECT SUM(coef_propio) FROM active), 0)::NUMERIC(12, 6) AS active_coef,
      COALESCE((SELECT SUM(coef_delegado) FROM active), 0)::NUMERIC(12, 6) AS delegated_coef
  )
  SELECT
    s.total_unidades,
    s.total_participantes,
    s.participantes_activos,
    s.participantes_delegados_activos,
    s.active_coef AS active_coefficient_total,
    s.delegated_coef AS delegated_coefficient_total,
    (s.active_coef + s.delegated_coef)::NUMERIC(12, 6) AS total_represented_coefficient,
    v_total_coef AS total_assembly_coefficient,
    CASE
      WHEN v_total_coef > 0 THEN ROUND(((s.active_coef + s.delegated_coef) / v_total_coef) * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2) AS quorum_percentage,
    CASE
      WHEN v_total_coef > 0 THEN (((s.active_coef + s.delegated_coef) / v_total_coef) * 100) >= v_threshold
      ELSE false
    END AS quorum_met
  FROM s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_verificacion_por_preguntas(p_asamblea_id uuid)
 RETURNS TABLE(pregunta_id uuid, total_verificados integer, coeficiente_verificado numeric, porcentaje_verificado numeric, quorum_alcanzado boolean, corte_timestamp timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id  UUID;
  v_is_demo          BOOLEAN;
  v_sandbox_reales   BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_coef_total       NUMERIC(12, 6);
BEGIN
  SELECT
    a.organization_id,
    COALESCE(a.is_demo, false),
    COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_coef_total
  FROM unidades u
  WHERE u.organization_id = v_organization_id
    AND COALESCE(u.is_demo, false) = v_unidades_is_demo;

  RETURN QUERY
  WITH cortes AS (
    SELECT
      p.id AS pregunta_id,
      COALESCE(
        (
          SELECT MAX(hv.fecha_accion)
          FROM historial_votos hv
          JOIN votos v2 ON v2.id = hv.voto_id
          WHERE v2.pregunta_id = p.id
        ),
        NOW()
      ) AS corte
    FROM preguntas p
    WHERE p.asamblea_id = p_asamblea_id
  ),
  snaps AS (
    SELECT
      c.pregunta_id,
      c.corte,
      COUNT(qa.id)::INT                                AS total_v,
      COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6) AS coef_v
    FROM cortes c
    LEFT JOIN quorum_asamblea qa
          ON  qa.asamblea_id = p_asamblea_id
          AND qa.verifico_asistencia = true
          AND (qa.hora_verificacion IS NULL OR qa.hora_verificacion <= c.corte)
    LEFT JOIN unidades u
          ON  u.id = qa.unidad_id
          AND u.organization_id = v_organization_id
          AND COALESCE(u.is_demo, false) = v_unidades_is_demo
    GROUP BY c.pregunta_id, c.corte
  )
  SELECT
    s.pregunta_id,
    s.total_v                                              AS total_verificados,
    s.coef_v                                               AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(s.coef_v / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                     AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (s.coef_v / v_coef_total * 100) > 50
      ELSE false
    END                                                    AS quorum_alcanzado,
    s.corte                                                AS corte_timestamp
  FROM snaps s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_verificacion_quorum(p_asamblea_id uuid)
 RETURNS TABLE(total_verificados integer, coeficiente_verificado numeric, porcentaje_verificado numeric, quorum_alcanzado boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id  UUID;
  v_is_demo          BOOLEAN;
  v_sandbox_reales   BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_coef_total       NUMERIC(12, 6);
BEGIN
  SELECT
    a.organization_id,
    COALESCE(a.is_demo, false),
    COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Misma lógica que calcular_quorum_asamblea
  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_coef_total
  FROM unidades u
  WHERE u.organization_id = v_organization_id
    AND COALESCE(u.is_demo, false) = v_unidades_is_demo;

  RETURN QUERY
  SELECT
    COUNT(qa.id)::INT                                             AS total_verificados,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)              AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                           AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50
      ELSE false
    END                                                          AS quorum_alcanzado
  FROM quorum_asamblea qa
  JOIN unidades u
    ON u.id = qa.unidad_id
   AND u.organization_id = v_organization_id
   AND COALESCE(u.is_demo, false) = v_unidades_is_demo
  WHERE qa.asamblea_id = p_asamblea_id
    AND qa.verifico_asistencia = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_verificacion_quorum(p_asamblea_id uuid, p_pregunta_id uuid DEFAULT NULL::uuid, p_solo_sesion_actual boolean DEFAULT false)
 RETURNS TABLE(total_verificados integer, coeficiente_verificado numeric, porcentaje_verificado numeric, quorum_alcanzado boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_sandbox_reales  BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
  v_corte           TIMESTAMPTZ;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
    INTO v_organization_id, v_is_demo, v_sandbox_reales
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Misma lógica que calcular_quorum_asamblea: sandbox puede usar unidades reales
  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  IF p_solo_sesion_actual THEN
    SELECT s.apertura_at INTO v_corte
    FROM verificacion_asamblea_sesiones s
    WHERE s.asamblea_id = p_asamblea_id
      AND s.cierre_at IS NULL
    ORDER BY s.apertura_at DESC
    LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND COALESCE(u.is_demo, false) = v_unidades_is_demo;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT r.quorum_asamblea_id)::INT                              AS total_verificados,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)                       AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                                   AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50
      ELSE false
    END                                                                   AS quorum_alcanzado
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
   AND u.organization_id = v_organization_id
   AND COALESCE(u.is_demo, false) = v_unidades_is_demo
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
    AND (NOT p_solo_sesion_actual OR (v_corte IS NOT NULL AND r.creado_en >= v_corte));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_verificacion_quorum(p_asamblea_id uuid, p_pregunta_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(total_verificados integer, coeficiente_verificado numeric, porcentaje_verificado numeric, quorum_alcanzado boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_organization_id, v_is_demo
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND COALESCE(u.is_demo, false) = v_is_demo;

  -- Contar desde verificacion_asistencia_registro para el contexto (pregunta o general)
  RETURN QUERY
  SELECT
    COUNT(DISTINCT r.quorum_asamblea_id)::INT                              AS total_verificados,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)                       AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                                   AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50
      ELSE false
    END                                                                   AS quorum_alcanzado
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_verificacion_quorum_desglose(p_asamblea_id uuid, p_pregunta_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(total_verificados integer, coeficiente_directo numeric, coeficiente_poder numeric, coeficiente_total numeric, coef_total_conjunto numeric, porcentaje_total numeric, porcentaje_directo numeric, porcentaje_poder numeric, quorum_alcanzado boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
  v_coef_directo    NUMERIC(12, 6);
  v_coef_poder      NUMERIC(12, 6);
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_organization_id, v_is_demo
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND COALESCE(u.is_demo, false) = v_is_demo;

  -- Directo: email en quorum coincide con alguno de los correos de la unidad; si no, poder si hay poder activo
  WITH clasificado AS (
    SELECT
      r.quorum_asamblea_id,
      u.coeficiente,
      CASE
        WHEN unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), qa.email_propietario) THEN true
        WHEN EXISTS (
          SELECT 1 FROM poderes p
          WHERE p.unidad_otorgante_id = qa.unidad_id
            AND p.asamblea_id = p_asamblea_id
            AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(qa.email_propietario))
            AND p.estado = 'activo'
        ) THEN false
        ELSE true
      END AS es_directo
    FROM verificacion_asistencia_registro r
    JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE r.asamblea_id = p_asamblea_id
      AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
  )
  SELECT
    COALESCE(SUM(CASE WHEN es_directo THEN coeficiente ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT es_directo THEN coeficiente ELSE 0 END), 0)
    INTO v_coef_directo, v_coef_poder
  FROM clasificado;

  RETURN QUERY
  SELECT
    (SELECT COUNT(DISTINCT r.quorum_asamblea_id)::INT
       FROM verificacion_asistencia_registro r
       JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
      WHERE r.asamblea_id = p_asamblea_id
        AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)),
    COALESCE(v_coef_directo, 0),
    COALESCE(v_coef_poder, 0),
    COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0),
    v_coef_total,
    CASE WHEN v_coef_total > 0 THEN ROUND((COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0)) / v_coef_total * 100, 2) ELSE 0 END,
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(v_coef_directo, 0) / v_coef_total * 100, 2) ELSE 0 END,
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(v_coef_poder, 0) / v_coef_total * 100, 2) ELSE 0 END,
    (v_coef_total > 0 AND (COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0)) / v_coef_total * 100 > 50);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_verificacion_quorum_desglose(p_asamblea_id uuid, p_pregunta_id uuid DEFAULT NULL::uuid, p_solo_sesion_actual boolean DEFAULT false)
 RETURNS TABLE(total_verificados integer, coeficiente_directo numeric, coeficiente_poder numeric, coeficiente_total numeric, coef_total_conjunto numeric, porcentaje_total numeric, porcentaje_directo numeric, porcentaje_poder numeric, quorum_alcanzado boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_is_demo         BOOLEAN;
  v_coef_total      NUMERIC(12, 6);
  v_coef_directo    NUMERIC(12, 6);
  v_coef_poder      NUMERIC(12, 6);
  v_corte           TIMESTAMPTZ;
BEGIN
  SELECT a.organization_id, COALESCE(a.is_demo, false)
    INTO v_organization_id, v_is_demo
    FROM asambleas a
   WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF p_solo_sesion_actual THEN
    SELECT s.apertura_at INTO v_corte
    FROM verificacion_asamblea_sesiones s
    WHERE s.asamblea_id = p_asamblea_id
      AND s.cierre_at IS NULL
    ORDER BY s.apertura_at DESC
    LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(u.coeficiente), 0)
    INTO v_coef_total
    FROM unidades u
   WHERE u.organization_id = v_organization_id
     AND COALESCE(u.is_demo, false) = v_is_demo;

  WITH clasificado AS (
    SELECT
      r.quorum_asamblea_id,
      u.coeficiente,
      CASE
        WHEN unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), qa.email_propietario) THEN true
        WHEN EXISTS (
          SELECT 1 FROM poderes p
          WHERE p.unidad_otorgante_id = qa.unidad_id
            AND p.asamblea_id = p_asamblea_id
            AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(qa.email_propietario))
            AND p.estado = 'activo'
        ) THEN false
        ELSE true
      END AS es_directo
    FROM verificacion_asistencia_registro r
    JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE r.asamblea_id = p_asamblea_id
      AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
      AND (NOT p_solo_sesion_actual OR (v_corte IS NOT NULL AND r.creado_en >= v_corte))
  )
  SELECT
    COALESCE(SUM(CASE WHEN es_directo THEN coeficiente ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN NOT es_directo THEN coeficiente ELSE 0 END), 0)
    INTO v_coef_directo, v_coef_poder
  FROM clasificado;

  RETURN QUERY
  SELECT
    (SELECT COUNT(DISTINCT r.quorum_asamblea_id)::INT
       FROM verificacion_asistencia_registro r
       JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
      WHERE r.asamblea_id = p_asamblea_id
        AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
        AND (NOT p_solo_sesion_actual OR (v_corte IS NOT NULL AND r.creado_en >= v_corte))),
    COALESCE(v_coef_directo, 0),
    COALESCE(v_coef_poder, 0),
    COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0),
    v_coef_total,
    CASE WHEN v_coef_total > 0 THEN ROUND((COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0)) / v_coef_total * 100, 2) ELSE 0 END,
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(v_coef_directo, 0) / v_coef_total * 100, 2) ELSE 0 END,
    CASE WHEN v_coef_total > 0 THEN ROUND(COALESCE(v_coef_poder, 0) / v_coef_total * 100, 2) ELSE 0 END,
    (v_coef_total > 0 AND (COALESCE(v_coef_directo, 0) + COALESCE(v_coef_poder, 0)) / v_coef_total * 100 > 50);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_verificacion_quorum_snapshot(p_asamblea_id uuid, p_corte timestamp with time zone)
 RETURNS TABLE(total_verificados integer, coeficiente_verificado numeric, porcentaje_verificado numeric, quorum_alcanzado boolean)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id  UUID;
  v_is_demo          BOOLEAN;
  v_sandbox_reales   BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_coef_total       NUMERIC(12, 6);
BEGIN
  SELECT
    a.organization_id,
    COALESCE(a.is_demo, false),
    COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_organization_id, v_is_demo, v_sandbox_reales
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  IF NOT FOUND THEN RETURN; END IF;

  v_unidades_is_demo := CASE
    WHEN v_is_demo AND v_sandbox_reales THEN false
    ELSE v_is_demo
  END;

  SELECT COALESCE(SUM(u.coeficiente), 0)
  INTO v_coef_total
  FROM unidades u
  WHERE u.organization_id = v_organization_id
    AND COALESCE(u.is_demo, false) = v_unidades_is_demo;

  RETURN QUERY
  SELECT
    COUNT(qa.id)::INT                                    AS total_verificados,
    COALESCE(SUM(u.coeficiente), 0)::NUMERIC(12, 6)     AS coeficiente_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN ROUND(COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100, 2)
      ELSE 0
    END::NUMERIC(6, 2)                                   AS porcentaje_verificado,
    CASE
      WHEN v_coef_total > 0
      THEN (COALESCE(SUM(u.coeficiente), 0) / v_coef_total * 100) > 50
      ELSE false
    END                                                  AS quorum_alcanzado
  FROM quorum_asamblea qa
  JOIN unidades u
    ON u.id = qa.unidad_id
   AND u.organization_id = v_organization_id
   AND COALESCE(u.is_demo, false) = v_unidades_is_demo
  WHERE qa.asamblea_id = p_asamblea_id
    AND qa.verifico_asistencia = true
    AND (qa.hora_verificacion IS NULL OR qa.hora_verificacion <= p_corte);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cerrar_sesion_votacion_publica(p_asamblea_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE asambleas
  SET
    session_mode = 'inactive',
    session_seq = COALESCE(session_seq, 1) + 1
  WHERE id = p_asamblea_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cerrar_sesiones_verificacion_abiertas(p_asamblea_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pregunta_id            UUID;
  v_total_verificados       INT;
  v_coeficiente_verificado NUMERIC(12, 6);
  v_porcentaje_verificado  NUMERIC(6, 2);
  v_quorum_alcanzado       BOOLEAN;
  rec                      RECORD;
  v_updated                INT := 0;
BEGIN
  SELECT a.verificacion_pregunta_id INTO v_pregunta_id
  FROM asambleas a
  WHERE a.id = p_asamblea_id;

  FOR rec IN
    SELECT * FROM calcular_verificacion_quorum(p_asamblea_id, v_pregunta_id, true) LIMIT 1
  LOOP
    v_total_verificados      := rec.total_verificados;
    v_coeficiente_verificado := rec.coeficiente_verificado;
    v_porcentaje_verificado  := rec.porcentaje_verificado;
    v_quorum_alcanzado       := rec.quorum_alcanzado;
    EXIT;
  END LOOP;

  UPDATE verificacion_asamblea_sesiones
  SET
    cierre_at              = now(),
    total_verificados      = COALESCE(v_total_verificados, 0),
    coeficiente_verificado = COALESCE(v_coeficiente_verificado, 0),
    porcentaje_verificado  = COALESCE(v_porcentaje_verificado, 0),
    quorum_alcanzado       = COALESCE(v_quorum_alcanzado, false),
    pregunta_id            = v_pregunta_id
  WHERE asamblea_id = p_asamblea_id
    AND cierre_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_is_org_owner(org_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = org_id AND owner_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.crear_opciones_por_defecto(p_pregunta_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Solo crear si no existen opciones
  IF NOT EXISTS (SELECT 1 FROM opciones_pregunta WHERE pregunta_id = p_pregunta_id) THEN
    INSERT INTO opciones_pregunta (pregunta_id, texto_opcion, orden, color) VALUES
      (p_pregunta_id, 'A favor', 1, '#10b981'),
      (p_pregunta_id, 'En contra', 2, '#ef4444'),
      (p_pregunta_id, 'Me abstengo', 3, '#6b7280');
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.desactivar_votacion_publica(p_asamblea_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE asambleas
  SET
    acceso_publico = false,
    session_mode = 'inactive',
    session_seq = COALESCE(session_seq, 1) + 1
  WHERE id = p_asamblea_id;

  RETURN 'Acceso público desactivado. Nueva sesión al reactivar (consentimientos previos por secuencia quedan en historial).';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generar_codigo_acceso()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Sin 0,O,1,I para evitar confusión
  result TEXT := '';
  i INT;
BEGIN
  -- Genera código tipo: A2K9-X7M4 (8 caracteres con guión)
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  result := result || '-';
  
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_costo_tokens_conjunto(p_organization_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    (SELECT COUNT(*)::INTEGER FROM unidades WHERE organization_id = p_organization_id),
    0
  );
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_organization()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NULLIF(TRIM(v_name), ''))
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(TRIM(EXCLUDED.full_name), ''), profiles.full_name);
  -- Si la tabla tiene user_id, actualizarlo
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    UPDATE public.profiles SET user_id = NEW.id WHERE id = NEW.id AND (user_id IS NULL OR user_id != NEW.id);
  END IF;
  -- Si la tabla tiene tokens_disponibles, asegurar 50 para nuevos
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tokens_disponibles'
  ) THEN
    UPDATE public.profiles
    SET tokens_disponibles = 50
    WHERE id = NEW.id AND (tokens_disponibles IS NULL OR tokens_disponibles < 0);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_quorum_snapshot(p_asamblea_id uuid, p_snapshot_type quorum_snapshot_type, p_pregunta_id uuid DEFAULT NULL::uuid, p_generated_by_event_id uuid DEFAULT NULL::uuid, p_generated_by_user uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_calc RECORD;
  v_rules JSONB;
BEGIN
  SELECT * INTO v_calc
  FROM calcular_quorum_presencia(p_asamblea_id, p_pregunta_id)
  LIMIT 1;

  SELECT quorum_rules INTO v_rules
  FROM quorum_presence_config
  WHERE asamblea_id = p_asamblea_id;

  IF v_rules IS NULL THEN
    v_rules := '{"thresholdPercent":50}'::jsonb;
  END IF;

  INSERT INTO quorum_snapshot(
    asamblea_id,
    pregunta_id,
    snapshot_type,
    active_participants_count,
    delegated_participants_count,
    active_coefficient_total,
    delegated_coefficient_total,
    total_represented_coefficient,
    total_assembly_coefficient,
    quorum_percentage,
    quorum_rule_applied,
    quorum_met,
    generated_by_event_id,
    generated_by_user,
    metadata
  )
  VALUES (
    p_asamblea_id,
    p_pregunta_id,
    p_snapshot_type,
    COALESCE(v_calc.participantes_activos, 0),
    COALESCE(v_calc.participantes_delegados_activos, 0),
    COALESCE(v_calc.active_coefficient_total, 0),
    COALESCE(v_calc.delegated_coefficient_total, 0),
    COALESCE(v_calc.total_represented_coefficient, 0),
    COALESCE(v_calc.total_assembly_coefficient, 0),
    COALESCE(v_calc.quorum_percentage, 0),
    v_rules,
    COALESCE(v_calc.quorum_met, false),
    p_generated_by_event_id,
    p_generated_by_user,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  INSERT INTO quorum_event_log(
    asamblea_id,
    pregunta_id,
    event_type,
    coefficient_impacted,
    total_quorum_after,
    quorum_percentage_after,
    metadata
  )
  VALUES(
    p_asamblea_id,
    p_pregunta_id,
    'snapshot_created',
    COALESCE(v_calc.total_represented_coefficient, 0),
    COALESCE(v_calc.total_represented_coefficient, 0),
    COALESCE(v_calc.quorum_percentage, 0),
    jsonb_build_object(
      'snapshot_id', v_id,
      'snapshot_type', p_snapshot_type
    )
  );

  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) =
    (SELECT LOWER(TRIM(value)) FROM public.app_config WHERE key = 'super_admin_email' LIMIT 1);
$function$
;
