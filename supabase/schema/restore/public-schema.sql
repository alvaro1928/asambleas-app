-- =============================================================================
-- BACKUP DE ESQUEMA (solo estructura, sin datos)
-- Proyecto: asambleas-saas (zbfwuabsgnrpizckeump)
-- Schema: public
-- Generado: 2026-06-14T21:29:51.434Z
--
-- Restaurar: ver supabase/schema/README.md
-- NO ejecutar scripts sueltos en supabase/*.sql — usar solo este archivo.
-- =============================================================================

SET client_min_messages TO warning;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- Custom ENUM types

DO $$ BEGIN CREATE TYPE public.quorum_event_type AS ENUM ('joined', 'heartbeat', 'activity', 'vote_cast', 'stale', 'offline', 'reconnected', 'quorum_recalculated', 'quorum_lost', 'quorum_recovered', 'admin_override', 'snapshot_created'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quorum_presence_status AS ENUM ('online', 'idle', 'stale', 'offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.quorum_snapshot_type AS ENUM ('assembly_opening', 'voting_opening', 'voting_closing', 'quorum_change', 'assembly_closing', 'manual_check'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables (structure only)

CREATE TABLE IF NOT EXISTS public.app_config (
    key text NOT NULL,
    value text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.asambleas (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    fecha timestamp with time zone NOT NULL,
    estado text NOT NULL DEFAULT 'borrador'::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    codigo_acceso text,
    url_publica text,
    acceso_publico boolean DEFAULT false,
    pago_realizado boolean NOT NULL DEFAULT false,
    is_demo boolean NOT NULL DEFAULT false,
    is_archived boolean NOT NULL DEFAULT false,
    activated_at timestamp with time zone,
    sandbox_usar_unidades_reales boolean NOT NULL DEFAULT false,
    acta_ots_proof_base64 text,
    verificacion_asistencia_activa boolean NOT NULL DEFAULT false,
    token_delegado uuid,
    verificacion_pregunta_id uuid,
    participacion_timer_end_at timestamp with time zone,
    participacion_timer_default_minutes integer NOT NULL DEFAULT 5,
    participacion_timer_enabled boolean NOT NULL DEFAULT true,
    session_mode text NOT NULL DEFAULT 'inactive'::text,
    session_seq integer NOT NULL DEFAULT 1,
    registro_poderes_publico boolean NOT NULL DEFAULT false,
    punto_orden_dia_actual_id uuid
);

CREATE TABLE IF NOT EXISTS public.billing_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    fecha timestamp with time zone NOT NULL DEFAULT now(),
    user_id uuid NOT NULL,
    tipo_operacion text NOT NULL,
    asamblea_id uuid,
    organization_id uuid,
    tokens_usados integer NOT NULL DEFAULT 0,
    saldo_restante integer NOT NULL DEFAULT 0,
    metadata jsonb
);

CREATE TABLE IF NOT EXISTS public.configuracion_asamblea (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    mostrar_quorum boolean NOT NULL DEFAULT true,
    mostrar_delegado boolean NOT NULL DEFAULT true,
    mostrar_cronometro boolean NOT NULL DEFAULT true,
    mostrar_poderes boolean NOT NULL DEFAULT true,
    participacion_timer_default_minutes integer DEFAULT 5,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    mostrar_quorum_tarjetas boolean NOT NULL DEFAULT true,
    mostrar_quorum_historico boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.configuracion_global (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    key text NOT NULL DEFAULT 'landing'::text,
    titulo text,
    subtitulo text,
    whatsapp_number text,
    created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    updated_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    color_principal_hex text,
    precio_por_token_cop bigint,
    bono_bienvenida_tokens integer,
    texto_hero_precio text,
    texto_ahorro text,
    cta_whatsapp_text text,
    acta_blockchain_ots_enabled boolean NOT NULL DEFAULT false,
    ventana_gracia_activacion_dias integer NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS public.configuracion_legal (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    doc_key text NOT NULL,
    titulo text NOT NULL,
    contenido text NOT NULL,
    ultima_actualizacion text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    updated_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text)
);

CREATE TABLE IF NOT EXISTS public.configuracion_poderes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL,
    max_poderes_por_apoderado integer NOT NULL DEFAULT 3,
    requiere_documento boolean DEFAULT false,
    notas text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    plantilla_adicional_correo text,
    plantilla_mensaje_invitacion text,
    permitir_reset_consentimiento_general boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.configuracion_smtp (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    key text NOT NULL DEFAULT 'default'::text,
    host text,
    port integer NOT NULL DEFAULT 465,
    secure boolean NOT NULL DEFAULT true,
    "user" text,
    pass text,
    from_address text,
    created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    updated_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text)
);

CREATE TABLE IF NOT EXISTS public.configuracion_whatsapp (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    key text NOT NULL DEFAULT 'default'::text,
    access_token text,
    phone_number_id text,
    template_name text,
    tokens_por_mensaje_whatsapp integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    updated_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    habilitado boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.consentimiento_tratamiento_datos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asamblea_id uuid NOT NULL,
    identificador text NOT NULL,
    accepted_at timestamp with time zone NOT NULL DEFAULT now(),
    ip_address text,
    session_seq integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.historial_votos (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    voto_id uuid,
    pregunta_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    opcion_id uuid NOT NULL,
    votante_email text NOT NULL,
    votante_nombre text,
    es_poder boolean DEFAULT false,
    poder_id uuid,
    accion text NOT NULL,
    opcion_anterior_id uuid,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.opciones_pregunta (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    pregunta_id uuid NOT NULL,
    texto_opcion text NOT NULL,
    orden integer DEFAULT 1,
    color text DEFAULT '#6366f1'::text,
    votos_count integer DEFAULT 0,
    votos_coeficiente numeric(12,6) DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.organizations (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    address text,
    city text,
    nit text,
    owner_id uuid
);

CREATE TABLE IF NOT EXISTS public.pagos_checkout_ref (
    ref text NOT NULL,
    user_id uuid NOT NULL,
    amount_cents integer,
    created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text)
);

CREATE TABLE IF NOT EXISTS public.pagos_historial (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL,
    amount_cents bigint NOT NULL,
    currency text NOT NULL DEFAULT 'COP'::text,
    external_payment_id text,
    status text NOT NULL DEFAULT 'confirmed'::text,
    description text,
    plan_type text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.pagos_log (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    organization_id uuid,
    monto bigint NOT NULL,
    wompi_transaction_id text,
    estado text NOT NULL DEFAULT 'pending'::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    user_id uuid
);

CREATE TABLE IF NOT EXISTS public.planes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    key text NOT NULL,
    nombre text NOT NULL,
    precio_por_asamblea_cop bigint NOT NULL DEFAULT 0,
    activo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    max_preguntas_por_asamblea integer NOT NULL DEFAULT 2,
    incluye_acta_detallada boolean NOT NULL DEFAULT false,
    tokens_iniciales integer,
    vigencia_meses integer
);

CREATE TABLE IF NOT EXISTS public.poderes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    asamblea_id uuid NOT NULL,
    unidad_otorgante_id uuid NOT NULL,
    unidad_receptor_id uuid,
    email_otorgante text NOT NULL,
    nombre_otorgante text,
    email_receptor text NOT NULL,
    nombre_receptor text,
    estado text NOT NULL DEFAULT 'activo'::text,
    archivo_poder text,
    observaciones text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    revocado_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.preguntas (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    asamblea_id uuid NOT NULL,
    orden integer DEFAULT 1,
    texto_pregunta text NOT NULL,
    descripcion text,
    tipo_votacion text NOT NULL DEFAULT 'coeficiente'::text,
    resultado_json jsonb DEFAULT '{}'::jsonb,
    estado text NOT NULL DEFAULT 'pendiente'::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    umbral_aprobacion numeric(5,2),
    is_archived boolean NOT NULL DEFAULT false,
    punto_orden_dia_id uuid
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    email text,
    full_name text,
    organization_id uuid,
    role text DEFAULT 'member'::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    tokens_disponibles integer NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS public.profiles_temp (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    email text,
    full_name text,
    organization_id uuid,
    role text DEFAULT 'member'::text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.puntos_orden_dia (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asamblea_id uuid NOT NULL,
    orden integer NOT NULL DEFAULT 1,
    titulo text NOT NULL,
    descripcion text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quorum_asamblea (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    asamblea_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    email_propietario text NOT NULL,
    nombre_propietario text,
    presente_fisica boolean DEFAULT false,
    presente_virtual boolean DEFAULT false,
    hora_llegada timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    ultima_actividad timestamp with time zone DEFAULT now(),
    verifico_asistencia boolean NOT NULL DEFAULT false,
    hora_verificacion timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.quorum_event_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asamblea_id uuid NOT NULL,
    presence_id uuid,
    participant_key text,
    pregunta_id uuid,
    event_type quorum_event_type NOT NULL,
    coefficient_impacted numeric(12,6),
    total_quorum_after numeric(12,6),
    quorum_percentage_after numeric(6,2),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quorum_presence (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asamblea_id uuid NOT NULL,
    participant_key text NOT NULL,
    auth_user_id uuid,
    connection_id uuid,
    status quorum_presence_status NOT NULL DEFAULT 'online'::quorum_presence_status,
    joined_at timestamp with time zone NOT NULL DEFAULT now(),
    last_heartbeat_at timestamp with time zone NOT NULL DEFAULT now(),
    last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
    disconnected_at timestamp with time zone,
    reconnected_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quorum_presence_config (
    asamblea_id uuid NOT NULL,
    heartbeat_interval_seconds integer NOT NULL DEFAULT 30,
    idle_after_seconds integer NOT NULL DEFAULT 45,
    stale_after_seconds integer NOT NULL DEFAULT 90,
    offline_after_seconds integer NOT NULL DEFAULT 180,
    quorum_rules jsonb NOT NULL DEFAULT '{"type": "deliberative", "convocatoria": 1, "thresholdPercent": 50}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quorum_presence_units (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    presence_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    poder_id uuid,
    coeficiente_propio numeric(12,6) NOT NULL DEFAULT 0,
    coeficiente_delegado numeric(12,6) NOT NULL DEFAULT 0,
    total_represented_coefficient numeric(12,6) DEFAULT (coeficiente_propio + coeficiente_delegado),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quorum_snapshot (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asamblea_id uuid NOT NULL,
    pregunta_id uuid,
    snapshot_type quorum_snapshot_type NOT NULL,
    taken_at timestamp with time zone NOT NULL DEFAULT now(),
    active_participants_count integer NOT NULL DEFAULT 0,
    delegated_participants_count integer NOT NULL DEFAULT 0,
    active_coefficient_total numeric(12,6) NOT NULL DEFAULT 0,
    delegated_coefficient_total numeric(12,6) NOT NULL DEFAULT 0,
    total_represented_coefficient numeric(12,6) NOT NULL DEFAULT 0,
    total_assembly_coefficient numeric(12,6) NOT NULL DEFAULT 0,
    quorum_percentage numeric(6,2) NOT NULL DEFAULT 0,
    quorum_rule_applied jsonb NOT NULL DEFAULT '{}'::jsonb,
    quorum_met boolean NOT NULL DEFAULT false,
    generated_by_event_id uuid,
    generated_by_user uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.sesion_token_consumos (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asamblea_id uuid NOT NULL,
    session_seq integer NOT NULL,
    unidad_id uuid NOT NULL,
    identificador text NOT NULL,
    tokens_cobrados integer NOT NULL DEFAULT 0,
    consentimiento_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.super_admin_accounts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL,
    full_name text,
    active boolean NOT NULL DEFAULT true,
    created_by_email text,
    updated_by_email text,
    created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
    updated_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text)
);

CREATE TABLE IF NOT EXISTS public.unidades (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    organization_id uuid NOT NULL,
    numero text NOT NULL,
    coeficiente numeric(10,6) NOT NULL,
    tipo text DEFAULT 'apartamento'::text,
    propietario text,
    email_propietario text,
    telefono_propietario text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    torre text,
    nombre_propietario text,
    email text,
    telefono text,
    is_demo boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.verificacion_asamblea_sesiones (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asamblea_id uuid NOT NULL,
    apertura_at timestamp with time zone NOT NULL DEFAULT now(),
    cierre_at timestamp with time zone,
    total_verificados integer,
    coeficiente_verificado numeric(12,6),
    porcentaje_verificado numeric(6,2),
    quorum_alcanzado boolean,
    pregunta_id uuid
);

CREATE TABLE IF NOT EXISTS public.verificacion_asistencia_registro (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    asamblea_id uuid NOT NULL,
    quorum_asamblea_id uuid NOT NULL,
    pregunta_id uuid,
    creado_en timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.votos (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    pregunta_id uuid NOT NULL,
    unidad_id uuid NOT NULL,
    opcion_id uuid NOT NULL,
    votante_email text NOT NULL,
    votante_nombre text,
    es_poder boolean DEFAULT false,
    poder_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    user_agent text
);

-- Primary keys, foreign keys, uniques, checks

ALTER TABLE public.app_config DROP CONSTRAINT IF EXISTS app_config_pkey;
ALTER TABLE public.app_config ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);
ALTER TABLE public.asambleas DROP CONSTRAINT IF EXISTS asambleas_codigo_acceso_key;
ALTER TABLE public.asambleas ADD CONSTRAINT asambleas_codigo_acceso_key UNIQUE (codigo_acceso);
ALTER TABLE public.asambleas DROP CONSTRAINT IF EXISTS asambleas_estado_check;
ALTER TABLE public.asambleas ADD CONSTRAINT asambleas_estado_check CHECK (estado = ANY (ARRAY['borrador'::text, 'activa'::text, 'finalizada'::text]));
ALTER TABLE public.asambleas DROP CONSTRAINT IF EXISTS asambleas_organization_id_fkey;
ALTER TABLE public.asambleas ADD CONSTRAINT asambleas_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.asambleas DROP CONSTRAINT IF EXISTS asambleas_pkey;
ALTER TABLE public.asambleas ADD CONSTRAINT asambleas_pkey PRIMARY KEY (id);
ALTER TABLE public.asambleas DROP CONSTRAINT IF EXISTS asambleas_punto_orden_dia_actual_id_fkey;
ALTER TABLE public.asambleas ADD CONSTRAINT asambleas_punto_orden_dia_actual_id_fkey FOREIGN KEY (punto_orden_dia_actual_id) REFERENCES puntos_orden_dia(id) ON DELETE SET NULL;
ALTER TABLE public.asambleas DROP CONSTRAINT IF EXISTS asambleas_session_mode_check;
ALTER TABLE public.asambleas ADD CONSTRAINT asambleas_session_mode_check CHECK (session_mode = ANY (ARRAY['inactive'::text, 'verification'::text, 'voting'::text]));
ALTER TABLE public.asambleas DROP CONSTRAINT IF EXISTS asambleas_verificacion_pregunta_id_fkey;
ALTER TABLE public.asambleas ADD CONSTRAINT asambleas_verificacion_pregunta_id_fkey FOREIGN KEY (verificacion_pregunta_id) REFERENCES preguntas(id) ON DELETE SET NULL;
ALTER TABLE public.billing_logs DROP CONSTRAINT IF EXISTS billing_logs_pkey;
ALTER TABLE public.billing_logs ADD CONSTRAINT billing_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.billing_logs DROP CONSTRAINT IF EXISTS billing_logs_tipo_operacion_check;
ALTER TABLE public.billing_logs ADD CONSTRAINT billing_logs_tipo_operacion_check CHECK (tipo_operacion = ANY (ARRAY['Acta'::text, 'Votación'::text, 'Registro_manual'::text, 'Compra'::text, 'Ajuste_manual'::text, 'WhatsApp'::text, 'Consentimiento_sesion'::text]));
ALTER TABLE public.configuracion_asamblea DROP CONSTRAINT IF EXISTS configuracion_asamblea_organization_id_fkey;
ALTER TABLE public.configuracion_asamblea ADD CONSTRAINT configuracion_asamblea_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.configuracion_asamblea DROP CONSTRAINT IF EXISTS configuracion_asamblea_pkey;
ALTER TABLE public.configuracion_asamblea ADD CONSTRAINT configuracion_asamblea_pkey PRIMARY KEY (id);
ALTER TABLE public.configuracion_asamblea DROP CONSTRAINT IF EXISTS configuracion_asamblea_user_id_fkey;
ALTER TABLE public.configuracion_asamblea ADD CONSTRAINT configuracion_asamblea_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.configuracion_asamblea DROP CONSTRAINT IF EXISTS configuracion_asamblea_user_id_organization_id_key;
ALTER TABLE public.configuracion_asamblea ADD CONSTRAINT configuracion_asamblea_user_id_organization_id_key UNIQUE (user_id, organization_id);
ALTER TABLE public.configuracion_global DROP CONSTRAINT IF EXISTS configuracion_global_key_key;
ALTER TABLE public.configuracion_global ADD CONSTRAINT configuracion_global_key_key UNIQUE (key);
ALTER TABLE public.configuracion_global DROP CONSTRAINT IF EXISTS configuracion_global_pkey;
ALTER TABLE public.configuracion_global ADD CONSTRAINT configuracion_global_pkey PRIMARY KEY (id);
ALTER TABLE public.configuracion_legal DROP CONSTRAINT IF EXISTS configuracion_legal_doc_key_key;
ALTER TABLE public.configuracion_legal ADD CONSTRAINT configuracion_legal_doc_key_key UNIQUE (doc_key);
ALTER TABLE public.configuracion_legal DROP CONSTRAINT IF EXISTS configuracion_legal_pkey;
ALTER TABLE public.configuracion_legal ADD CONSTRAINT configuracion_legal_pkey PRIMARY KEY (id);
ALTER TABLE public.configuracion_poderes DROP CONSTRAINT IF EXISTS configuracion_poderes_organization_id_fkey;
ALTER TABLE public.configuracion_poderes ADD CONSTRAINT configuracion_poderes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.configuracion_poderes DROP CONSTRAINT IF EXISTS configuracion_poderes_organization_id_key;
ALTER TABLE public.configuracion_poderes ADD CONSTRAINT configuracion_poderes_organization_id_key UNIQUE (organization_id);
ALTER TABLE public.configuracion_poderes DROP CONSTRAINT IF EXISTS configuracion_poderes_pkey;
ALTER TABLE public.configuracion_poderes ADD CONSTRAINT configuracion_poderes_pkey PRIMARY KEY (id);
ALTER TABLE public.configuracion_smtp DROP CONSTRAINT IF EXISTS configuracion_smtp_key_key;
ALTER TABLE public.configuracion_smtp ADD CONSTRAINT configuracion_smtp_key_key UNIQUE (key);
ALTER TABLE public.configuracion_smtp DROP CONSTRAINT IF EXISTS configuracion_smtp_pkey;
ALTER TABLE public.configuracion_smtp ADD CONSTRAINT configuracion_smtp_pkey PRIMARY KEY (id);
ALTER TABLE public.configuracion_whatsapp DROP CONSTRAINT IF EXISTS configuracion_whatsapp_key_key;
ALTER TABLE public.configuracion_whatsapp ADD CONSTRAINT configuracion_whatsapp_key_key UNIQUE (key);
ALTER TABLE public.configuracion_whatsapp DROP CONSTRAINT IF EXISTS configuracion_whatsapp_pkey;
ALTER TABLE public.configuracion_whatsapp ADD CONSTRAINT configuracion_whatsapp_pkey PRIMARY KEY (id);
ALTER TABLE public.consentimiento_tratamiento_datos DROP CONSTRAINT IF EXISTS consentimiento_tratamiento_datos_asamblea_id_fkey;
ALTER TABLE public.consentimiento_tratamiento_datos ADD CONSTRAINT consentimiento_tratamiento_datos_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.consentimiento_tratamiento_datos DROP CONSTRAINT IF EXISTS consentimiento_tratamiento_datos_asamblea_ident_session_uq;
ALTER TABLE public.consentimiento_tratamiento_datos ADD CONSTRAINT consentimiento_tratamiento_datos_asamblea_ident_session_uq UNIQUE (asamblea_id, identificador, session_seq);
ALTER TABLE public.consentimiento_tratamiento_datos DROP CONSTRAINT IF EXISTS consentimiento_tratamiento_datos_pkey;
ALTER TABLE public.consentimiento_tratamiento_datos ADD CONSTRAINT consentimiento_tratamiento_datos_pkey PRIMARY KEY (id);
ALTER TABLE public.historial_votos DROP CONSTRAINT IF EXISTS historial_votos_accion_check;
ALTER TABLE public.historial_votos ADD CONSTRAINT historial_votos_accion_check CHECK (accion = ANY (ARRAY['crear'::text, 'modificar'::text]));
ALTER TABLE public.historial_votos DROP CONSTRAINT IF EXISTS historial_votos_opcion_anterior_id_fkey;
ALTER TABLE public.historial_votos ADD CONSTRAINT historial_votos_opcion_anterior_id_fkey FOREIGN KEY (opcion_anterior_id) REFERENCES opciones_pregunta(id);
ALTER TABLE public.historial_votos DROP CONSTRAINT IF EXISTS historial_votos_opcion_id_fkey;
ALTER TABLE public.historial_votos ADD CONSTRAINT historial_votos_opcion_id_fkey FOREIGN KEY (opcion_id) REFERENCES opciones_pregunta(id) ON DELETE CASCADE;
ALTER TABLE public.historial_votos DROP CONSTRAINT IF EXISTS historial_votos_pkey;
ALTER TABLE public.historial_votos ADD CONSTRAINT historial_votos_pkey PRIMARY KEY (id);
ALTER TABLE public.historial_votos DROP CONSTRAINT IF EXISTS historial_votos_poder_id_fkey;
ALTER TABLE public.historial_votos ADD CONSTRAINT historial_votos_poder_id_fkey FOREIGN KEY (poder_id) REFERENCES poderes(id);
ALTER TABLE public.historial_votos DROP CONSTRAINT IF EXISTS historial_votos_pregunta_id_fkey;
ALTER TABLE public.historial_votos ADD CONSTRAINT historial_votos_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE CASCADE;
ALTER TABLE public.historial_votos DROP CONSTRAINT IF EXISTS historial_votos_unidad_id_fkey;
ALTER TABLE public.historial_votos ADD CONSTRAINT historial_votos_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE;
ALTER TABLE public.historial_votos DROP CONSTRAINT IF EXISTS historial_votos_voto_id_fkey;
ALTER TABLE public.historial_votos ADD CONSTRAINT historial_votos_voto_id_fkey FOREIGN KEY (voto_id) REFERENCES votos(id) ON DELETE CASCADE;
ALTER TABLE public.opciones_pregunta DROP CONSTRAINT IF EXISTS opciones_pregunta_pkey;
ALTER TABLE public.opciones_pregunta ADD CONSTRAINT opciones_pregunta_pkey PRIMARY KEY (id);
ALTER TABLE public.opciones_pregunta DROP CONSTRAINT IF EXISTS opciones_pregunta_pregunta_id_fkey;
ALTER TABLE public.opciones_pregunta ADD CONSTRAINT opciones_pregunta_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE CASCADE;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_owner_id_fkey;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_pkey;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_slug_key;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS unique_organization_nit;
ALTER TABLE public.organizations ADD CONSTRAINT unique_organization_nit UNIQUE (nit);
ALTER TABLE public.pagos_checkout_ref DROP CONSTRAINT IF EXISTS pagos_checkout_ref_pkey;
ALTER TABLE public.pagos_checkout_ref ADD CONSTRAINT pagos_checkout_ref_pkey PRIMARY KEY (ref);
ALTER TABLE public.pagos_historial DROP CONSTRAINT IF EXISTS pagos_historial_organization_id_fkey;
ALTER TABLE public.pagos_historial ADD CONSTRAINT pagos_historial_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.pagos_historial DROP CONSTRAINT IF EXISTS pagos_historial_pkey;
ALTER TABLE public.pagos_historial ADD CONSTRAINT pagos_historial_pkey PRIMARY KEY (id);
ALTER TABLE public.pagos_historial DROP CONSTRAINT IF EXISTS pagos_historial_status_check;
ALTER TABLE public.pagos_historial ADD CONSTRAINT pagos_historial_status_check CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'failed'::text, 'refunded'::text]));
ALTER TABLE public.pagos_log DROP CONSTRAINT IF EXISTS pagos_log_organization_id_fkey;
ALTER TABLE public.pagos_log ADD CONSTRAINT pagos_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.pagos_log DROP CONSTRAINT IF EXISTS pagos_log_pkey;
ALTER TABLE public.pagos_log ADD CONSTRAINT pagos_log_pkey PRIMARY KEY (id);
ALTER TABLE public.pagos_log DROP CONSTRAINT IF EXISTS pagos_log_user_id_fkey;
ALTER TABLE public.pagos_log ADD CONSTRAINT pagos_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.planes DROP CONSTRAINT IF EXISTS planes_key_key;
ALTER TABLE public.planes ADD CONSTRAINT planes_key_key UNIQUE (key);
ALTER TABLE public.planes DROP CONSTRAINT IF EXISTS planes_pkey;
ALTER TABLE public.planes ADD CONSTRAINT planes_pkey PRIMARY KEY (id);
ALTER TABLE public.poderes DROP CONSTRAINT IF EXISTS poderes_asamblea_id_fkey;
ALTER TABLE public.poderes ADD CONSTRAINT poderes_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.poderes DROP CONSTRAINT IF EXISTS poderes_estado_check;
ALTER TABLE public.poderes ADD CONSTRAINT poderes_estado_check CHECK (estado = ANY (ARRAY['activo'::text, 'revocado'::text, 'usado'::text, 'pendiente_verificacion'::text]));
ALTER TABLE public.poderes DROP CONSTRAINT IF EXISTS poderes_pkey;
ALTER TABLE public.poderes ADD CONSTRAINT poderes_pkey PRIMARY KEY (id);
ALTER TABLE public.poderes DROP CONSTRAINT IF EXISTS poderes_unidad_otorgante_id_fkey;
ALTER TABLE public.poderes ADD CONSTRAINT poderes_unidad_otorgante_id_fkey FOREIGN KEY (unidad_otorgante_id) REFERENCES unidades(id) ON DELETE CASCADE;
ALTER TABLE public.poderes DROP CONSTRAINT IF EXISTS poderes_unidad_receptor_id_fkey;
ALTER TABLE public.poderes ADD CONSTRAINT poderes_unidad_receptor_id_fkey FOREIGN KEY (unidad_receptor_id) REFERENCES unidades(id) ON DELETE CASCADE;
ALTER TABLE public.preguntas DROP CONSTRAINT IF EXISTS preguntas_asamblea_id_fkey;
ALTER TABLE public.preguntas ADD CONSTRAINT preguntas_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.preguntas DROP CONSTRAINT IF EXISTS preguntas_estado_check;
ALTER TABLE public.preguntas ADD CONSTRAINT preguntas_estado_check CHECK (estado = ANY (ARRAY['pendiente'::text, 'abierta'::text, 'cerrada'::text]));
ALTER TABLE public.preguntas DROP CONSTRAINT IF EXISTS preguntas_pkey;
ALTER TABLE public.preguntas ADD CONSTRAINT preguntas_pkey PRIMARY KEY (id);
ALTER TABLE public.preguntas DROP CONSTRAINT IF EXISTS preguntas_punto_orden_dia_id_fkey;
ALTER TABLE public.preguntas ADD CONSTRAINT preguntas_punto_orden_dia_id_fkey FOREIGN KEY (punto_orden_dia_id) REFERENCES puntos_orden_dia(id) ON DELETE SET NULL;
ALTER TABLE public.preguntas DROP CONSTRAINT IF EXISTS preguntas_tipo_votacion_check;
ALTER TABLE public.preguntas ADD CONSTRAINT preguntas_tipo_votacion_check CHECK (tipo_votacion = ANY (ARRAY['coeficiente'::text, 'nominal'::text]));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_new_organization_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_new_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_new_pkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_new_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_new_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_new_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_new_user_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_new_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_new_user_id_organization_id_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_new_user_id_organization_id_key UNIQUE (user_id, organization_id);
ALTER TABLE public.profiles_temp DROP CONSTRAINT IF EXISTS profiles_temp_organization_id_fkey;
ALTER TABLE public.profiles_temp ADD CONSTRAINT profiles_temp_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.profiles_temp DROP CONSTRAINT IF EXISTS profiles_temp_pkey;
ALTER TABLE public.profiles_temp ADD CONSTRAINT profiles_temp_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles_temp DROP CONSTRAINT IF EXISTS profiles_temp_role_check;
ALTER TABLE public.profiles_temp ADD CONSTRAINT profiles_temp_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]));
ALTER TABLE public.profiles_temp DROP CONSTRAINT IF EXISTS profiles_temp_user_id_fkey;
ALTER TABLE public.profiles_temp ADD CONSTRAINT profiles_temp_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles_temp DROP CONSTRAINT IF EXISTS profiles_temp_user_id_organization_id_key;
ALTER TABLE public.profiles_temp ADD CONSTRAINT profiles_temp_user_id_organization_id_key UNIQUE (user_id, organization_id);
ALTER TABLE public.puntos_orden_dia DROP CONSTRAINT IF EXISTS puntos_orden_dia_asamblea_id_fkey;
ALTER TABLE public.puntos_orden_dia ADD CONSTRAINT puntos_orden_dia_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.puntos_orden_dia DROP CONSTRAINT IF EXISTS puntos_orden_dia_pkey;
ALTER TABLE public.puntos_orden_dia ADD CONSTRAINT puntos_orden_dia_pkey PRIMARY KEY (id);
ALTER TABLE public.quorum_asamblea DROP CONSTRAINT IF EXISTS quorum_asamblea_asamblea_id_fkey;
ALTER TABLE public.quorum_asamblea ADD CONSTRAINT quorum_asamblea_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.quorum_asamblea DROP CONSTRAINT IF EXISTS quorum_asamblea_asamblea_id_unidad_id_key;
ALTER TABLE public.quorum_asamblea ADD CONSTRAINT quorum_asamblea_asamblea_id_unidad_id_key UNIQUE (asamblea_id, unidad_id);
ALTER TABLE public.quorum_asamblea DROP CONSTRAINT IF EXISTS quorum_asamblea_pkey;
ALTER TABLE public.quorum_asamblea ADD CONSTRAINT quorum_asamblea_pkey PRIMARY KEY (id);
ALTER TABLE public.quorum_asamblea DROP CONSTRAINT IF EXISTS quorum_asamblea_unidad_id_fkey;
ALTER TABLE public.quorum_asamblea ADD CONSTRAINT quorum_asamblea_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE;
ALTER TABLE public.quorum_event_log DROP CONSTRAINT IF EXISTS quorum_event_log_asamblea_id_fkey;
ALTER TABLE public.quorum_event_log ADD CONSTRAINT quorum_event_log_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.quorum_event_log DROP CONSTRAINT IF EXISTS quorum_event_log_asamblea_id_idempotency_key_key;
ALTER TABLE public.quorum_event_log ADD CONSTRAINT quorum_event_log_asamblea_id_idempotency_key_key UNIQUE (asamblea_id, idempotency_key);
ALTER TABLE public.quorum_event_log DROP CONSTRAINT IF EXISTS quorum_event_log_pkey;
ALTER TABLE public.quorum_event_log ADD CONSTRAINT quorum_event_log_pkey PRIMARY KEY (id);
ALTER TABLE public.quorum_event_log DROP CONSTRAINT IF EXISTS quorum_event_log_pregunta_id_fkey;
ALTER TABLE public.quorum_event_log ADD CONSTRAINT quorum_event_log_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE SET NULL;
ALTER TABLE public.quorum_event_log DROP CONSTRAINT IF EXISTS quorum_event_log_presence_id_fkey;
ALTER TABLE public.quorum_event_log ADD CONSTRAINT quorum_event_log_presence_id_fkey FOREIGN KEY (presence_id) REFERENCES quorum_presence(id) ON DELETE SET NULL;
ALTER TABLE public.quorum_presence DROP CONSTRAINT IF EXISTS quorum_presence_asamblea_id_fkey;
ALTER TABLE public.quorum_presence ADD CONSTRAINT quorum_presence_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.quorum_presence DROP CONSTRAINT IF EXISTS quorum_presence_asamblea_id_participant_key_key;
ALTER TABLE public.quorum_presence ADD CONSTRAINT quorum_presence_asamblea_id_participant_key_key UNIQUE (asamblea_id, participant_key);
ALTER TABLE public.quorum_presence DROP CONSTRAINT IF EXISTS quorum_presence_pkey;
ALTER TABLE public.quorum_presence ADD CONSTRAINT quorum_presence_pkey PRIMARY KEY (id);
ALTER TABLE public.quorum_presence_config DROP CONSTRAINT IF EXISTS quorum_presence_config_asamblea_id_fkey;
ALTER TABLE public.quorum_presence_config ADD CONSTRAINT quorum_presence_config_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.quorum_presence_config DROP CONSTRAINT IF EXISTS quorum_presence_config_heartbeat_interval_seconds_check;
ALTER TABLE public.quorum_presence_config ADD CONSTRAINT quorum_presence_config_heartbeat_interval_seconds_check CHECK (heartbeat_interval_seconds >= 5 AND heartbeat_interval_seconds <= 120);
ALTER TABLE public.quorum_presence_config DROP CONSTRAINT IF EXISTS quorum_presence_config_idle_after_seconds_check;
ALTER TABLE public.quorum_presence_config ADD CONSTRAINT quorum_presence_config_idle_after_seconds_check CHECK (idle_after_seconds >= 15 AND idle_after_seconds <= 900);
ALTER TABLE public.quorum_presence_config DROP CONSTRAINT IF EXISTS quorum_presence_config_offline_after_seconds_check;
ALTER TABLE public.quorum_presence_config ADD CONSTRAINT quorum_presence_config_offline_after_seconds_check CHECK (offline_after_seconds >= 60 AND offline_after_seconds <= 3600);
ALTER TABLE public.quorum_presence_config DROP CONSTRAINT IF EXISTS quorum_presence_config_pkey;
ALTER TABLE public.quorum_presence_config ADD CONSTRAINT quorum_presence_config_pkey PRIMARY KEY (asamblea_id);
ALTER TABLE public.quorum_presence_config DROP CONSTRAINT IF EXISTS quorum_presence_config_stale_after_seconds_check;
ALTER TABLE public.quorum_presence_config ADD CONSTRAINT quorum_presence_config_stale_after_seconds_check CHECK (stale_after_seconds >= 30 AND stale_after_seconds <= 1800);
ALTER TABLE public.quorum_presence_units DROP CONSTRAINT IF EXISTS quorum_presence_units_pkey;
ALTER TABLE public.quorum_presence_units ADD CONSTRAINT quorum_presence_units_pkey PRIMARY KEY (id);
ALTER TABLE public.quorum_presence_units DROP CONSTRAINT IF EXISTS quorum_presence_units_poder_id_fkey;
ALTER TABLE public.quorum_presence_units ADD CONSTRAINT quorum_presence_units_poder_id_fkey FOREIGN KEY (poder_id) REFERENCES poderes(id) ON DELETE SET NULL;
ALTER TABLE public.quorum_presence_units DROP CONSTRAINT IF EXISTS quorum_presence_units_presence_id_fkey;
ALTER TABLE public.quorum_presence_units ADD CONSTRAINT quorum_presence_units_presence_id_fkey FOREIGN KEY (presence_id) REFERENCES quorum_presence(id) ON DELETE CASCADE;
ALTER TABLE public.quorum_presence_units DROP CONSTRAINT IF EXISTS quorum_presence_units_presence_id_unidad_id_key;
ALTER TABLE public.quorum_presence_units ADD CONSTRAINT quorum_presence_units_presence_id_unidad_id_key UNIQUE (presence_id, unidad_id);
ALTER TABLE public.quorum_presence_units DROP CONSTRAINT IF EXISTS quorum_presence_units_unidad_id_fkey;
ALTER TABLE public.quorum_presence_units ADD CONSTRAINT quorum_presence_units_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE;
ALTER TABLE public.quorum_snapshot DROP CONSTRAINT IF EXISTS quorum_snapshot_asamblea_id_fkey;
ALTER TABLE public.quorum_snapshot ADD CONSTRAINT quorum_snapshot_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.quorum_snapshot DROP CONSTRAINT IF EXISTS quorum_snapshot_generated_by_event_id_fkey;
ALTER TABLE public.quorum_snapshot ADD CONSTRAINT quorum_snapshot_generated_by_event_id_fkey FOREIGN KEY (generated_by_event_id) REFERENCES quorum_event_log(id) ON DELETE SET NULL;
ALTER TABLE public.quorum_snapshot DROP CONSTRAINT IF EXISTS quorum_snapshot_pkey;
ALTER TABLE public.quorum_snapshot ADD CONSTRAINT quorum_snapshot_pkey PRIMARY KEY (id);
ALTER TABLE public.quorum_snapshot DROP CONSTRAINT IF EXISTS quorum_snapshot_pregunta_id_fkey;
ALTER TABLE public.quorum_snapshot ADD CONSTRAINT quorum_snapshot_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE SET NULL;
ALTER TABLE public.sesion_token_consumos DROP CONSTRAINT IF EXISTS sesion_token_consumos_asamblea_id_fkey;
ALTER TABLE public.sesion_token_consumos ADD CONSTRAINT sesion_token_consumos_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.sesion_token_consumos DROP CONSTRAINT IF EXISTS sesion_token_consumos_asamblea_id_session_seq_unidad_id_key;
ALTER TABLE public.sesion_token_consumos ADD CONSTRAINT sesion_token_consumos_asamblea_id_session_seq_unidad_id_key UNIQUE (asamblea_id, session_seq, unidad_id);
ALTER TABLE public.sesion_token_consumos DROP CONSTRAINT IF EXISTS sesion_token_consumos_consentimiento_id_fkey;
ALTER TABLE public.sesion_token_consumos ADD CONSTRAINT sesion_token_consumos_consentimiento_id_fkey FOREIGN KEY (consentimiento_id) REFERENCES consentimiento_tratamiento_datos(id) ON DELETE SET NULL;
ALTER TABLE public.sesion_token_consumos DROP CONSTRAINT IF EXISTS sesion_token_consumos_pkey;
ALTER TABLE public.sesion_token_consumos ADD CONSTRAINT sesion_token_consumos_pkey PRIMARY KEY (id);
ALTER TABLE public.sesion_token_consumos DROP CONSTRAINT IF EXISTS sesion_token_consumos_tokens_cobrados_check;
ALTER TABLE public.sesion_token_consumos ADD CONSTRAINT sesion_token_consumos_tokens_cobrados_check CHECK (tokens_cobrados >= 0);
ALTER TABLE public.sesion_token_consumos DROP CONSTRAINT IF EXISTS sesion_token_consumos_unidad_id_fkey;
ALTER TABLE public.sesion_token_consumos ADD CONSTRAINT sesion_token_consumos_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE;
ALTER TABLE public.super_admin_accounts DROP CONSTRAINT IF EXISTS super_admin_accounts_email_key;
ALTER TABLE public.super_admin_accounts ADD CONSTRAINT super_admin_accounts_email_key UNIQUE (email);
ALTER TABLE public.super_admin_accounts DROP CONSTRAINT IF EXISTS super_admin_accounts_pkey;
ALTER TABLE public.super_admin_accounts ADD CONSTRAINT super_admin_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS unidades_organization_id_fkey;
ALTER TABLE public.unidades ADD CONSTRAINT unidades_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS unidades_pkey;
ALTER TABLE public.unidades ADD CONSTRAINT unidades_pkey PRIMARY KEY (id);
ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS unique_unidad_torre_numero;
ALTER TABLE public.unidades ADD CONSTRAINT unique_unidad_torre_numero UNIQUE (organization_id, torre, numero);
ALTER TABLE public.verificacion_asamblea_sesiones DROP CONSTRAINT IF EXISTS verificacion_asamblea_sesiones_asamblea_id_fkey;
ALTER TABLE public.verificacion_asamblea_sesiones ADD CONSTRAINT verificacion_asamblea_sesiones_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.verificacion_asamblea_sesiones DROP CONSTRAINT IF EXISTS verificacion_asamblea_sesiones_pkey;
ALTER TABLE public.verificacion_asamblea_sesiones ADD CONSTRAINT verificacion_asamblea_sesiones_pkey PRIMARY KEY (id);
ALTER TABLE public.verificacion_asamblea_sesiones DROP CONSTRAINT IF EXISTS verificacion_asamblea_sesiones_pregunta_id_fkey;
ALTER TABLE public.verificacion_asamblea_sesiones ADD CONSTRAINT verificacion_asamblea_sesiones_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE SET NULL;
ALTER TABLE public.verificacion_asistencia_registro DROP CONSTRAINT IF EXISTS verificacion_asistencia_regis_quorum_asamblea_id_pregunta_i_key;
ALTER TABLE public.verificacion_asistencia_registro ADD CONSTRAINT verificacion_asistencia_regis_quorum_asamblea_id_pregunta_i_key UNIQUE (quorum_asamblea_id, pregunta_id);
ALTER TABLE public.verificacion_asistencia_registro DROP CONSTRAINT IF EXISTS verificacion_asistencia_registro_asamblea_id_fkey;
ALTER TABLE public.verificacion_asistencia_registro ADD CONSTRAINT verificacion_asistencia_registro_asamblea_id_fkey FOREIGN KEY (asamblea_id) REFERENCES asambleas(id) ON DELETE CASCADE;
ALTER TABLE public.verificacion_asistencia_registro DROP CONSTRAINT IF EXISTS verificacion_asistencia_registro_pkey;
ALTER TABLE public.verificacion_asistencia_registro ADD CONSTRAINT verificacion_asistencia_registro_pkey PRIMARY KEY (id);
ALTER TABLE public.verificacion_asistencia_registro DROP CONSTRAINT IF EXISTS verificacion_asistencia_registro_pregunta_id_fkey;
ALTER TABLE public.verificacion_asistencia_registro ADD CONSTRAINT verificacion_asistencia_registro_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE CASCADE;
ALTER TABLE public.verificacion_asistencia_registro DROP CONSTRAINT IF EXISTS verificacion_asistencia_registro_quorum_asamblea_id_fkey;
ALTER TABLE public.verificacion_asistencia_registro ADD CONSTRAINT verificacion_asistencia_registro_quorum_asamblea_id_fkey FOREIGN KEY (quorum_asamblea_id) REFERENCES quorum_asamblea(id) ON DELETE CASCADE;
ALTER TABLE public.votos DROP CONSTRAINT IF EXISTS votos_opcion_id_fkey;
ALTER TABLE public.votos ADD CONSTRAINT votos_opcion_id_fkey FOREIGN KEY (opcion_id) REFERENCES opciones_pregunta(id) ON DELETE CASCADE;
ALTER TABLE public.votos DROP CONSTRAINT IF EXISTS votos_pkey;
ALTER TABLE public.votos ADD CONSTRAINT votos_pkey PRIMARY KEY (id);
ALTER TABLE public.votos DROP CONSTRAINT IF EXISTS votos_poder_id_fkey;
ALTER TABLE public.votos ADD CONSTRAINT votos_poder_id_fkey FOREIGN KEY (poder_id) REFERENCES poderes(id);
ALTER TABLE public.votos DROP CONSTRAINT IF EXISTS votos_pregunta_id_fkey;
ALTER TABLE public.votos ADD CONSTRAINT votos_pregunta_id_fkey FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE CASCADE;
ALTER TABLE public.votos DROP CONSTRAINT IF EXISTS votos_pregunta_id_unidad_id_key;
ALTER TABLE public.votos ADD CONSTRAINT votos_pregunta_id_unidad_id_key UNIQUE (pregunta_id, unidad_id);
ALTER TABLE public.votos DROP CONSTRAINT IF EXISTS votos_unidad_id_fkey;
ALTER TABLE public.votos ADD CONSTRAINT votos_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- Indexes

CREATE \1INDEX IF NOT EXISTS app_config_pkey ON public.app_config USING btree (key);
CREATE \1INDEX IF NOT EXISTS asambleas_codigo_acceso_key ON public.asambleas USING btree (codigo_acceso);
CREATE \1INDEX IF NOT EXISTS asambleas_pkey ON public.asambleas USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_acceso_publico ON public.asambleas USING btree (acceso_publico) WHERE (acceso_publico = true);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_activated_at ON public.asambleas USING btree (activated_at) WHERE (activated_at IS NOT NULL);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_codigo ON public.asambleas USING btree (codigo_acceso) WHERE (codigo_acceso IS NOT NULL);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_estado ON public.asambleas USING btree (estado);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_fk_asambleas_verificacion_pregunta_id_fkey ON public.asambleas USING btree (verificacion_pregunta_id);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_is_archived ON public.asambleas USING btree (is_archived) WHERE (is_archived = true);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_is_demo ON public.asambleas USING btree (is_demo) WHERE (is_demo = true);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_organization_id ON public.asambleas USING btree (organization_id);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_pago_realizado ON public.asambleas USING btree (pago_realizado) WHERE (pago_realizado = true);
CREATE \1INDEX IF NOT EXISTS idx_asambleas_token_delegado ON public.asambleas USING btree (token_delegado) WHERE (token_delegado IS NOT NULL);
CREATE \1INDEX IF NOT EXISTS billing_logs_pkey ON public.billing_logs USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_billing_logs_fecha ON public.billing_logs USING btree (fecha DESC);
CREATE \1INDEX IF NOT EXISTS idx_billing_logs_user_id ON public.billing_logs USING btree (user_id);
CREATE \1INDEX IF NOT EXISTS configuracion_asamblea_pkey ON public.configuracion_asamblea USING btree (id);
CREATE \1INDEX IF NOT EXISTS configuracion_asamblea_user_id_organization_id_key ON public.configuracion_asamblea USING btree (user_id, organization_id);
CREATE \1INDEX IF NOT EXISTS idx_configuracion_asamblea_fk_configuracion_asamblea_organizati ON public.configuracion_asamblea USING btree (organization_id);
CREATE \1INDEX IF NOT EXISTS idx_configuracion_asamblea_user_org ON public.configuracion_asamblea USING btree (user_id, organization_id);
CREATE \1INDEX IF NOT EXISTS configuracion_global_key_key ON public.configuracion_global USING btree (key);
CREATE \1INDEX IF NOT EXISTS configuracion_global_pkey ON public.configuracion_global USING btree (id);
CREATE \1INDEX IF NOT EXISTS configuracion_legal_doc_key_key ON public.configuracion_legal USING btree (doc_key);
CREATE \1INDEX IF NOT EXISTS configuracion_legal_pkey ON public.configuracion_legal USING btree (id);
CREATE \1INDEX IF NOT EXISTS configuracion_poderes_organization_id_key ON public.configuracion_poderes USING btree (organization_id);
CREATE \1INDEX IF NOT EXISTS configuracion_poderes_pkey ON public.configuracion_poderes USING btree (id);
CREATE \1INDEX IF NOT EXISTS configuracion_smtp_key_key ON public.configuracion_smtp USING btree (key);
CREATE \1INDEX IF NOT EXISTS configuracion_smtp_pkey ON public.configuracion_smtp USING btree (id);
CREATE \1INDEX IF NOT EXISTS configuracion_whatsapp_key_key ON public.configuracion_whatsapp USING btree (key);
CREATE \1INDEX IF NOT EXISTS configuracion_whatsapp_pkey ON public.configuracion_whatsapp USING btree (id);
CREATE \1INDEX IF NOT EXISTS consentimiento_tratamiento_datos_asamblea_ident_session_uq ON public.consentimiento_tratamiento_datos USING btree (asamblea_id, identificador, session_seq);
CREATE \1INDEX IF NOT EXISTS consentimiento_tratamiento_datos_pkey ON public.consentimiento_tratamiento_datos USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_consentimiento_asamblea_identificador ON public.consentimiento_tratamiento_datos USING btree (asamblea_id, identificador);
CREATE \1INDEX IF NOT EXISTS historial_votos_pkey ON public.historial_votos USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_historial_fecha ON public.historial_votos USING btree (created_at);
CREATE \1INDEX IF NOT EXISTS idx_historial_pregunta ON public.historial_votos USING btree (pregunta_id);
CREATE \1INDEX IF NOT EXISTS idx_historial_unidad ON public.historial_votos USING btree (unidad_id);
CREATE \1INDEX IF NOT EXISTS idx_historial_votante ON public.historial_votos USING btree (votante_email);
CREATE \1INDEX IF NOT EXISTS idx_historial_votos_fk_historial_votos_opcion_anterior_id_fkey ON public.historial_votos USING btree (opcion_anterior_id);
CREATE \1INDEX IF NOT EXISTS idx_historial_votos_fk_historial_votos_opcion_id_fkey ON public.historial_votos USING btree (opcion_id);
CREATE \1INDEX IF NOT EXISTS idx_historial_votos_fk_historial_votos_poder_id_fkey ON public.historial_votos USING btree (poder_id);
CREATE \1INDEX IF NOT EXISTS idx_historial_votos_fk_historial_votos_voto_id_fkey ON public.historial_votos USING btree (voto_id);
CREATE \1INDEX IF NOT EXISTS idx_opciones_pregunta_pregunta_id ON public.opciones_pregunta USING btree (pregunta_id);
CREATE \1INDEX IF NOT EXISTS idx_opciones_pregunta_pregunta_orden ON public.opciones_pregunta USING btree (pregunta_id, orden);
CREATE \1INDEX IF NOT EXISTS opciones_pregunta_pkey ON public.opciones_pregunta USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_organizations_fk_organizations_owner_id_fkey ON public.organizations USING btree (owner_id);
CREATE \1INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations USING btree (slug);
CREATE \1INDEX IF NOT EXISTS organizations_pkey ON public.organizations USING btree (id);
CREATE \1INDEX IF NOT EXISTS organizations_slug_key ON public.organizations USING btree (slug);
CREATE \1INDEX IF NOT EXISTS unique_organization_nit ON public.organizations USING btree (nit);
CREATE \1INDEX IF NOT EXISTS idx_pagos_checkout_ref_created_at ON public.pagos_checkout_ref USING btree (created_at);
CREATE \1INDEX IF NOT EXISTS pagos_checkout_ref_pkey ON public.pagos_checkout_ref USING btree (ref);
CREATE \1INDEX IF NOT EXISTS idx_pagos_historial_created_at ON public.pagos_historial USING btree (created_at DESC);
CREATE \1INDEX IF NOT EXISTS idx_pagos_historial_external_id ON public.pagos_historial USING btree (external_payment_id) WHERE (external_payment_id IS NOT NULL);
CREATE \1INDEX IF NOT EXISTS idx_pagos_historial_organization_id ON public.pagos_historial USING btree (organization_id);
CREATE \1INDEX IF NOT EXISTS pagos_historial_pkey ON public.pagos_historial USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_pagos_log_created_at ON public.pagos_log USING btree (created_at DESC);
CREATE \1INDEX IF NOT EXISTS idx_pagos_log_organization_id ON public.pagos_log USING btree (organization_id);
CREATE \1INDEX IF NOT EXISTS idx_pagos_log_user_id ON public.pagos_log USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE \1INDEX IF NOT EXISTS idx_pagos_log_wompi_transaction_id ON public.pagos_log USING btree (wompi_transaction_id) WHERE (wompi_transaction_id IS NOT NULL);
CREATE \1INDEX IF NOT EXISTS pagos_log_pkey ON public.pagos_log USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_planes_activo ON public.planes USING btree (activo) WHERE (activo = true);
CREATE \1INDEX IF NOT EXISTS idx_planes_key ON public.planes USING btree (key);
CREATE \1INDEX IF NOT EXISTS planes_key_key ON public.planes USING btree (key);
CREATE \1INDEX IF NOT EXISTS planes_pkey ON public.planes USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_poderes_asamblea ON public.poderes USING btree (asamblea_id);
CREATE \1INDEX IF NOT EXISTS idx_poderes_asamblea_estado_cover ON public.poderes USING btree (asamblea_id, estado) INCLUDE (unidad_otorgante_id, email_receptor);
CREATE \1INDEX IF NOT EXISTS idx_poderes_asamblea_estado_email_lower ON public.poderes USING btree (asamblea_id, estado, lower(email_receptor));
CREATE \1INDEX IF NOT EXISTS idx_poderes_asamblea_estado_unidad_otorgante ON public.poderes USING btree (asamblea_id, estado, unidad_otorgante_id);
CREATE \1INDEX IF NOT EXISTS idx_poderes_estado ON public.poderes USING btree (estado);
CREATE \1INDEX IF NOT EXISTS idx_poderes_fk_poderes_unidad_otorgante_id_fkey ON public.poderes USING btree (unidad_otorgante_id);
CREATE \1INDEX IF NOT EXISTS idx_poderes_fk_poderes_unidad_receptor_id_fkey ON public.poderes USING btree (unidad_receptor_id);
CREATE \1INDEX IF NOT EXISTS idx_poderes_receptor ON public.poderes USING btree (email_receptor);
CREATE \1INDEX IF NOT EXISTS poderes_activo_o_pendiente_otorgante_email ON public.poderes USING btree (asamblea_id, unidad_otorgante_id, lower(TRIM(BOTH FROM email_receptor))) WHERE (estado = ANY (ARRAY['activo'::text, 'pendiente_verificacion'::text]));
CREATE \1INDEX IF NOT EXISTS poderes_pkey ON public.poderes USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_preguntas_asamblea ON public.preguntas USING btree (asamblea_id);
CREATE \1INDEX IF NOT EXISTS idx_preguntas_asamblea_estado ON public.preguntas USING btree (asamblea_id, estado);
CREATE \1INDEX IF NOT EXISTS idx_preguntas_is_archived ON public.preguntas USING btree (is_archived) WHERE (is_archived = true);
CREATE \1INDEX IF NOT EXISTS idx_preguntas_orden ON public.preguntas USING btree (orden);
CREATE \1INDEX IF NOT EXISTS idx_preguntas_punto_orden_dia_id ON public.preguntas USING btree (punto_orden_dia_id) WHERE (punto_orden_dia_id IS NOT NULL);
CREATE \1INDEX IF NOT EXISTS preguntas_pkey ON public.preguntas USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING btree (email);
CREATE \1INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles USING btree (organization_id);
CREATE \1INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles USING btree (user_id);
CREATE \1INDEX IF NOT EXISTS profiles_new_pkey ON public.profiles USING btree (id);
CREATE \1INDEX IF NOT EXISTS profiles_new_user_id_organization_id_key ON public.profiles USING btree (user_id, organization_id);
CREATE \1INDEX IF NOT EXISTS idx_profiles_temp_fk_profiles_temp_organization_id_fkey ON public.profiles_temp USING btree (organization_id);
CREATE \1INDEX IF NOT EXISTS profiles_temp_pkey ON public.profiles_temp USING btree (id);
CREATE \1INDEX IF NOT EXISTS profiles_temp_user_id_organization_id_key ON public.profiles_temp USING btree (user_id, organization_id);
CREATE \1INDEX IF NOT EXISTS idx_puntos_orden_dia_asamblea_orden ON public.puntos_orden_dia USING btree (asamblea_id, orden);
CREATE \1INDEX IF NOT EXISTS puntos_orden_dia_pkey ON public.puntos_orden_dia USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_asamblea_asamblea_id ON public.quorum_asamblea USING btree (asamblea_id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_asamblea_asamblea_unidad ON public.quorum_asamblea USING btree (asamblea_id, unidad_id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_asamblea_fk_quorum_asamblea_unidad_id_fkey ON public.quorum_asamblea USING btree (unidad_id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_asamblea_verifico ON public.quorum_asamblea USING btree (asamblea_id) WHERE (verifico_asistencia = true);
CREATE \1INDEX IF NOT EXISTS quorum_asamblea_asamblea_id_unidad_id_key ON public.quorum_asamblea USING btree (asamblea_id, unidad_id);
CREATE \1INDEX IF NOT EXISTS quorum_asamblea_pkey ON public.quorum_asamblea USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_event_log_asamblea_created ON public.quorum_event_log USING btree (asamblea_id, created_at DESC);
CREATE \1INDEX IF NOT EXISTS idx_quorum_event_log_type_created ON public.quorum_event_log USING btree (event_type, created_at DESC);
CREATE \1INDEX IF NOT EXISTS quorum_event_log_asamblea_id_idempotency_key_key ON public.quorum_event_log USING btree (asamblea_id, idempotency_key);
CREATE \1INDEX IF NOT EXISTS quorum_event_log_pkey ON public.quorum_event_log USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_presence_asamblea_heartbeat ON public.quorum_presence USING btree (asamblea_id, last_heartbeat_at DESC);
CREATE \1INDEX IF NOT EXISTS idx_quorum_presence_asamblea_status ON public.quorum_presence USING btree (asamblea_id, status);
CREATE \1INDEX IF NOT EXISTS quorum_presence_asamblea_id_participant_key_key ON public.quorum_presence USING btree (asamblea_id, participant_key);
CREATE \1INDEX IF NOT EXISTS quorum_presence_pkey ON public.quorum_presence USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_presence_config_updated_at ON public.quorum_presence_config USING btree (updated_at DESC);
CREATE \1INDEX IF NOT EXISTS quorum_presence_config_pkey ON public.quorum_presence_config USING btree (asamblea_id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_presence_units_presence ON public.quorum_presence_units USING btree (presence_id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_presence_units_unidad ON public.quorum_presence_units USING btree (unidad_id);
CREATE \1INDEX IF NOT EXISTS quorum_presence_units_pkey ON public.quorum_presence_units USING btree (id);
CREATE \1INDEX IF NOT EXISTS quorum_presence_units_presence_id_unidad_id_key ON public.quorum_presence_units USING btree (presence_id, unidad_id);
CREATE \1INDEX IF NOT EXISTS idx_quorum_snapshot_asamblea_pregunta ON public.quorum_snapshot USING btree (asamblea_id, pregunta_id, taken_at DESC);
CREATE \1INDEX IF NOT EXISTS idx_quorum_snapshot_asamblea_taken ON public.quorum_snapshot USING btree (asamblea_id, taken_at DESC);
CREATE \1INDEX IF NOT EXISTS quorum_snapshot_pkey ON public.quorum_snapshot USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_sesion_token_consumos_asamblea_seq ON public.sesion_token_consumos USING btree (asamblea_id, session_seq);
CREATE \1INDEX IF NOT EXISTS idx_sesion_token_consumos_fk_sesion_token_consumos_consentimien ON public.sesion_token_consumos USING btree (consentimiento_id);
CREATE \1INDEX IF NOT EXISTS idx_sesion_token_consumos_fk_sesion_token_consumos_unidad_id_fk ON public.sesion_token_consumos USING btree (unidad_id);
CREATE \1INDEX IF NOT EXISTS sesion_token_consumos_asamblea_id_session_seq_unidad_id_key ON public.sesion_token_consumos USING btree (asamblea_id, session_seq, unidad_id);
CREATE \1INDEX IF NOT EXISTS sesion_token_consumos_pkey ON public.sesion_token_consumos USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_super_admin_accounts_active ON public.super_admin_accounts USING btree (active);
CREATE \1INDEX IF NOT EXISTS idx_super_admin_accounts_email ON public.super_admin_accounts USING btree (email);
CREATE \1INDEX IF NOT EXISTS super_admin_accounts_email_key ON public.super_admin_accounts USING btree (email);
CREATE \1INDEX IF NOT EXISTS super_admin_accounts_pkey ON public.super_admin_accounts USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_unidades_email ON public.unidades USING btree (email);
CREATE \1INDEX IF NOT EXISTS idx_unidades_is_demo ON public.unidades USING btree (is_demo) WHERE (is_demo = true);
CREATE \1INDEX IF NOT EXISTS idx_unidades_nombre ON public.unidades USING btree (nombre_propietario);
CREATE \1INDEX IF NOT EXISTS idx_unidades_org_demo_email_lower ON public.unidades USING btree (organization_id, is_demo, lower(email));
CREATE \1INDEX IF NOT EXISTS idx_unidades_org_demo_email_prop_lower ON public.unidades USING btree (organization_id, is_demo, lower(email_propietario));
CREATE \1INDEX IF NOT EXISTS idx_unidades_org_email_lower ON public.unidades USING btree (organization_id, lower(email));
CREATE \1INDEX IF NOT EXISTS idx_unidades_org_email_prop_lower ON public.unidades USING btree (organization_id, lower(email_propietario));
CREATE \1INDEX IF NOT EXISTS idx_unidades_org_telefono ON public.unidades USING btree (organization_id, telefono);
CREATE \1INDEX IF NOT EXISTS idx_unidades_org_telefono_prop ON public.unidades USING btree (organization_id, telefono_propietario);
CREATE \1INDEX IF NOT EXISTS idx_unidades_organization_id ON public.unidades USING btree (organization_id);
CREATE \1INDEX IF NOT EXISTS idx_unidades_telefono ON public.unidades USING btree (telefono) WHERE ((telefono IS NOT NULL) AND (telefono <> ''::text));
CREATE \1INDEX IF NOT EXISTS idx_unidades_tipo ON public.unidades USING btree (tipo);
CREATE \1INDEX IF NOT EXISTS unidades_pkey ON public.unidades USING btree (id);
CREATE \1INDEX IF NOT EXISTS unique_unidad_torre_numero ON public.unidades USING btree (organization_id, torre, numero);
CREATE \1INDEX IF NOT EXISTS idx_verif_sesiones_asamblea ON public.verificacion_asamblea_sesiones USING btree (asamblea_id);
CREATE \1INDEX IF NOT EXISTS idx_verif_sesiones_asamblea_pregunta_cierre ON public.verificacion_asamblea_sesiones USING btree (asamblea_id, pregunta_id, cierre_at DESC);
CREATE \1INDEX IF NOT EXISTS idx_verificacion_asamblea_sesiones_fk_verificacion_asamblea_ses ON public.verificacion_asamblea_sesiones USING btree (pregunta_id);
CREATE \1INDEX IF NOT EXISTS verificacion_asamblea_sesiones_pkey ON public.verificacion_asamblea_sesiones USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_verif_reg_asamblea_pregunta_creado ON public.verificacion_asistencia_registro USING btree (asamblea_id, pregunta_id, creado_en DESC);
CREATE \1INDEX IF NOT EXISTS idx_verif_reg_quorum_pregunta ON public.verificacion_asistencia_registro USING btree (quorum_asamblea_id, pregunta_id);
CREATE \1INDEX IF NOT EXISTS idx_verif_registro_asamblea_pregunta ON public.verificacion_asistencia_registro USING btree (asamblea_id, pregunta_id);
CREATE \1INDEX IF NOT EXISTS idx_verif_registro_quorum_pregunta ON public.verificacion_asistencia_registro USING btree (quorum_asamblea_id, pregunta_id) NULLS NOT DISTINCT;
CREATE \1INDEX IF NOT EXISTS idx_verificacion_asistencia_registro_fk_verificacion_asistencia ON public.verificacion_asistencia_registro USING btree (pregunta_id);
CREATE \1INDEX IF NOT EXISTS verificacion_asistencia_regis_quorum_asamblea_id_pregunta_i_key ON public.verificacion_asistencia_registro USING btree (quorum_asamblea_id, pregunta_id);
CREATE \1INDEX IF NOT EXISTS verificacion_asistencia_registro_pkey ON public.verificacion_asistencia_registro USING btree (id);
CREATE \1INDEX IF NOT EXISTS idx_votos_email ON public.votos USING btree (votante_email);
CREATE \1INDEX IF NOT EXISTS idx_votos_fk_votos_poder_id_fkey ON public.votos USING btree (poder_id);
CREATE \1INDEX IF NOT EXISTS idx_votos_opcion ON public.votos USING btree (opcion_id);
CREATE \1INDEX IF NOT EXISTS idx_votos_pregunta ON public.votos USING btree (pregunta_id);
CREATE \1INDEX IF NOT EXISTS idx_votos_pregunta_opcion ON public.votos USING btree (pregunta_id, opcion_id);
CREATE \1INDEX IF NOT EXISTS idx_votos_pregunta_unidad ON public.votos USING btree (pregunta_id, unidad_id);
CREATE \1INDEX IF NOT EXISTS idx_votos_unidad ON public.votos USING btree (unidad_id);
CREATE \1INDEX IF NOT EXISTS idx_votos_votante_pregunta ON public.votos USING btree (votante_email, pregunta_id);
CREATE \1INDEX IF NOT EXISTS votos_pkey ON public.votos USING btree (id);
CREATE \1INDEX IF NOT EXISTS votos_pregunta_id_unidad_id_key ON public.votos USING btree (pregunta_id, unidad_id);

-- Functions

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

CREATE OR REPLACE FUNCTION public.marcar_salida_quorum(p_asamblea_id uuid, p_email_votante text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE quorum_asamblea
  SET presente_virtual = false
  WHERE asamblea_id = p_asamblea_id
    AND LOWER(TRIM(email_propietario)) = LOWER(TRIM(p_email_votante));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_presence_stale_offline_lazy(p_asamblea_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH cfg AS (
    SELECT
      c.asamblea_id,
      c.heartbeat_interval_seconds,
      c.idle_after_seconds,
      c.stale_after_seconds,
      c.offline_after_seconds
    FROM quorum_presence_config c
    WHERE c.asamblea_id = p_asamblea_id
  ),
  base AS (
    SELECT
      qp.id,
      presence_status_from_timestamps(
        qp.last_heartbeat_at,
        qp.last_activity_at,
        COALESCE(cfg.heartbeat_interval_seconds, 30),
        COALESCE(cfg.idle_after_seconds, 45),
        COALESCE(cfg.stale_after_seconds, 90),
        COALESCE(cfg.offline_after_seconds, 180)
      ) AS next_status
    FROM quorum_presence qp
    LEFT JOIN cfg ON cfg.asamblea_id = qp.asamblea_id
    WHERE qp.asamblea_id = p_asamblea_id
  )
  UPDATE quorum_presence qp
     SET status = b.next_status,
         disconnected_at = CASE WHEN b.next_status = 'offline' AND qp.disconnected_at IS NULL THEN now() ELSE qp.disconnected_at END
    FROM base b
   WHERE qp.id = b.id
     AND qp.status IS DISTINCT FROM b.next_status;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalizar_telefono(t text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF t IS NULL OR TRIM(t) = '' THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(regexp_replace(TRIM(t), '[^0-9]', '', 'g'), '^57', '');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obtener_votos_votante(p_pregunta_id uuid, p_votante_email text)
 RETURNS TABLE(unidad_id uuid, unidad_numero text, unidad_torre text, opcion_id uuid, texto_opcion text, color_opcion text, es_poder boolean, fecha_voto timestamp with time zone, puede_modificar boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.unidad_id,
    u.numero AS unidad_numero,
    u.torre AS unidad_torre,
    v.opcion_id,
    op.texto_opcion,
    op.color AS color_opcion,
    v.es_poder,
    v.created_at AS fecha_voto,
    (p.estado = 'abierta') AS puede_modificar
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id
  JOIN opciones_pregunta op ON v.opcion_id = op.id
  JOIN preguntas p ON v.pregunta_id = p.id
  WHERE v.pregunta_id = p_pregunta_id
    AND v.votante_email = p_votante_email
  ORDER BY u.torre, u.numero;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.planes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preguntas_punto_misma_asamblea()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.punto_orden_dia_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.puntos_orden_dia pod
    WHERE pod.id = NEW.punto_orden_dia_id AND pod.asamblea_id = NEW.asamblea_id
  ) THEN
    RAISE EXCEPTION 'punto_orden_dia_id debe pertenecer a la misma asamblea';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.presence_status_from_timestamps(p_last_heartbeat_at timestamp with time zone, p_last_activity_at timestamp with time zone, p_heartbeat_interval_seconds integer DEFAULT 30, p_idle_after_seconds integer DEFAULT 45, p_stale_after_seconds integer DEFAULT 90, p_offline_after_seconds integer DEFAULT 180)
 RETURNS quorum_presence_status
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_since_hb DOUBLE PRECISION;
  v_since_activity DOUBLE PRECISION;
BEGIN
  IF p_last_heartbeat_at IS NULL THEN
    RETURN 'offline';
  END IF;

  v_since_hb := EXTRACT(EPOCH FROM (v_now - p_last_heartbeat_at));
  v_since_activity := EXTRACT(EPOCH FROM (v_now - COALESCE(p_last_activity_at, p_last_heartbeat_at)));

  IF v_since_hb >= p_offline_after_seconds THEN
    RETURN 'offline';
  ELSIF v_since_hb >= p_stale_after_seconds THEN
    RETURN 'stale';
  ELSIF v_since_activity >= p_idle_after_seconds THEN
    RETURN 'idle';
  ELSE
    RETURN 'online';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.puede_votar(p_pregunta_id uuid, p_unidad_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ya_voto BOOLEAN;
  v_estado_pregunta TEXT;
BEGIN
  -- Verificar si la pregunta está abierta
  SELECT estado INTO v_estado_pregunta
  FROM preguntas
  WHERE id = p_pregunta_id;
  
  IF v_estado_pregunta != 'abierta' THEN
    RETURN false;
  END IF;
  
  -- Verificar si ya votó
  SELECT EXISTS(
    SELECT 1 FROM votos
    WHERE pregunta_id = p_pregunta_id
      AND unidad_id = p_unidad_id
  ) INTO v_ya_voto;
  
  RETURN NOT v_ya_voto;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_ids_para_verificar_asistencia(p_asamblea_id uuid, p_email text)
 RETURNS TABLE(quorum_id uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_es_email BOOLEAN := (LOWER(TRIM(p_email)) LIKE '%@%');
  v_tel_norm TEXT := normalizar_telefono(p_email);
BEGIN
  IF v_es_email THEN
    -- Por correo: igualdad en quorum, correos de la unidad, O apoderado (poder a terceros)
    RETURN QUERY
    SELECT qa.id
    FROM quorum_asamblea qa
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE qa.asamblea_id = p_asamblea_id
      AND (
        LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
        OR unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), p_email)
      )
    UNION
    -- Poder a terceros: el email es el apoderado (email_receptor) de un poder activo para esa unidad
    SELECT qa.id
    FROM quorum_asamblea qa
    INNER JOIN poderes p ON p.asamblea_id = qa.asamblea_id
      AND p.unidad_otorgante_id = qa.unidad_id
      AND p.estado = 'activo'
      AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(p_email))
    WHERE qa.asamblea_id = p_asamblea_id;
  ELSE
    -- Por teléfono: normalizar y comparar con lo guardado en quorum o con teléfono(s) de la unidad
    IF v_tel_norm IS NULL OR v_tel_norm = '' THEN
      RETURN;
    END IF;
    RETURN QUERY
    SELECT qa.id
    FROM quorum_asamblea qa
    JOIN unidades u ON u.id = qa.unidad_id
    WHERE qa.asamblea_id = p_asamblea_id
      AND (
        normalizar_telefono(COALESCE(TRIM(qa.email_propietario), '')) = v_tel_norm
        OR normalizar_telefono(COALESCE(u.telefono, u.telefono_propietario, '')) = v_tel_norm
      );
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_participant_key_from_identifier(p_identificador text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT encode(digest(lower(trim(coalesce(p_identificador, ''))), 'sha256'), 'hex');
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_presence_heartbeat_upsert(p_asamblea_id uuid, p_identificador text, p_connection_id uuid DEFAULT NULL::uuid, p_activity_hint boolean DEFAULT false, p_event_type quorum_event_type DEFAULT 'heartbeat'::quorum_event_type, p_pregunta_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text, p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(presence_id uuid, participant_key text, status quorum_presence_status, last_heartbeat_at timestamp with time zone, last_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_participant_key TEXT;
  v_presence_id UUID;
  v_prev_status quorum_presence_status;
  v_status quorum_presence_status;
  v_now TIMESTAMPTZ := now();
  v_cfg quorum_presence_config%ROWTYPE;
BEGIN
  IF p_asamblea_id IS NULL OR coalesce(trim(p_identificador), '') = '' THEN
    RAISE EXCEPTION 'Datos de presencia inválidos';
  END IF;

  v_participant_key := quorum_participant_key_from_identifier(p_identificador);

  INSERT INTO quorum_presence_config(asamblea_id)
  VALUES (p_asamblea_id)
  ON CONFLICT (asamblea_id) DO NOTHING;

  SELECT * INTO v_cfg FROM quorum_presence_config WHERE asamblea_id = p_asamblea_id;

  INSERT INTO quorum_presence(
    asamblea_id,
    participant_key,
    auth_user_id,
    connection_id,
    status,
    joined_at,
    last_heartbeat_at,
    last_activity_at,
    reconnected_at
  )
  VALUES (
    p_asamblea_id,
    v_participant_key,
    p_auth_user_id,
    p_connection_id,
    'online',
    v_now,
    v_now,
    CASE WHEN p_activity_hint THEN v_now ELSE v_now END,
    v_now
  )
  ON CONFLICT (asamblea_id, participant_key)
  DO UPDATE SET
    auth_user_id = COALESCE(EXCLUDED.auth_user_id, quorum_presence.auth_user_id),
    connection_id = COALESCE(EXCLUDED.connection_id, quorum_presence.connection_id),
    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
    last_activity_at = CASE
      WHEN p_activity_hint OR p_event_type IN ('activity', 'vote_cast', 'reconnected')
        THEN EXCLUDED.last_activity_at
      ELSE quorum_presence.last_activity_at
    END,
    reconnected_at = CASE
      WHEN quorum_presence.status IN ('offline', 'stale')
        THEN EXCLUDED.last_heartbeat_at
      ELSE quorum_presence.reconnected_at
    END,
    disconnected_at = CASE
      WHEN quorum_presence.status = 'offline' THEN NULL
      ELSE quorum_presence.disconnected_at
    END,
    status = 'online'
  RETURNING id INTO v_presence_id;

  SELECT status INTO v_prev_status FROM quorum_presence WHERE id = v_presence_id;

  PERFORM mark_presence_stale_offline_lazy(p_asamblea_id);

  UPDATE quorum_presence qp
     SET status = presence_status_from_timestamps(
       qp.last_heartbeat_at,
       qp.last_activity_at,
       COALESCE(v_cfg.heartbeat_interval_seconds, 30),
       COALESCE(v_cfg.idle_after_seconds, 45),
       COALESCE(v_cfg.stale_after_seconds, 90),
       COALESCE(v_cfg.offline_after_seconds, 180)
     )
   WHERE qp.id = v_presence_id;

  SELECT qp.status, qp.last_heartbeat_at, qp.last_activity_at
    INTO v_status, last_heartbeat_at, last_activity_at
    FROM quorum_presence qp
   WHERE qp.id = v_presence_id;

  INSERT INTO quorum_event_log(
    asamblea_id,
    presence_id,
    participant_key,
    pregunta_id,
    event_type,
    metadata,
    idempotency_key
  )
  VALUES(
    p_asamblea_id,
    v_presence_id,
    v_participant_key,
    p_pregunta_id,
    p_event_type,
    jsonb_build_object(
      'connection_id', p_connection_id,
      'activity_hint', p_activity_hint,
      'previous_status', v_prev_status,
      'new_status', v_status
    ),
    p_idempotency_key
  )
  ON CONFLICT (asamblea_id, idempotency_key) DO NOTHING;

  RETURN QUERY
  SELECT
    v_presence_id,
    v_participant_key,
    v_status,
    last_heartbeat_at,
    last_activity_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_presence_refresh_units(p_asamblea_id uuid, p_identificador text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_participant_key TEXT;
  v_presence_id UUID;
  v_changed INTEGER := 0;
BEGIN
  v_participant_key := quorum_participant_key_from_identifier(p_identificador);

  SELECT id INTO v_presence_id
  FROM quorum_presence
  WHERE asamblea_id = p_asamblea_id
    AND participant_key = v_participant_key
  LIMIT 1;

  IF v_presence_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Rebuild simple para evitar drift de poderes.
  DELETE FROM quorum_presence_units WHERE presence_id = v_presence_id;

  WITH ids AS (
    SELECT q.quorum_id
    FROM quorum_ids_para_verificar_asistencia(p_asamblea_id, p_identificador) q
  ),
  base AS (
    SELECT
      qa.unidad_id,
      u.coeficiente::NUMERIC(12, 6) AS coef,
      EXISTS (
        SELECT 1
        FROM poderes p
        WHERE p.asamblea_id = p_asamblea_id
          AND p.unidad_otorgante_id = qa.unidad_id
          AND p.estado = 'activo'
          AND lower(trim(p.email_receptor)) = lower(trim(p_identificador))
      ) AS es_delegado,
      (
        SELECT p.id
        FROM poderes p
        WHERE p.asamblea_id = p_asamblea_id
          AND p.unidad_otorgante_id = qa.unidad_id
          AND p.estado = 'activo'
          AND lower(trim(p.email_receptor)) = lower(trim(p_identificador))
        LIMIT 1
      ) AS poder_id
    FROM quorum_asamblea qa
    JOIN ids ON ids.quorum_id = qa.id
    JOIN unidades u ON u.id = qa.unidad_id
  )
  INSERT INTO quorum_presence_units(
    presence_id,
    unidad_id,
    poder_id,
    coeficiente_propio,
    coeficiente_delegado
  )
  SELECT
    v_presence_id,
    b.unidad_id,
    b.poder_id,
    CASE WHEN b.es_delegado THEN 0 ELSE b.coef END,
    CASE WHEN b.es_delegado THEN b.coef ELSE 0 END
  FROM base b
  ON CONFLICT (presence_id, unidad_id) DO UPDATE
    SET poder_id = EXCLUDED.poder_id,
        coeficiente_propio = EXCLUDED.coeficiente_propio,
        coeficiente_delegado = EXCLUDED.coeficiente_delegado,
        updated_at = now();

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.quorum_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_consentimiento_registro_poderes(p_codigo text, p_identificador text, p_ip text DEFAULT NULL::text, p_registro_externo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo TEXT := UPPER(TRIM(p_codigo));
  v_id_norm TEXT := LOWER(TRIM(p_identificador));
  v_asamblea RECORD;
  v_org UUID;
  v_demo BOOLEAN;
  v_seq INT;
  v_val RECORD;
  v_unidades UUID[];
  v_ord INT;
  v_tokens_unit INT;
  v_charge_total INT := 0;
  v_consent_id UUID;
  v_gestor_user UUID;
  v_owner_profile_id UUID;
  v_saldo INT;
  v_nuevo_saldo INT;
  v_n_existentes INT;
  u UUID;
BEGIN
  IF v_codigo IS NULL OR v_id_norm IS NULL OR length(v_id_norm) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_REQUEST', 'message', 'Faltan codigo o identificador');
  END IF;

  SELECT
    a.id,
    a.organization_id,
    COALESCE(a.is_demo, false) AS is_demo,
    COALESCE(a.session_seq, 1) AS session_seq
  INTO v_asamblea
  FROM public.asambleas a
  WHERE a.codigo_acceso = v_codigo
  FOR UPDATE OF a;

  IF v_asamblea.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ASAMBLEA_NOT_FOUND', 'message', 'Código no válido');
  END IF;

  v_org := v_asamblea.organization_id;
  v_demo := v_asamblea.is_demo;
  v_seq := v_asamblea.session_seq;

  IF COALESCE(p_registro_externo, false) THEN
    v_unidades := ARRAY[]::UUID[];
    v_charge_total := 0;
    v_n_existentes := 0;
  ELSE
    SELECT * INTO v_val FROM public.validar_votante_registro_poderes(v_codigo, p_identificador) LIMIT 1;

    IF v_val.puede_votar IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'code', 'VOTANTE_INVALIDO', 'message', COALESCE(v_val.mensaje, 'Votante no válido'));
    END IF;

    SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::UUID[])
    INTO v_unidades
    FROM (
      SELECT DISTINCT unnest(
        COALESCE(v_val.unidades_propias, ARRAY[]::UUID[]) ||
        COALESCE(v_val.unidades_poderes, ARRAY[]::UUID[])
      ) AS id
    ) s;

    IF v_unidades IS NULL OR coalesce(array_length(v_unidades, 1), 0) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SIN_UNIDADES', 'message', 'No hay unidades para este identificador');
    END IF;

    SELECT o.owner_id INTO v_owner_profile_id FROM public.organizations o WHERE o.id = v_org;
    IF v_owner_profile_id IS NOT NULL THEN
      SELECT p.user_id INTO v_gestor_user FROM public.profiles p WHERE p.id = v_owner_profile_id LIMIT 1;
    END IF;
    IF v_gestor_user IS NULL THEN
      SELECT p.user_id INTO v_gestor_user
      FROM public.profiles p
      WHERE p.organization_id = v_org AND p.user_id IS NOT NULL
      ORDER BY p.created_at NULLS LAST
      LIMIT 1;
    END IF;

    SELECT COUNT(DISTINCT unidad_id)::INT INTO v_n_existentes
    FROM public.sesion_token_consumos
    WHERE asamblea_id = v_asamblea.id AND session_seq = v_seq;

    v_ord := v_n_existentes;
    v_charge_total := 0;

    FOREACH u IN ARRAY v_unidades LOOP
      IF EXISTS (
        SELECT 1 FROM public.sesion_token_consumos c
        WHERE c.asamblea_id = v_asamblea.id AND c.session_seq = v_seq AND c.unidad_id = u
      ) THEN
        CONTINUE;
      END IF;

      v_ord := v_ord + 1;
      IF v_demo THEN
        v_tokens_unit := 0;
      ELSE
        v_tokens_unit := CASE WHEN v_ord <= 5 THEN 0 ELSE 1 END;
      END IF;

      v_charge_total := v_charge_total + v_tokens_unit;
    END LOOP;

    IF NOT v_demo AND v_charge_total > 0 THEN
      IF v_gestor_user IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'code', 'NO_GESTOR', 'message', 'No se encontró billetera del gestor para este conjunto.');
      END IF;

      PERFORM 1 FROM public.profiles p
      WHERE p.user_id = v_gestor_user OR p.id = v_gestor_user
      FOR UPDATE;

      SELECT COALESCE(MAX(p.tokens_disponibles), 0)::INT INTO v_saldo
      FROM public.profiles p
      WHERE p.user_id = v_gestor_user OR p.id = v_gestor_user;

      IF v_saldo < v_charge_total THEN
        RETURN jsonb_build_object(
          'ok', false,
          'code', 'INSUFFICIENT_TOKENS',
          'message', format('Saldo insuficiente: se requieren %s tokens y hay %s.', v_charge_total, v_saldo),
          'requerido', v_charge_total,
          'saldo', v_saldo
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.consentimiento_tratamiento_datos (asamblea_id, identificador, accepted_at, ip_address, session_seq)
  VALUES (v_asamblea.id, v_id_norm, now(), NULLIF(trim(p_ip), ''), v_seq)
  ON CONFLICT (asamblea_id, identificador, session_seq)
  DO UPDATE SET accepted_at = EXCLUDED.accepted_at, ip_address = COALESCE(EXCLUDED.ip_address, consentimiento_tratamiento_datos.ip_address)
  RETURNING id INTO v_consent_id;

  IF NOT COALESCE(p_registro_externo, false) THEN
    v_ord := v_n_existentes;

    FOREACH u IN ARRAY v_unidades LOOP
      IF EXISTS (
        SELECT 1 FROM public.sesion_token_consumos c
        WHERE c.asamblea_id = v_asamblea.id AND c.session_seq = v_seq AND c.unidad_id = u
      ) THEN
        CONTINUE;
      END IF;

      v_ord := v_ord + 1;
      IF v_demo THEN
        v_tokens_unit := 0;
      ELSE
        v_tokens_unit := CASE WHEN v_ord <= 5 THEN 0 ELSE 1 END;
      END IF;

      INSERT INTO public.sesion_token_consumos (asamblea_id, session_seq, unidad_id, identificador, tokens_cobrados, consentimiento_id)
      VALUES (v_asamblea.id, v_seq, u, v_id_norm, v_tokens_unit, v_consent_id);
    END LOOP;

    IF NOT v_demo AND v_charge_total > 0 THEN
      v_nuevo_saldo := GREATEST(0, v_saldo - v_charge_total);

      UPDATE public.profiles SET tokens_disponibles = v_nuevo_saldo
      WHERE user_id = v_gestor_user OR id = v_gestor_user;

      INSERT INTO public.billing_logs (user_id, tipo_operacion, asamblea_id, organization_id, tokens_usados, saldo_restante, metadata)
      VALUES (
        v_gestor_user,
        'Consentimiento_sesion',
        v_asamblea.id,
        v_org,
        v_charge_total,
        v_nuevo_saldo,
        jsonb_build_object(
          'session_seq', v_seq,
          'unidad_ids', to_jsonb(v_unidades),
          'tokens_cobrados_en_operacion', v_charge_total,
          'contexto', 'registro_poderes'
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session_seq', v_seq,
    'tokens_cobrados', CASE WHEN v_demo THEN 0 ELSE v_charge_total END,
    'unidades', to_jsonb(v_unidades),
    'registro_externo', COALESCE(p_registro_externo, false)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_consentimiento_y_consumo_sesion(p_codigo text, p_identificador text, p_ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_codigo TEXT := UPPER(TRIM(p_codigo));
  v_id_norm TEXT := LOWER(TRIM(p_identificador));
  v_asamblea RECORD;
  v_org UUID;
  v_demo BOOLEAN;
  v_mode TEXT;
  v_seq INT;
  v_val RECORD;
  v_unidades UUID[];
  v_ord INT;
  v_tokens_unit INT;
  v_charge_total INT := 0;
  v_consent_id UUID;
  v_gestor_user UUID;
  v_owner_profile_id UUID;
  v_saldo INT;
  v_nuevo_saldo INT;
  v_n_existentes INT;
  u UUID;
BEGIN
  IF v_codigo IS NULL OR v_id_norm IS NULL OR length(v_id_norm) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BAD_REQUEST', 'message', 'Faltan codigo o identificador');
  END IF;

  SELECT a.id, a.organization_id, COALESCE(a.is_demo, false) AS is_demo,
         COALESCE(a.session_mode, 'inactive') AS session_mode,
         COALESCE(a.session_seq, 1) AS session_seq,
         a.acceso_publico
    INTO v_asamblea
  FROM asambleas a
  WHERE a.codigo_acceso = v_codigo
  FOR UPDATE OF a;

  IF v_asamblea.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ASAMBLEA_NOT_FOUND', 'message', 'Código no válido');
  END IF;

  IF NOT v_asamblea.acceso_publico THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACCESO_CERRADO', 'message', 'Acceso público desactivado');
  END IF;

  v_org := v_asamblea.organization_id;
  v_demo := v_asamblea.is_demo;
  v_mode := v_asamblea.session_mode;
  v_seq := v_asamblea.session_seq;

  IF v_mode NOT IN ('verification', 'voting') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SESSION_INACTIVE', 'message', 'La sesión no está abierta para aceptar privacidad. Espera a que el administrador inicie verificación o votación.');
  END IF;

  SELECT * INTO v_val FROM validar_votante_asamblea(v_codigo, p_identificador) LIMIT 1;

  IF v_val.puede_votar IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'code', 'VOTANTE_INVALIDO', 'message', COALESCE(v_val.mensaje, 'Votante no válido'));
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::UUID[])
  INTO v_unidades
  FROM (
    SELECT DISTINCT unnest(
      COALESCE(v_val.unidades_propias, ARRAY[]::UUID[]) ||
      COALESCE(v_val.unidades_poderes, ARRAY[]::UUID[])
    ) AS id
  ) s;

  IF v_unidades IS NULL OR coalesce(array_length(v_unidades, 1), 0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SIN_UNIDADES', 'message', 'No hay unidades para este identificador');
  END IF;

  SELECT o.owner_id INTO v_owner_profile_id FROM organizations o WHERE o.id = v_org;
  IF v_owner_profile_id IS NOT NULL THEN
    SELECT p.user_id INTO v_gestor_user FROM profiles p WHERE p.id = v_owner_profile_id LIMIT 1;
  END IF;
  IF v_gestor_user IS NULL THEN
    SELECT p.user_id INTO v_gestor_user
    FROM profiles p
    WHERE p.organization_id = v_org AND p.user_id IS NOT NULL
    ORDER BY p.created_at NULLS LAST
    LIMIT 1;
  END IF;

  SELECT COUNT(DISTINCT unidad_id)::INT INTO v_n_existentes
  FROM sesion_token_consumos
  WHERE asamblea_id = v_asamblea.id AND session_seq = v_seq;

  v_ord := v_n_existentes;
  v_charge_total := 0;

  FOREACH u IN ARRAY v_unidades LOOP
    IF EXISTS (
      SELECT 1 FROM sesion_token_consumos c
      WHERE c.asamblea_id = v_asamblea.id AND c.session_seq = v_seq AND c.unidad_id = u
    ) THEN
      CONTINUE;
    END IF;

    v_ord := v_ord + 1;
    IF v_demo THEN
      v_tokens_unit := 0;
    ELSE
      v_tokens_unit := CASE WHEN v_ord <= 5 THEN 0 ELSE 1 END;
    END IF;

    v_charge_total := v_charge_total + v_tokens_unit;
  END LOOP;

  IF NOT v_demo AND v_charge_total > 0 THEN
    IF v_gestor_user IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'NO_GESTOR', 'message', 'No se encontró billetera del gestor para este conjunto.');
    END IF;

    -- Bloqueo de billetera: sin esto, dos consentimientos en paralelo en *distintas* asambleas del mismo gestor
    -- podían leer el mismo saldo y sobrescribir tokens_disponibles (lost update).
    PERFORM 1 FROM profiles p
    WHERE p.user_id = v_gestor_user OR p.id = v_gestor_user
    FOR UPDATE;
    SELECT COALESCE(MAX(p.tokens_disponibles), 0)::INT INTO v_saldo
    FROM profiles p
    WHERE p.user_id = v_gestor_user OR p.id = v_gestor_user;

    IF v_saldo < v_charge_total THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'INSUFFICIENT_TOKENS',
        'message', format('Saldo insuficiente: se requieren %s tokens y hay %s.', v_charge_total, v_saldo),
        'requerido', v_charge_total,
        'saldo', v_saldo
      );
    END IF;
  END IF;

  INSERT INTO consentimiento_tratamiento_datos (asamblea_id, identificador, accepted_at, ip_address, session_seq)
  VALUES (v_asamblea.id, v_id_norm, now(), NULLIF(trim(p_ip), ''), v_seq)
  ON CONFLICT (asamblea_id, identificador, session_seq)
  DO UPDATE SET accepted_at = EXCLUDED.accepted_at, ip_address = COALESCE(EXCLUDED.ip_address, consentimiento_tratamiento_datos.ip_address)
  RETURNING id INTO v_consent_id;

  v_ord := v_n_existentes;

  FOREACH u IN ARRAY v_unidades LOOP
    IF EXISTS (
      SELECT 1 FROM sesion_token_consumos c
      WHERE c.asamblea_id = v_asamblea.id AND c.session_seq = v_seq AND c.unidad_id = u
    ) THEN
      CONTINUE;
    END IF;

    v_ord := v_ord + 1;
    IF v_demo THEN
      v_tokens_unit := 0;
    ELSE
      v_tokens_unit := CASE WHEN v_ord <= 5 THEN 0 ELSE 1 END;
    END IF;

    INSERT INTO sesion_token_consumos (asamblea_id, session_seq, unidad_id, identificador, tokens_cobrados, consentimiento_id)
    VALUES (v_asamblea.id, v_seq, u, v_id_norm, v_tokens_unit, v_consent_id);
  END LOOP;

  IF NOT v_demo AND v_charge_total > 0 THEN
    v_nuevo_saldo := GREATEST(0, v_saldo - v_charge_total);

    UPDATE profiles SET tokens_disponibles = v_nuevo_saldo
    WHERE user_id = v_gestor_user OR id = v_gestor_user;

    INSERT INTO billing_logs (user_id, tipo_operacion, asamblea_id, organization_id, tokens_usados, saldo_restante, metadata)
    VALUES (
      v_gestor_user,
      'Consentimiento_sesion',
      v_asamblea.id,
      v_org,
      v_charge_total,
      v_nuevo_saldo,
      jsonb_build_object(
        'session_seq', v_seq,
        'unidad_ids', to_jsonb(v_unidades),
        'tokens_cobrados_en_operacion', v_charge_total
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session_seq', v_seq,
    'tokens_cobrados', CASE WHEN v_demo THEN 0 ELSE v_charge_total END,
    'unidades', to_jsonb(v_unidades)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_voto_con_trazabilidad(p_pregunta_id uuid, p_unidad_id uuid, p_opcion_id uuid, p_votante_email text, p_votante_nombre text, p_es_poder boolean DEFAULT false, p_poder_id uuid DEFAULT NULL::uuid, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS TABLE(voto_id uuid, accion text, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_voto_existente uuid;
  v_opcion_anterior uuid;
  v_nuevo_voto_id uuid;
  v_accion text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.preguntas
    WHERE id = p_pregunta_id
      AND estado = 'abierta'
  ) THEN
    RAISE EXCEPTION 'La pregunta no está abierta para votación';
  END IF;

  -- Bloqueo para evitar condición de carrera en alta concurrencia
  SELECT id, opcion_id
    INTO v_voto_existente, v_opcion_anterior
  FROM public.votos
  WHERE pregunta_id = p_pregunta_id
    AND unidad_id = p_unidad_id
  FOR UPDATE;

  IF v_voto_existente IS NOT NULL THEN
    v_accion := 'modificar';

    UPDATE public.votos
    SET opcion_id = p_opcion_id,
        votante_email = p_votante_email,
        votante_nombre = p_votante_nombre,
        es_poder = p_es_poder,
        poder_id = p_poder_id
    WHERE id = v_voto_existente;

    v_nuevo_voto_id := v_voto_existente;
  ELSE
    v_accion := 'crear';

    INSERT INTO public.votos (
      pregunta_id, unidad_id, opcion_id, votante_email, votante_nombre, es_poder, poder_id
    )
    VALUES (
      p_pregunta_id, p_unidad_id, p_opcion_id, p_votante_email, p_votante_nombre, p_es_poder, p_poder_id
    )
    RETURNING id INTO v_nuevo_voto_id;
  END IF;

  INSERT INTO public.historial_votos (
    voto_id, pregunta_id, unidad_id, opcion_id, votante_email, votante_nombre,
    es_poder, poder_id, accion, opcion_anterior_id, ip_address, user_agent
  )
  VALUES (
    v_nuevo_voto_id, p_pregunta_id, p_unidad_id, p_opcion_id, p_votante_email, p_votante_nombre,
    p_es_poder, p_poder_id, v_accion, v_opcion_anterior, p_ip_address, p_user_agent
  );

  RETURN QUERY
  SELECT
    v_nuevo_voto_id,
    v_accion,
    CASE
      WHEN v_accion = 'crear' THEN 'Voto registrado exitosamente'
      ELSE 'Voto actualizado exitosamente'
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_voto_publico_seguro(p_codigo text, p_pregunta_id uuid, p_unidad_id uuid, p_opcion_id uuid, p_votante_identificador text, p_votante_nombre text, p_es_poder boolean DEFAULT false, p_poder_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS TABLE(ok boolean, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_codigo record;
  v_valida record;
  v_email text;
  v_unidades_autorizadas uuid[];
begin
  select * into v_codigo
  from public.validar_codigo_acceso(trim(p_codigo))
  limit 1;

  if v_codigo is null or coalesce(v_codigo.acceso_valido, false) = false then
    return query select false, 'Código de acceso inválido o cerrado';
    return;
  end if;

  v_email := lower(trim(p_votante_identificador));
  select * into v_valida
  from public.validar_votante_asamblea(trim(p_codigo), v_email)
  limit 1;

  if v_valida is null or coalesce(v_valida.puede_votar, false) = false then
    return query select false, 'No autorizado para votar en esta asamblea';
    return;
  end if;

  v_unidades_autorizadas :=
    coalesce(v_valida.unidades_propias, '{}'::uuid[]) ||
    coalesce(v_valida.unidades_poderes, '{}'::uuid[]);

  if not (p_unidad_id = any(v_unidades_autorizadas)) then
    return query select false, 'Unidad no autorizada para este votante';
    return;
  end if;

  perform public.registrar_voto_con_trazabilidad(
    p_pregunta_id,
    p_unidad_id,
    p_opcion_id,
    v_email,
    coalesce(nullif(trim(p_votante_nombre), ''), 'Votante'),
    coalesce(p_es_poder, false),
    p_poder_id,
    p_ip_address,
    p_user_agent
  );

  return query select true, 'Voto registrado';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reporte_auditoria_pregunta(p_pregunta_id uuid)
 RETURNS TABLE(votante_email text, votante_nombre text, unidad_torre text, unidad_numero text, opcion_seleccionada text, es_poder boolean, accion text, opcion_anterior text, fecha_accion timestamp with time zone, ip_address text, user_agent text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    h.votante_email,
    h.votante_nombre,
    u.torre AS unidad_torre,
    u.numero AS unidad_numero,
    op.texto_opcion AS opcion_seleccionada,
    h.es_poder,
    h.accion,
    op_ant.texto_opcion AS opcion_anterior,
    h.created_at AS fecha_accion,
    h.ip_address,
    h.user_agent
  FROM historial_votos h
  JOIN unidades u ON h.unidad_id = u.id
  JOIN opciones_pregunta op ON h.opcion_id = op.id
  LEFT JOIN opciones_pregunta op_ant ON h.opcion_anterior_id = op_ant.id
  WHERE h.pregunta_id = p_pregunta_id
  ORDER BY h.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resumen_poderes_asamblea(p_asamblea_id uuid)
 RETURNS TABLE(total_poderes_activos integer, total_unidades_delegadas integer, coeficiente_total_delegado numeric, porcentaje_coeficiente numeric)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_organization_id UUID;
  v_coeficiente_total_conjunto NUMERIC(12, 6);
BEGIN
  -- Obtener el organization_id de la asamblea
  SELECT a.organization_id INTO v_organization_id
  FROM asambleas a
  WHERE a.id = p_asamblea_id;
  
  -- Calcular el coeficiente total del conjunto
  SELECT COALESCE(SUM(coeficiente), 0) INTO v_coeficiente_total_conjunto
  FROM unidades
  WHERE organization_id = v_organization_id;
  
  -- Calcular resumen de poderes
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER AS total_poderes_activos,
    COUNT(DISTINCT p.unidad_otorgante_id)::INTEGER AS total_unidades_delegadas,
    COALESCE(SUM(u.coeficiente), 0) AS coeficiente_total_delegado,
    CASE 
      WHEN v_coeficiente_total_conjunto > 0 THEN
        ROUND((COALESCE(SUM(u.coeficiente), 0) / v_coeficiente_total_conjunto * 100)::NUMERIC, 2)
      ELSE 0
    END AS porcentaje_coeficiente
  FROM poderes p
  JOIN unidades u ON p.unidad_otorgante_id = u.id
  WHERE p.asamblea_id = p_asamblea_id
    AND p.estado = 'activo';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_tokens_bienvenida()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.tokens_disponibles IS NULL OR NEW.tokens_disponibles < 0 THEN
    NEW.tokens_disponibles := 50;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_verificacion_asistencia_sesion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_verificados      INT;
  v_coeficiente_verificado NUMERIC(12, 6);
  v_porcentaje_verificado  NUMERIC(6, 2);
  v_quorum_alcanzado       BOOLEAN;
  rec                      RECORD;
BEGIN
  IF OLD.verificacion_asistencia_activa IS NOT DISTINCT FROM NEW.verificacion_asistencia_activa THEN
    RETURN NEW;
  END IF;

  IF NEW.verificacion_asistencia_activa = true THEN
    INSERT INTO verificacion_asamblea_sesiones (asamblea_id, apertura_at)
    VALUES (NEW.id, now());
    RETURN NEW;
  END IF;

  -- Desactivación: snapshot del contexto que se cierra (OLD.verificacion_pregunta_id)
  FOR rec IN
    SELECT * FROM calcular_verificacion_quorum(NEW.id, OLD.verificacion_pregunta_id) LIMIT 1
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
    quorum_alcanzado       = COALESCE(v_quorum_alcanzado, false)
  WHERE asamblea_id = NEW.id
    AND cierre_at IS NULL;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unidad_email_coincide(campo_email text, identificador text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(COALESCE(TRIM(campo_email), ''), E'[,;\\s]+') AS t(token)
    WHERE LOWER(TRIM(t.token)) = LOWER(TRIM(identificador))
      AND LENGTH(TRIM(t.token)) > 0
  );
$function$
;

CREATE OR REPLACE FUNCTION public.unidad_ids_verificados_sesion_actual(p_asamblea_id uuid, p_pregunta_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(unidad_id uuid, es_poder boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH ultima_cerrada AS (
    SELECT s.apertura_at AS apertura_ult_cerrada, s.cierre_at AS cierre_ult
      FROM verificacion_asamblea_sesiones s
     WHERE s.asamblea_id = p_asamblea_id
       AND (s.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
       AND s.cierre_at IS NOT NULL
     ORDER BY s.cierre_at DESC
     LIMIT 1
  ),
  ventana AS (
    SELECT
      (SELECT s.apertura_at
         FROM verificacion_asamblea_sesiones s
        WHERE s.asamblea_id = p_asamblea_id
          AND (s.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
          AND s.cierre_at IS NULL
        ORDER BY s.apertura_at DESC
        LIMIT 1) AS apertura_abierta,
      (SELECT u.apertura_ult_cerrada FROM ultima_cerrada u) AS apertura_ult_cerrada,
      (SELECT u.cierre_ult FROM ultima_cerrada u) AS cierre_ult
  )
  SELECT DISTINCT ON (qa.unidad_id)
    qa.unidad_id,
    CASE
      WHEN unidad_email_coincide(COALESCE(u.email_propietario, u.email, ''), qa.email_propietario) THEN false
      WHEN EXISTS (
        SELECT 1 FROM poderes p
        WHERE p.unidad_otorgante_id = qa.unidad_id
          AND p.asamblea_id = p_asamblea_id
          AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(qa.email_propietario))
          AND p.estado = 'activo'
      ) THEN true
      ELSE false
    END AS es_poder
  FROM verificacion_asistencia_registro r
  JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
  JOIN unidades u ON u.id = qa.unidad_id
  CROSS JOIN ventana w
  WHERE r.asamblea_id = p_asamblea_id
    AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
    AND (
      (w.apertura_abierta IS NOT NULL AND r.creado_en >= w.apertura_abierta)
      OR (
        w.apertura_abierta IS NULL
        AND w.apertura_ult_cerrada IS NOT NULL
        AND w.cierre_ult IS NOT NULL
        AND r.creado_en >= w.apertura_ult_cerrada
        AND r.creado_en <= w.cierre_ult
      )
    )
  ORDER BY qa.unidad_id;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_codigo_acceso(p_codigo text)
 RETURNS TABLE(asamblea_id uuid, nombre text, fecha date, organization_id uuid, nombre_conjunto text, acceso_valido boolean, mensaje text, participacion_timer_end_at timestamp with time zone, participacion_timer_default_minutes integer, participacion_timer_enabled boolean, session_mode text, session_seq integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_asamblea RECORD;
BEGIN
  SELECT
    a.id,
    a.nombre,
    a.fecha::DATE,
    a.organization_id,
    a.acceso_publico,
    COALESCE(o.name, 'Sin nombre') AS nombre_conjunto,
    a.participacion_timer_end_at,
    a.participacion_timer_default_minutes,
    a.participacion_timer_enabled,
    COALESCE(a.session_mode, 'inactive') AS session_mode,
    COALESCE(a.session_seq, 1) AS session_seq
  INTO v_asamblea
  FROM asambleas a
  LEFT JOIN organizations o ON a.organization_id = o.id
  WHERE a.codigo_acceso = UPPER(TRIM(p_codigo));

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      NULL::UUID, NULL::TEXT, NULL::DATE, NULL::UUID, NULL::TEXT,
      false, 'Código de acceso inválido o no existe'::TEXT,
      NULL::TIMESTAMPTZ, 5, true, 'inactive'::TEXT, 1;
    RETURN;
  END IF;

  IF NOT v_asamblea.acceso_publico THEN
    RETURN QUERY
    SELECT
      v_asamblea.id, v_asamblea.nombre, v_asamblea.fecha, v_asamblea.organization_id,
      v_asamblea.nombre_conjunto, false,
      'El acceso público a esta asamblea está desactivado'::TEXT,
      v_asamblea.participacion_timer_end_at,
      COALESCE(v_asamblea.participacion_timer_default_minutes, 5),
      COALESCE(v_asamblea.participacion_timer_enabled, true),
      v_asamblea.session_mode, v_asamblea.session_seq;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_asamblea.id, v_asamblea.nombre, v_asamblea.fecha, v_asamblea.organization_id,
    v_asamblea.nombre_conjunto, true, 'Código válido. Acceso permitido.'::TEXT,
    v_asamblea.participacion_timer_end_at,
    COALESCE(v_asamblea.participacion_timer_default_minutes, 5),
    COALESCE(v_asamblea.participacion_timer_enabled, true),
    v_asamblea.session_mode, v_asamblea.session_seq;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_codigo_registro_poderes(p_codigo text)
 RETURNS TABLE(asamblea_id uuid, nombre text, fecha date, organization_id uuid, nombre_conjunto text, acceso_valido boolean, mensaje text, participacion_timer_end_at timestamp with time zone, participacion_timer_default_minutes integer, participacion_timer_enabled boolean, session_mode text, session_seq integer, registro_poderes_publico boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_asamblea RECORD;
BEGIN
  SELECT
    a.id,
    a.nombre,
    a.fecha::DATE,
    a.organization_id,
    a.acceso_publico,
    COALESCE(a.registro_poderes_publico, false) AS registro_poderes_publico,
    COALESCE(o.name, 'Sin nombre') AS nombre_conjunto,
    a.participacion_timer_end_at,
    a.participacion_timer_default_minutes,
    a.participacion_timer_enabled,
    COALESCE(a.session_mode, 'inactive') AS session_mode,
    COALESCE(a.session_seq, 1) AS session_seq
  INTO v_asamblea
  FROM public.asambleas a
  LEFT JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.codigo_acceso = UPPER(TRIM(p_codigo));

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      NULL::UUID, NULL::TEXT, NULL::DATE, NULL::UUID, NULL::TEXT,
      false, 'Código de acceso inválido o no existe'::TEXT,
      NULL::TIMESTAMPTZ, 5, true, 'inactive'::TEXT, 1,
      false::BOOLEAN;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_asamblea.id, v_asamblea.nombre, v_asamblea.fecha, v_asamblea.organization_id,
    v_asamblea.nombre_conjunto, true, 'Código válido. Acceso permitido.'::TEXT,
    v_asamblea.participacion_timer_end_at,
    COALESCE(v_asamblea.participacion_timer_default_minutes, 5),
    COALESCE(v_asamblea.participacion_timer_enabled, true),
    v_asamblea.session_mode, v_asamblea.session_seq,
    COALESCE(v_asamblea.registro_poderes_publico, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_limite_poderes(p_asamblea_id uuid, p_email_receptor text, p_organization_id uuid)
 RETURNS TABLE(puede_recibir_poder boolean, poderes_actuales integer, limite_maximo integer, mensaje text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_poderes_actuales INTEGER;
  v_limite_maximo INTEGER;
BEGIN
  -- Obtener límite configurado para este conjunto
  SELECT max_poderes_por_apoderado INTO v_limite_maximo
  FROM configuracion_poderes
  WHERE organization_id = p_organization_id;
  
  -- Si no hay configuración, usar límite por defecto de 3
  IF v_limite_maximo IS NULL THEN
    v_limite_maximo := 3;
  END IF;
  
  -- Contar poderes activos que ya tiene este receptor en esta asamblea
  SELECT COUNT(*) INTO v_poderes_actuales
  FROM poderes
  WHERE asamblea_id = p_asamblea_id
    AND email_receptor = p_email_receptor
    AND estado = 'activo';
  
  -- Determinar si puede recibir más poderes
  RETURN QUERY
  SELECT 
    (v_poderes_actuales < v_limite_maximo) AS puede_recibir_poder,
    v_poderes_actuales AS poderes_actuales,
    v_limite_maximo AS limite_maximo,
    CASE 
      WHEN v_poderes_actuales < v_limite_maximo THEN 'Puede recibir más poderes'
      ELSE 'Ha alcanzado el límite máximo de poderes (' || v_limite_maximo || ')'
    END AS mensaje;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_votante_asamblea(p_codigo_asamblea text, p_email_votante text)
 RETURNS TABLE(puede_votar boolean, unidades_propias uuid[], unidades_poderes uuid[], total_unidades integer, total_coeficiente numeric, mensaje text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_asamblea_id UUID;
  v_organization_id UUID;
  v_unidades_propias UUID[];
  v_unidades_poderes UUID[];
  v_total_coef NUMERIC;
BEGIN
  -- Validar código de asamblea
  SELECT asamblea_id, organization_id INTO v_asamblea_id, v_organization_id
  FROM validar_codigo_acceso(p_codigo_asamblea)
  WHERE acceso_valido = true;

  IF v_asamblea_id IS NULL THEN
    RETURN QUERY
    SELECT 
      false AS puede_votar,
      NULL::UUID[],
      NULL::UUID[],
      0 AS total_unidades,
      0::NUMERIC AS total_coeficiente,
      'Código de asamblea inválido' AS mensaje;
    RETURN;
  END IF;

  -- Buscar unidades propias (donde el email coincide)
  SELECT ARRAY_AGG(id)
  INTO v_unidades_propias
  FROM unidades
  WHERE organization_id = v_organization_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(p_email_votante));

  -- Buscar unidades con poderes activos
  SELECT ARRAY_AGG(p.unidad_otorgante_id)
  INTO v_unidades_poderes
  FROM poderes p
  WHERE p.asamblea_id = v_asamblea_id
    AND p.estado = 'activo'
    AND LOWER(TRIM(p.email_receptor)) = LOWER(TRIM(p_email_votante));

  -- Si no tiene unidades propias ni poderes
  IF v_unidades_propias IS NULL AND v_unidades_poderes IS NULL THEN
    RETURN QUERY
    SELECT 
      false AS puede_votar,
      NULL::UUID[],
      NULL::UUID[],
      0 AS total_unidades,
      0::NUMERIC AS total_coeficiente,
      'Este email no tiene unidades ni poderes registrados en este conjunto' AS mensaje;
    RETURN;
  END IF;

  -- Calcular coeficiente total
  SELECT COALESCE(SUM(coeficiente), 0)
  INTO v_total_coef
  FROM unidades
  WHERE id = ANY(COALESCE(v_unidades_propias, ARRAY[]::UUID[]) || COALESCE(v_unidades_poderes, ARRAY[]::UUID[]));

  -- Todo OK
  RETURN QUERY
  SELECT 
    true AS puede_votar,
    COALESCE(v_unidades_propias, ARRAY[]::UUID[]) AS unidades_propias,
    COALESCE(v_unidades_poderes, ARRAY[]::UUID[]) AS unidades_poderes,
    COALESCE(array_length(v_unidades_propias, 1), 0) + COALESCE(array_length(v_unidades_poderes, 1), 0) AS total_unidades,
    v_total_coef AS total_coeficiente,
    'Votante válido' AS mensaje;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_votante_registro_poderes(p_codigo_asamblea text, p_email_votante text)
 RETURNS TABLE(puede_votar boolean, unidades_propias uuid[], unidades_poderes uuid[], total_unidades integer, total_coeficiente numeric, mensaje text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_asamblea_id UUID;
  v_organization_id UUID;
  v_is_demo BOOLEAN;
  v_sandbox_reales BOOLEAN;
  v_unidades_is_demo BOOLEAN;
  v_unidades_propias UUID[];
  v_unidades_poderes UUID[];
  v_total_coef NUMERIC;
  v_identificador TEXT := LOWER(TRIM(p_email_votante));
  v_telefono_norm TEXT;
  v_es_email BOOLEAN := (v_identificador LIKE '%@%');
BEGIN
  SELECT a.id, a.organization_id
  INTO v_asamblea_id, v_organization_id
  FROM public.asambleas a
  WHERE a.codigo_acceso = UPPER(TRIM(p_codigo_asamblea));

  IF v_asamblea_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID[], NULL::UUID[], 0, 0::NUMERIC, 'Código de asamblea inválido'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(a.is_demo, false), COALESCE(a.sandbox_usar_unidades_reales, false)
  INTO v_is_demo, v_sandbox_reales
  FROM public.asambleas a
  WHERE a.id = v_asamblea_id;

  v_unidades_is_demo := CASE WHEN v_is_demo AND v_sandbox_reales THEN false ELSE v_is_demo END;

  IF v_es_email THEN
    SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
    FROM public.unidades u
    WHERE u.organization_id = v_organization_id
      AND u.is_demo = v_unidades_is_demo
      AND LOWER(TRIM(COALESCE(u.email, u.email_propietario, ''))) = v_identificador;
  ELSE
    v_telefono_norm := public.normalizar_telefono(p_email_votante);
    SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
    FROM public.unidades u
    WHERE u.organization_id = v_organization_id
      AND u.is_demo = v_unidades_is_demo
      AND v_telefono_norm IS NOT NULL
      AND public.normalizar_telefono(COALESCE(u.telefono, u.telefono_propietario, '')) = v_telefono_norm;
  END IF;

  IF v_es_email THEN
    SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
    FROM public.poderes p
    JOIN public.unidades u ON u.id = p.unidad_otorgante_id AND u.organization_id = v_organization_id AND u.is_demo = v_unidades_is_demo
    WHERE p.asamblea_id = v_asamblea_id
      AND p.estado = 'activo'
      AND LOWER(TRIM(p.email_receptor)) = v_identificador;
  END IF;

  IF v_is_demo AND NOT v_sandbox_reales AND v_unidades_propias IS NULL AND v_unidades_poderes IS NULL
     AND v_es_email AND v_identificador ~ '^test[0-9]+@asambleas\.online$' THEN
    PERFORM public.asegurar_unidades_demo_organizacion(v_organization_id);
    v_unidades_is_demo := true;
    SELECT ARRAY_AGG(u.id) INTO v_unidades_propias
    FROM public.unidades u
    WHERE u.organization_id = v_organization_id
      AND u.is_demo = true
      AND LOWER(TRIM(COALESCE(u.email, u.email_propietario, ''))) = v_identificador;
    SELECT ARRAY_AGG(p.unidad_otorgante_id) INTO v_unidades_poderes
    FROM public.poderes p
    JOIN public.unidades u ON u.id = p.unidad_otorgante_id AND u.organization_id = v_organization_id AND u.is_demo = true
    WHERE p.asamblea_id = v_asamblea_id
      AND p.estado = 'activo'
      AND LOWER(TRIM(p.email_receptor)) = v_identificador;
  END IF;

  IF v_unidades_propias IS NULL AND v_unidades_poderes IS NULL THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID[],
      NULL::UUID[],
      0,
      0::NUMERIC,
      'No hay unidades ni poderes registrados con ese email o teléfono en este conjunto'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(uni.coeficiente), 0) INTO v_total_coef
  FROM public.unidades uni
  WHERE uni.id = ANY(COALESCE(v_unidades_propias, ARRAY[]::UUID[]) || COALESCE(v_unidades_poderes, ARRAY[]::UUID[]));

  RETURN QUERY SELECT
    true,
    COALESCE(v_unidades_propias, ARRAY[]::UUID[]),
    COALESCE(v_unidades_poderes, ARRAY[]::UUID[]),
    COALESCE(array_length(v_unidades_propias, 1), 0) + COALESCE(array_length(v_unidades_poderes, 1), 0),
    v_total_coef,
    'Votante válido'::TEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ya_verifico_asistencia(p_asamblea_id uuid, p_email text, p_pregunta_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM verificacion_asistencia_registro r
      JOIN quorum_asamblea qa ON qa.id = r.quorum_asamblea_id
     WHERE r.asamblea_id = p_asamblea_id
       AND LOWER(TRIM(qa.email_propietario)) = LOWER(TRIM(p_email))
       AND (r.pregunta_id IS NOT DISTINCT FROM p_pregunta_id)
  );
END;
$function$
;

-- Triggers

CREATE TRIGGER trg_asambleas_punto_actual_misma_asamblea BEFORE INSERT OR UPDATE OF punto_orden_dia_actual_id ON asambleas FOR EACH ROW EXECUTE FUNCTION asambleas_punto_actual_misma_asamblea();
CREATE TRIGGER trg_asambleas_verificacion_sesion AFTER UPDATE OF verificacion_asistencia_activa ON asambleas FOR EACH ROW EXECUTE FUNCTION trg_verificacion_asistencia_sesion();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER planes_updated_at BEFORE UPDATE ON planes FOR EACH ROW EXECUTE FUNCTION planes_updated_at();
CREATE TRIGGER trg_preguntas_punto_misma_asamblea BEFORE INSERT OR UPDATE OF punto_orden_dia_id, asamblea_id ON preguntas FOR EACH ROW EXECUTE FUNCTION preguntas_punto_misma_asamblea();
CREATE TRIGGER trigger_tokens_bienvenida BEFORE INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION set_tokens_bienvenida();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_quorum_presence_touch BEFORE UPDATE ON quorum_presence FOR EACH ROW EXECUTE FUNCTION quorum_touch_updated_at();
CREATE TRIGGER trg_quorum_presence_config_touch BEFORE UPDATE ON quorum_presence_config FOR EACH ROW EXECUTE FUNCTION quorum_touch_updated_at();
CREATE TRIGGER trg_quorum_presence_units_touch BEFORE UPDATE ON quorum_presence_units FOR EACH ROW EXECUTE FUNCTION quorum_touch_updated_at();
CREATE TRIGGER update_unidades_updated_at BEFORE UPDATE ON unidades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views

CREATE OR REPLACE VIEW public.vista_participacion_votantes AS  SELECT p.id AS pregunta_id,
    p.texto_pregunta,
    v.votante_email,
    v.votante_nombre,
    count(v.id) AS unidades_votadas,
    sum(u.coeficiente) AS coeficiente_total_votado,
    sum(
        CASE
            WHEN v.es_poder THEN 1
            ELSE 0
        END) AS votos_con_poder,
    min(v.created_at) AS primer_voto,
    max(v.created_at) AS ultimo_voto
   FROM ((votos v
     JOIN preguntas p ON ((v.pregunta_id = p.id)))
     JOIN unidades u ON ((v.unidad_id = u.id)))
  GROUP BY p.id, p.texto_pregunta, v.votante_email, v.votante_nombre;

CREATE OR REPLACE VIEW public.vista_poderes_completa AS  SELECT p.id,
    p.asamblea_id,
    p.unidad_otorgante_id,
    p.unidad_receptor_id,
    p.email_otorgante,
    p.nombre_otorgante,
    p.email_receptor,
    p.nombre_receptor,
    p.estado,
    p.archivo_poder,
    p.observaciones,
    p.created_at,
    p.revocado_at,
    u_otorgante.numero AS unidad_otorgante_numero,
    u_otorgante.torre AS unidad_otorgante_torre,
    u_otorgante.coeficiente AS coeficiente_delegado,
    u_otorgante.tipo AS tipo_unidad_otorgante,
    u_receptor.numero AS unidad_receptor_numero,
    u_receptor.torre AS unidad_receptor_torre,
    u_receptor.coeficiente AS coeficiente_receptor,
    a.nombre AS asamblea_nombre,
    a.fecha AS asamblea_fecha,
    a.estado AS asamblea_estado
   FROM (((poderes p
     JOIN unidades u_otorgante ON ((p.unidad_otorgante_id = u_otorgante.id)))
     LEFT JOIN unidades u_receptor ON ((p.unidad_receptor_id = u_receptor.id)))
     JOIN asambleas a ON ((p.asamblea_id = a.id)));

-- Row Level Security (enable)

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asambleas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_asamblea ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_legal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_poderes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_smtp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimiento_tratamiento_datos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_votos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opciones_pregunta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_checkout_ref ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poderes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_temp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_orden_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quorum_asamblea ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quorum_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quorum_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quorum_presence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quorum_presence_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quorum_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesion_token_consumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verificacion_asamblea_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verificacion_asistencia_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votos ENABLE ROW LEVEL SECURITY;

-- RLS policies

DROP POLICY IF EXISTS app_config_no_public ON public.app_config;
CREATE POLICY app_config_no_public ON public.app_config AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS asambleas_anon_select_publicas ON public.asambleas;
CREATE POLICY asambleas_anon_select_publicas ON public.asambleas AS PERMISSIVE FOR SELECT TO anon USING ((acceso_publico = true));

DROP POLICY IF EXISTS asambleas_auth_delete_org ON public.asambleas;
CREATE POLICY asambleas_auth_delete_org ON public.asambleas AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))) AND (p.organization_id = asambleas.organization_id)))));

DROP POLICY IF EXISTS asambleas_auth_insert_org ON public.asambleas;
CREATE POLICY asambleas_auth_insert_org ON public.asambleas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))) AND (p.organization_id = asambleas.organization_id)))));

DROP POLICY IF EXISTS asambleas_auth_select_org ON public.asambleas;
CREATE POLICY asambleas_auth_select_org ON public.asambleas AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))) AND (p.organization_id = asambleas.organization_id)))));

DROP POLICY IF EXISTS asambleas_auth_update_org ON public.asambleas;
CREATE POLICY asambleas_auth_update_org ON public.asambleas AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))) AND (p.organization_id = asambleas.organization_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))) AND (p.organization_id = asambleas.organization_id)))));

DROP POLICY IF EXISTS super_admin_full_asambleas ON public.asambleas;
CREATE POLICY super_admin_full_asambleas ON public.asambleas AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS authenticated_temp_all_billing_logs ON public.billing_logs;
CREATE POLICY authenticated_temp_all_billing_logs ON public.billing_logs AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS configuracion_asamblea_insert_own ON public.configuracion_asamblea;
CREATE POLICY configuracion_asamblea_insert_own ON public.configuracion_asamblea AS PERMISSIVE FOR INSERT TO public WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid) = user_id));

DROP POLICY IF EXISTS configuracion_asamblea_select_own ON public.configuracion_asamblea;
CREATE POLICY configuracion_asamblea_select_own ON public.configuracion_asamblea AS PERMISSIVE FOR SELECT TO public USING ((( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid) = user_id));

DROP POLICY IF EXISTS configuracion_asamblea_update_own ON public.configuracion_asamblea;
CREATE POLICY configuracion_asamblea_update_own ON public.configuracion_asamblea AS PERMISSIVE FOR UPDATE TO public USING ((( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid) = user_id)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid) = user_id));

DROP POLICY IF EXISTS configuracion_global_read_public ON public.configuracion_global;
CREATE POLICY configuracion_global_read_public ON public.configuracion_global AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS configuracion_global_write_service_only ON public.configuracion_global;
CREATE POLICY configuracion_global_write_service_only ON public.configuracion_global AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS configuracion_legal_read_public ON public.configuracion_legal;
CREATE POLICY configuracion_legal_read_public ON public.configuracion_legal AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS configuracion_legal_write_service_only ON public.configuracion_legal;
CREATE POLICY configuracion_legal_write_service_only ON public.configuracion_legal AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS authenticated_temp_all_configuracion_poderes ON public.configuracion_poderes;
CREATE POLICY authenticated_temp_all_configuracion_poderes ON public.configuracion_poderes AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS configuracion_smtp_service_only ON public.configuracion_smtp;
CREATE POLICY configuracion_smtp_service_only ON public.configuracion_smtp AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS configuracion_whatsapp_service_only ON public.configuracion_whatsapp;
CREATE POLICY configuracion_whatsapp_service_only ON public.configuracion_whatsapp AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Servicio puede gestionar consentimientos" ON public.consentimiento_tratamiento_datos;
CREATE POLICY "Servicio puede gestionar consentimientos" ON public.consentimiento_tratamiento_datos AS PERMISSIVE FOR ALL TO service_role USING ((( SELECT auth.role() AS role) = 'service_role'::text)) WITH CHECK ((( SELECT auth.role() AS role) = 'service_role'::text));

DROP POLICY IF EXISTS authenticated_temp_all_historial_votos ON public.historial_votos;
CREATE POLICY authenticated_temp_all_historial_votos ON public.historial_votos AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS super_admin_full_historial_votos ON public.historial_votos;
CREATE POLICY super_admin_full_historial_votos ON public.historial_votos AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS opciones_anon_select_publicas ON public.opciones_pregunta;
CREATE POLICY opciones_anon_select_publicas ON public.opciones_pregunta AS PERMISSIVE FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM (preguntas pr
     JOIN asambleas a ON ((a.id = pr.asamblea_id)))
  WHERE ((pr.id = opciones_pregunta.pregunta_id) AND (a.acceso_publico = true)))));

DROP POLICY IF EXISTS opciones_auth_all_org ON public.opciones_pregunta;
CREATE POLICY opciones_auth_all_org ON public.opciones_pregunta AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((preguntas pr
     JOIN asambleas a ON ((a.id = pr.asamblea_id)))
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((pr.id = opciones_pregunta.pregunta_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((preguntas pr
     JOIN asambleas a ON ((a.id = pr.asamblea_id)))
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((pr.id = opciones_pregunta.pregunta_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)))))));

DROP POLICY IF EXISTS super_admin_full_opciones_pregunta ON public.opciones_pregunta;
CREATE POLICY super_admin_full_opciones_pregunta ON public.opciones_pregunta AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Anyone can create organizations" ON public.organizations;
CREATE POLICY "Anyone can create organizations" ON public.organizations AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK ((( SELECT auth.role() AS role) = ANY (ARRAY['anon'::text, 'authenticated'::text])));

DROP POLICY IF EXISTS authenticated_temp_all_organizations ON public.organizations;
CREATE POLICY authenticated_temp_all_organizations ON public.organizations AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS orgs_owner_all ON public.organizations;
CREATE POLICY orgs_owner_all ON public.organizations AS PERMISSIVE FOR ALL TO public USING ((( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid) = owner_id)) WITH CHECK ((( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid) = owner_id));

DROP POLICY IF EXISTS super_admin_full_organizations ON public.organizations;
CREATE POLICY super_admin_full_organizations ON public.organizations AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS pagos_checkout_ref_service_only ON public.pagos_checkout_ref;
CREATE POLICY pagos_checkout_ref_service_only ON public.pagos_checkout_ref AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS authenticated_temp_all_pagos_historial ON public.pagos_historial;
CREATE POLICY authenticated_temp_all_pagos_historial ON public.pagos_historial AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS super_admin_full_pagos_historial ON public.pagos_historial;
CREATE POLICY super_admin_full_pagos_historial ON public.pagos_historial AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS pagos_log_no_direct_client ON public.pagos_log;
CREATE POLICY pagos_log_no_direct_client ON public.pagos_log AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS planes_read_public ON public.planes;
CREATE POLICY planes_read_public ON public.planes AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS planes_write_service_only ON public.planes;
CREATE POLICY planes_write_service_only ON public.planes AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS poderes_auth_all_org ON public.poderes;
CREATE POLICY poderes_auth_all_org ON public.poderes AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (asambleas a
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((a.id = poderes.asamblea_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (asambleas a
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((a.id = poderes.asamblea_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)))))));

DROP POLICY IF EXISTS super_admin_full_poderes ON public.poderes;
CREATE POLICY super_admin_full_poderes ON public.poderes AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS preguntas_anon_select_publicas ON public.preguntas;
CREATE POLICY preguntas_anon_select_publicas ON public.preguntas AS PERMISSIVE FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM asambleas a
  WHERE ((a.id = preguntas.asamblea_id) AND (a.acceso_publico = true)))));

DROP POLICY IF EXISTS preguntas_auth_all_org ON public.preguntas;
CREATE POLICY preguntas_auth_all_org ON public.preguntas AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (asambleas a
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((a.id = preguntas.asamblea_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (asambleas a
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((a.id = preguntas.asamblea_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)))))));

DROP POLICY IF EXISTS super_admin_full_preguntas ON public.preguntas;
CREATE POLICY super_admin_full_preguntas ON public.preguntas AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS authenticated_temp_all_profiles ON public.profiles;
CREATE POLICY authenticated_temp_all_profiles ON public.profiles AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS super_admin_full_profiles ON public.profiles;
CREATE POLICY super_admin_full_profiles ON public.profiles AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS authenticated_temp_all_profiles_temp ON public.profiles_temp;
CREATE POLICY authenticated_temp_all_profiles_temp ON public.profiles_temp AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS puntos_orden_dia_anon_select_publicas ON public.puntos_orden_dia;
CREATE POLICY puntos_orden_dia_anon_select_publicas ON public.puntos_orden_dia AS PERMISSIVE FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM asambleas a
  WHERE ((a.id = puntos_orden_dia.asamblea_id) AND (a.acceso_publico = true)))));

DROP POLICY IF EXISTS puntos_orden_dia_auth_all_org ON public.puntos_orden_dia;
CREATE POLICY puntos_orden_dia_auth_all_org ON public.puntos_orden_dia AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (asambleas a
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((a.id = puntos_orden_dia.asamblea_id) AND ((p.id = auth.uid()) OR (p.user_id = auth.uid())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (asambleas a
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((a.id = puntos_orden_dia.asamblea_id) AND ((p.id = auth.uid()) OR (p.user_id = auth.uid()))))));

DROP POLICY IF EXISTS quorum_auth_all_org ON public.quorum_asamblea;
CREATE POLICY quorum_auth_all_org ON public.quorum_asamblea AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (asambleas a
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((a.id = quorum_asamblea.asamblea_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (asambleas a
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((a.id = quorum_asamblea.asamblea_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)))))));

DROP POLICY IF EXISTS super_admin_full_quorum_asamblea ON public.quorum_asamblea;
CREATE POLICY super_admin_full_quorum_asamblea ON public.quorum_asamblea AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS super_admin_accounts_no_direct_write ON public.super_admin_accounts;
CREATE POLICY super_admin_accounts_no_direct_write ON public.super_admin_accounts AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS super_admin_accounts_select_authenticated ON public.super_admin_accounts;
CREATE POLICY super_admin_accounts_select_authenticated ON public.super_admin_accounts AS PERMISSIVE FOR SELECT TO public USING ((( SELECT ( SELECT ( SELECT ( SELECT auth.role() AS role) AS role) AS role) AS role) = 'authenticated'::text));

DROP POLICY IF EXISTS super_admin_full_unidades ON public.unidades;
CREATE POLICY super_admin_full_unidades ON public.unidades AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS unidades_anon_select_publicas_por_org ON public.unidades;
CREATE POLICY unidades_anon_select_publicas_por_org ON public.unidades AS PERMISSIVE FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM asambleas a
  WHERE ((a.organization_id = unidades.organization_id) AND ((a.acceso_publico = true) OR (a.token_delegado IS NOT NULL))))));

DROP POLICY IF EXISTS unidades_auth_all_org ON public.unidades;
CREATE POLICY unidades_auth_all_org ON public.unidades AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))) AND (p.organization_id = unidades.organization_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))) AND (p.organization_id = unidades.organization_id)))));

DROP POLICY IF EXISTS authenticated_temp_all_verificacion_asamblea_sesiones ON public.verificacion_asamblea_sesiones;
CREATE POLICY authenticated_temp_all_verificacion_asamblea_sesiones ON public.verificacion_asamblea_sesiones AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS authenticated_temp_all_verificacion_asistencia_registro ON public.verificacion_asistencia_registro;
CREATE POLICY authenticated_temp_all_verificacion_asistencia_registro ON public.verificacion_asistencia_registro AS PERMISSIVE FOR ALL TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL)) WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));

DROP POLICY IF EXISTS super_admin_full_votos ON public.votos;
CREATE POLICY super_admin_full_votos ON public.votos AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS votos_anon_select_publicos ON public.votos;
CREATE POLICY votos_anon_select_publicos ON public.votos AS PERMISSIVE FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM (preguntas pr
     JOIN asambleas a ON ((a.id = pr.asamblea_id)))
  WHERE ((pr.id = votos.pregunta_id) AND (a.acceso_publico = true)))));

DROP POLICY IF EXISTS votos_auth_all_org ON public.votos;
CREATE POLICY votos_auth_all_org ON public.votos AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((preguntas pr
     JOIN asambleas a ON ((a.id = pr.asamblea_id)))
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((pr.id = votos.pregunta_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((preguntas pr
     JOIN asambleas a ON ((a.id = pr.asamblea_id)))
     JOIN profiles p ON ((p.organization_id = a.organization_id)))
  WHERE ((pr.id = votos.pregunta_id) AND ((p.id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)) OR (p.user_id = ( SELECT ( SELECT ( SELECT ( SELECT auth.uid() AS uid) AS uid) AS uid) AS uid)))))));

-- Table comments

COMMENT ON TABLE public.app_config IS 'Configuración de aplicación; super_admin_email define el correo del super administrador';
COMMENT ON TABLE public.asambleas IS 'Almacena las asambleas de copropietarios';
COMMENT ON TABLE public.billing_logs IS 'Auditoría de cobro: cada descuento o acreditación de tokens del gestor';
COMMENT ON TABLE public.configuracion_asamblea IS 'Preferencias de visualización de asamblea por usuario y conjunto; default del cronómetro (minutos)';
COMMENT ON TABLE public.configuracion_global IS 'Configuración global (landing: título, subtítulo, WhatsApp) editable desde Super Admin';
COMMENT ON TABLE public.configuracion_legal IS 'Documentos legales editables desde Super Admin';
COMMENT ON TABLE public.configuracion_poderes IS 'Configuración de límites para poderes por conjunto';
COMMENT ON TABLE public.configuracion_smtp IS 'Configuración SMTP para envío de correo (enlace de votación). Editable solo por Super Admin. Solo service_role puede leer/escribir.';
COMMENT ON TABLE public.configuracion_whatsapp IS 'Configuración WhatsApp Business API (Meta). Token, Phone Number ID, plantilla y tokens a descontar por mensaje.';
COMMENT ON TABLE public.consentimiento_tratamiento_datos IS 'Aceptación del tratamiento de datos personales por votante y asamblea (Ley 1581 de 2012, LOPD)';
COMMENT ON TABLE public.historial_votos IS 'Registro completo de todos los votos y modificaciones (trazabilidad Ley 675)';
COMMENT ON TABLE public.opciones_pregunta IS 'Opciones de respuesta para cada pregunta de votación';
COMMENT ON TABLE public.organizations IS 'Tabla de copropiedades para gestion de asambleas';
COMMENT ON TABLE public.pagos_checkout_ref IS 'Mapeo ref (sku del link Wompi) -> user_id para acreditar tokens en el webhook';
COMMENT ON TABLE public.pagos_historial IS 'Historial de transacciones de pago confirmadas por conjunto';
COMMENT ON TABLE public.pagos_log IS 'Log de transacciones Wompi por conjunto';
COMMENT ON TABLE public.planes IS 'Planes (free, pro, pilot) con nombre y precio; editable desde super-admin';
COMMENT ON TABLE public.poderes IS 'Poderes otorgados entre propietarios para votar en asambleas';
COMMENT ON TABLE public.preguntas IS 'Preguntas de votación para cada asamblea';
COMMENT ON TABLE public.puntos_orden_dia IS 'Puntos del orden del día (agenda); las preguntas pueden asociarse opcionalmente a un punto.';
COMMENT ON TABLE public.quorum_asamblea IS 'Registro de asistencia (física o virtual) a asambleas';
COMMENT ON TABLE public.sesion_token_consumos IS 'Cobro LOPD por unidad y sesión; evita doble cobro multi-dispositivo (UNIQUE asamblea+seq+unidad)';
COMMENT ON TABLE public.super_admin_accounts IS 'Listado de super admins adicionales gestionables desde la app.';
COMMENT ON TABLE public.verificacion_asamblea_sesiones IS 'Cada fila = una vez que se abrió la verificación de asistencia (asamblea en general). Al cerrar se rellena cierre_at y el snapshot.';
COMMENT ON TABLE public.verificacion_asistencia_registro IS 'Una fila por (unidad en asamblea, contexto). pregunta_id null = verificación general; no null = verificación asociada a esa pregunta.';
COMMENT ON TABLE public.votos IS 'Registro de todos los votos emitidos en asambleas';
