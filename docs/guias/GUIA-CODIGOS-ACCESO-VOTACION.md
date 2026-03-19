# 🔐 Guía: Sistema de Códigos de Acceso para Votación

## 🎯 ¿Cómo funciona?

### Sistema: **Código Único por Asamblea**

Cada asamblea tiene un código único tipo: **`A2K9-X7M4`**

**URL completa:**
```
https://tu-dominio.com/votar/A2K9-X7M4
```

---

## 📱 Flujo Completo (Administrador → Residente)

### 1. **Administrador Crea la Asamblea**

```
┌─────────────────────────────────────┐
│  📋 Nueva Asamblea Creada          │
│  Asamblea Ordinaria 2026            │
│  Fecha: 15 de Febrero 2026         │
│  Estado: 📝 Borrador                │
└─────────────────────────────────────┘
```

### 2. **Administrador Genera el Código**

```
┌─────────────────────────────────────┐
│  🔓 Activar Votación Pública       │
├─────────────────────────────────────┤
│  ⚠️ Esto generará un enlace público │
│     para que los residentes voten   │
│                                      │
│  [Cancelar] [Activar Votación]     │
└─────────────────────────────────────┘
```

**El sistema genera automáticamente:**
- ✅ Código único: `A2K9-X7M4`
- ✅ URL: `https://tu-dominio.com/votar/A2K9-X7M4`

### 3. **Panel de Compartir (Para Administrador)**

```
┌─────────────────────────────────────┐
│  ✅ Votación Pública Activada      │
├─────────────────────────────────────┤
│  Código de Acceso:                  │
│  ┌───────────────────────────────┐ │
│  │  A2K9-X7M4                    │ │
│  └───────────────────────────────┘ │
│  [📋 Copiar Código]                 │
│                                      │
│  Enlace para Votar:                 │
│  ┌───────────────────────────────┐ │
│  │ https://tu-dominio.com/votar/ │ │
│  │ A2K9-X7M4                     │ │
│  └───────────────────────────────┘ │
│  [📋 Copiar Enlace]                 │
│  [📱 Compartir por WhatsApp]       │
│  [📧 Enviar por Email]             │
│                                      │
│  [🔒 Desactivar Acceso Público]    │
└─────────────────────────────────────┘
```

### 4. **Mensaje de WhatsApp (Ejemplo)**

El administrador puede copiar y pegar:

```
📢 ASAMBLEA ORDINARIA 2026
Conjunto Residencial Las Palmas

📅 Fecha: 15 de Febrero 2026
🕒 Hora: 10:00 AM

🗳️ VOTACIÓN DISPONIBLE

Para votar, ingresa a:
👉 https://tu-dominio.com/votar/A2K9-X7M4

O usa el código: A2K9-X7M4

⚠️ Necesitas tu email registrado en el conjunto

Preguntas:
1️⃣ Aprobación del presupuesto 2026
2️⃣ Modificación del reglamento
3️⃣ Contratación de vigilancia

¡Tu voto es importante! 🏠
```

---

## 🗳️ Flujo del Residente (Votante)

### **Paso 1: Acceso**

El residente hace clic en el enlace o va a la página y ingresa el código:

```
┌─────────────────────────────────────┐
│  🗳️  Votación Virtual              │
├─────────────────────────────────────┤
│  Ingresa el código de tu asamblea:  │
│  ┌───────────────────────────────┐ │
│  │ A2K9-X7M4                     │ │
│  └───────────────────────────────┘ │
│  [Continuar]                        │
└─────────────────────────────────────┘
```

### **Paso 2: Validación del Código**

El sistema valida:
- ✅ Código existe
- ✅ Acceso público está activo
- ✅ Muestra info de la asamblea

```
┌─────────────────────────────────────┐
│  ✅ Código Válido                   │
├─────────────────────────────────────┤
│  📋 Asamblea Ordinaria 2026         │
│  🏢 Conjunto Residencial Las Palmas │
│  📅 15 de Febrero 2026              │
│                                      │
│  Ingresa tu email para continuar:   │
│  ┌───────────────────────────────┐ │
│  │ maria@email.com               │ │
│  └───────────────────────────────┘ │
│  [Continuar]                        │
└─────────────────────────────────────┘
```

### **Paso 3: Validación del Votante**

El sistema busca:
1. **Unidades propias**: ¿El email está en la tabla `unidades`?
2. **Poderes activos**: ¿Tiene poderes otorgados en esta asamblea?

```sql
-- El sistema ejecuta internamente:
SELECT * FROM validar_votante_asamblea(
  p_codigo_asamblea := 'A2K9-X7M4',
  p_email_votante := 'maria@email.com'
);
```

**Si es válido:**

```
┌─────────────────────────────────────┐
│  ✅ Bienvenida, María García        │
├─────────────────────────────────────┤
│  Estás votando por:                 │
│                                      │
│  🏠 Apto 303 - Torre A              │
│     (Tu unidad)                     │
│     Coeficiente: 1.5%               │
│                                      │
│  📝 Apto 101 - Torre A              │
│     (Poder de Juan Pérez)           │
│     Coeficiente: 2.0%               │
│                                      │
│  📝 Apto 202 - Torre B              │
│     (Poder de Pedro López)          │
│     Coeficiente: 3.0%               │
│                                      │
│  ┌─────────────────────────────┐  │
│  │ TOTAL: 3 unidades           │  │
│  │ Coeficiente: 6.5%           │  │
│  └─────────────────────────────┘  │
│                                      │
│  [Continuar a Votar]                │
└─────────────────────────────────────┘
```

**Si NO es válido:**

```
┌─────────────────────────────────────┐
│  ⚠️ Email No Autorizado             │
├─────────────────────────────────────┤
│  El email maria@email.com no está   │
│  registrado en este conjunto y no   │
│  tiene poderes activos.             │
│                                      │
│  Contacta al administrador si       │
│  crees que es un error.             │
│                                      │
│  [Intentar con otro email]          │
└─────────────────────────────────────┘
```

### **Paso 4: Votar**

Ya explicado en `GUIA-SISTEMA-VOTACION-PUBLICA.md`

---

## 🔧 Implementación Técnica

### **Funciones SQL Creadas:**

1. **`generar_codigo_acceso()`**
   - Genera código alfanumérico único
   - Formato: `A2K9-X7M4` (sin 0, O, 1, I para evitar confusión)

2. **`activar_votacion_publica(asamblea_id, base_url)`**
   - Genera código único
   - Crea URL completa
   - Activa `acceso_publico = true`

3. **`desactivar_votacion_publica(asamblea_id)`**
   - Desactiva acceso (sin borrar código)
   - Útil para cerrar votación temporalmente

4. **`validar_codigo_acceso(codigo)`**
   - Valida si el código existe
   - Verifica si está activo
   - Retorna info de la asamblea

5. **`validar_votante_asamblea(codigo, email)`**
   - Parámetro: **email o teléfono** (identificador del votante).
   - Busca unidades por email o por teléfono (columnas `email`/`email_propietario` y `telefono`/`telefono_propietario`).
   - Busca poderes activos (por email del receptor).
   - Retorna lista completa de unidades que puede representar.

**Si la votación con teléfono/celular no funciona:** en Supabase SQL Editor ejecuta el script `supabase/VALIDAR-VOTANTE-EMAIL-O-TELEFONO-UNIFICADO.sql`. Así la función validará por email o teléfono usando todas las columnas posibles en `unidades`.

---

## 🎨 UI: Botón en Detalle de Asamblea (Admin)

**En:** `app/dashboard/asambleas/[id]/page.tsx`

```typescript
// Agregar este botón en el panel de información de la asamblea:

{!asamblea.acceso_publico ? (
  <Button onClick={handleActivarVotacion}>
    🔓 Activar Votación Pública
  </Button>
) : (
  <div className="bg-green-50 p-4 rounded">
    <h4>✅ Votación Pública Activa</h4>
    
    <div className="mt-2">
      <label>Código:</label>
      <div className="flex gap-2">
        <input 
          value={asamblea.codigo_acceso} 
          readOnly 
          className="font-mono text-2xl"
        />
        <Button onClick={() => copy(asamblea.codigo_acceso)}>
          📋 Copiar
        </Button>
      </div>
    </div>
    
    <div className="mt-2">
      <label>Enlace:</label>
      <div className="flex gap-2">
        <input 
          value={asamblea.url_publica} 
          readOnly 
        />
        <Button onClick={() => copy(asamblea.url_publica)}>
          📋 Copiar
        </Button>
        <Button onClick={handleCompartirWhatsApp}>
          📱 WhatsApp
        </Button>
      </div>
    </div>
    
    <Button 
      variant="destructive" 
      onClick={handleDesactivarVotacion}
      className="mt-2"
    >
      🔒 Desactivar Acceso
    </Button>
  </div>
)}
```

---

## 🔐 Seguridad

### **Validaciones:**

1. ✅ **Código único por asamblea**
2. ✅ **Solo funciona si `acceso_publico = true`**
3. ✅ **Email debe existir en `unidades` o en `poderes`**
4. ✅ **Cada unidad solo puede votar una vez**
5. ✅ **Trazabilidad completa en `historial_votos`**

### **Protección contra abusos:**

- Código se puede desactivar en cualquier momento
- Registro de IP y User-Agent
- Solo emails registrados pueden votar
- No se puede votar dos veces por la misma unidad

---

## 📊 Ejemplo de Uso Real

### **Escenario:**

**Conjunto "Las Palmas" con 50 unidades**

1. Admin crea asamblea → Estado: Borrador
2. Admin activa la asamblea → Estado: Activa
3. Admin agrega 3 preguntas
4. Admin abre las preguntas → Estado: Abiertas
5. Admin activa votación pública → Código: `M3P7-R9K2`
5. Admin comparte enlace por WhatsApp
6. **María** (Apto 303) vota por sus 3 unidades (1 propia + 2 poderes)
7. **Juan** (Apto 101) vota por su unidad
8. **Pedro** intenta votar pero ya María votó por su unidad (poder) → ✅ Sistema lo permite porque Pedro tiene su propia unidad
9. Sistema calcula quórum en tiempo real
10. Admin cierra preguntas cuando termine
11. Admin desactiva acceso público
12. Admin exporta reporte a PDF

---

## 🚀 Próximos Pasos

1. ✅ **Ejecutar SQL**: `AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql`
2. ⏳ **Actualizar interfaz admin**: Agregar botón "Activar Votación"
3. ⏳ **Crear página pública**: `/votar/[codigo]`
4. ⏳ **Implementar validación de acceso**
5. ⏳ **Testing completo**

---

**¿Quieres que implemente ahora la interfaz de administrador con los botones para generar y compartir el código?** 🚀
