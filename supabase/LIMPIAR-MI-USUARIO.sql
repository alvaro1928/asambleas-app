-- ================================================================
-- SCRIPT PARA LIMPIAR DATOS DE UN USUARIO ESPECÍFICO
-- ================================================================
-- Este script borra todos los datos asociados a UN usuario específico
-- Cambia 'tu-email@ejemplo.com' por tu email real
-- ================================================================

-- ⚠️  CAMBIA ESTE EMAIL POR EL TUYO
DO $$
DECLARE
    mi_user_id UUID;
    mi_email TEXT := 'alvarocontreras35@gmail.com'; -- 👈 CAMBIA ESTO
BEGIN
    -- Obtener el ID del usuario
    SELECT id INTO mi_user_id
    FROM profiles
    WHERE email = mi_email;

    IF mi_user_id IS NULL THEN
        RAISE NOTICE '❌ No se encontró el usuario con email: %', mi_email;
        RETURN;
    END IF;

    RAISE NOTICE '🔍 Limpiando datos del usuario: % (ID: %)', mi_email, mi_user_id;

    -- 1. Borrar votos e historial del usuario
    DELETE FROM historial_votos 
    WHERE voto_id IN (
        SELECT id FROM votos WHERE votante_email = mi_email
    );
    
    DELETE FROM votos WHERE votante_email = mi_email;
    RAISE NOTICE '✅ Votos eliminados';

    -- 2. Borrar opciones y preguntas de asambleas del usuario
    DELETE FROM opciones_pregunta 
    WHERE pregunta_id IN (
        SELECT p.id FROM preguntas p
        JOIN asambleas a ON p.asamblea_id = a.id
        JOIN organizations o ON a.organization_id = o.id
        WHERE o.owner_id = mi_user_id
    );
    RAISE NOTICE '✅ Opciones de preguntas eliminadas';

    DELETE FROM preguntas 
    WHERE asamblea_id IN (
        SELECT a.id FROM asambleas a
        JOIN organizations o ON a.organization_id = o.id
        WHERE o.owner_id = mi_user_id
    );
    RAISE NOTICE '✅ Preguntas eliminadas';

    -- 3. Borrar poderes y configuraciones de asambleas del usuario
    DELETE FROM poderes 
    WHERE asamblea_id IN (
        SELECT a.id FROM asambleas a
        JOIN organizations o ON a.organization_id = o.id
        WHERE o.owner_id = mi_user_id
    );
    RAISE NOTICE '✅ Poderes eliminados';

    DELETE FROM configuracion_poderes 
    WHERE asamblea_id IN (
        SELECT a.id FROM asambleas a
        JOIN organizations o ON a.organization_id = o.id
        WHERE o.owner_id = mi_user_id
    );
    RAISE NOTICE '✅ Configuraciones de poderes eliminadas';

    -- 4. Borrar asambleas del usuario
    DELETE FROM asambleas 
    WHERE organization_id IN (
        SELECT id FROM organizations WHERE owner_id = mi_user_id
    );
    RAISE NOTICE '✅ Asambleas eliminadas';

    -- 5. Borrar unidades del usuario
    DELETE FROM unidades 
    WHERE organization_id IN (
        SELECT id FROM organizations WHERE owner_id = mi_user_id
    );
    RAISE NOTICE '✅ Unidades eliminadas';

    -- 6. Borrar conjuntos del usuario
    DELETE FROM organizations WHERE owner_id = mi_user_id;
    RAISE NOTICE '✅ Conjuntos eliminados';

    RAISE NOTICE '🎉 Limpieza completada para: %', mi_email;

END $$;

-- ================================================================
-- VERIFICACIÓN: Contar mis registros restantes
-- ================================================================
SELECT 
    'Mis conjuntos' as tipo,
    COUNT(*) as cantidad
FROM organizations o
JOIN profiles p ON o.owner_id = p.id
WHERE p.email = 'alvarocontreras35@gmail.com' -- 👈 CAMBIA ESTO

UNION ALL

SELECT 
    'Mis unidades',
    COUNT(*)
FROM unidades u
JOIN organizations o ON u.organization_id = o.id
JOIN profiles p ON o.owner_id = p.id
WHERE p.email = 'alvarocontreras35@gmail.com' -- 👈 CAMBIA ESTO

UNION ALL

SELECT 
    'Mis asambleas',
    COUNT(*)
FROM asambleas a
JOIN organizations o ON a.organization_id = o.id
JOIN profiles p ON o.owner_id = p.id
WHERE p.email = 'alvarocontreras35@gmail.com'; -- 👈 CAMBIA ESTO

-- ================================================================
-- ✅ Si todo está en 0, tu cuenta está limpia
-- ================================================================
