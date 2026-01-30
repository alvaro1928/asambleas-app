# 🔐 Resumen: ¿Cómo Acceden las Personas a Votar?

## 🎯 Sistema Simple: **1 Código por Asamblea**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ADMINISTRADOR                                          │
│  ↓                                                      │
│  1. Crea Asamblea                                      │
│  2. Clic en "Activar Votación Pública"                │
│  3. Sistema genera: A2K9-X7M4                         │
│  4. Comparte por WhatsApp/Email                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  RESIDENTES                                             │
│  ↓                                                      │
│  1. Reciben enlace: tu-app.com/votar/A2K9-X7M4        │
│  2. Ingresan su email                                  │
│  3. Sistema detecta automáticamente:                   │
│     • Sus unidades propias                            │
│     • Poderes que le otorgaron                        │
│  4. Votan por todas sus unidades                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📱 Mensaje de WhatsApp (Lo que envías)

```
🗳️ ASAMBLEA VIRTUAL ACTIVA

Conjunto: Las Palmas
Fecha: 15/Feb/2026

👉 Vota aquí:
https://tu-app.com/votar/A2K9-X7M4

⚠️ Necesitas tu email registrado

¡Tu participación es importante! 🏠
```

---

## ✅ Lo que el Sistema Hace Automáticamente

| Paso | Sistema |
|------|---------|
| 1️⃣ Validar código | ✅ Verifica que el código existe y está activo |
| 2️⃣ Validar email | ✅ Busca el email en unidades del conjunto |
| 3️⃣ Buscar poderes | ✅ Detecta si tiene poderes activos en esta asamblea |
| 4️⃣ Mostrar unidades | ✅ Lista todas las unidades por las que puede votar |
| 5️⃣ Permitir votar | ✅ Registra votos con trazabilidad completa |
| 6️⃣ Mostrar quórum | ✅ Actualiza estadísticas en tiempo real |

---

## 🔐 Seguridad

✅ **Solo emails registrados pueden votar**
- El email debe estar en alguna unidad del conjunto
- O tener un poder activo en esta asamblea

✅ **Una unidad = Un voto**
- Aunque María tenga el poder de Juan, Juan no puede votar de nuevo por su unidad

✅ **Trazabilidad**
- Registro completo de quién votó, cuándo y cómo

✅ **Código se puede desactivar**
- El admin puede cerrar el acceso en cualquier momento

---

## 📋 Archivos SQL

**Ejecuta en Supabase:**

1. `AGREGAR-TRAZABILIDAD-VOTOS.sql` ✅ (Ya creado)
   - Sistema de historial de votos
   - Función para votar con trazabilidad

2. `AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql` ✅ (Ya creado)
   - Genera códigos únicos
   - Valida acceso
   - Detecta poderes automáticamente

---

## 🚀 ¿Qué Sigue?

**Opción A: Interfaz Completa** (recomendado)
- Panel de admin para generar código
- Botón "Compartir por WhatsApp"
- Página pública `/votar/[codigo]`
- Todo el flujo funcional

**Opción B: Solo Backend**
- Ejecutar los SQL
- Agregar funcionalidad después

---

**¿Ejecutamos los SQL scripts primero?** 

Solo necesitas ir a Supabase Dashboard > SQL Editor y ejecutar estos 2 archivos:

1. `AGREGAR-TRAZABILIDAD-VOTOS.sql`
2. `AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql`

¿Los ejecuto o te ayudo con eso? 🚀
