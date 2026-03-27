-- Fases 2 y 3: optimizaciones de votación sin romper acceso móvil.
-- Ejecutar en Supabase SQL Editor en una ventana de mantenimiento.

-- 1) Índices funcionales para búsqueda por identificador (email/teléfono).
create index if not exists idx_unidades_org_demo_email_lower
  on public.unidades (organization_id, is_demo, lower(email));

create index if not exists idx_unidades_org_demo_email_prop_lower
  on public.unidades (organization_id, is_demo, lower(email_propietario));

create index if not exists idx_poderes_asamblea_estado_email_lower
  on public.poderes (asamblea_id, estado, lower(email_receptor));

-- 2) Batch de estadísticas por pregunta para reducir roundtrips.
drop function if exists public.calcular_estadisticas_preguntas(uuid[]);
create or replace function public.calcular_estadisticas_preguntas(p_pregunta_ids uuid[])
returns table (
  pregunta_id uuid,
  total_votos numeric,
  total_coeficiente numeric,
  coeficiente_total_conjunto numeric,
  porcentaje_participacion numeric,
  tipo_votacion text,
  resultados jsonb
)
language sql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.calcular_estadisticas_preguntas(uuid[]) to anon, authenticated, service_role;

-- 3) Wrapper de voto público en una sola operación.
-- Mantiene validación de código + autorización de unidad + registro con trazabilidad.
drop function if exists public.registrar_voto_publico_seguro(text, uuid, uuid, uuid, text, text, boolean, uuid, inet, text);
create or replace function public.registrar_voto_publico_seguro(
  p_codigo text,
  p_pregunta_id uuid,
  p_unidad_id uuid,
  p_opcion_id uuid,
  p_votante_identificador text,
  p_votante_nombre text,
  p_es_poder boolean default false,
  p_poder_id uuid default null,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns table (ok boolean, mensaje text)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.registrar_voto_publico_seguro(text, uuid, uuid, uuid, text, text, boolean, uuid, inet, text)
  to anon, authenticated, service_role;
