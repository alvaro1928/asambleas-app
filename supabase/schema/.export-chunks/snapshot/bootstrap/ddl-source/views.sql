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
