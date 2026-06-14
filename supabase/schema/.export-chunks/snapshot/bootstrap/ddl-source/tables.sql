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
