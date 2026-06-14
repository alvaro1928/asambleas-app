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
