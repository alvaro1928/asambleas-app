# 🔐 Sistema de Seguridad: Verificación por OTP (Email)

## 🎯 Objetivo

Asegurar que solo el propietario real de cada unidad pueda votar, mediante verificación por código enviado al email registrado.

---

## 🔒 ¿Cómo Funciona?

### **Flujo Completo con OTP:**

```
1. Usuario accede con código de asamblea (A2K9-X7M4)
   ↓
2. Usuario ingresa su email
   ↓
3. Sistema valida:
   - ✅ Email existe en unidades del conjunto
   - ✅ Email tiene poderes activos
   ↓
4. Sistema genera código OTP de 6 dígitos (válido 10 min)
   ↓
5. Sistema envía email:
   "Tu código de verificación es: 847392"
   ↓
6. Usuario ingresa el código OTP
   ↓
7. Sistema valida OTP
   ↓
8. ✅ ACCESO AUTORIZADO → Usuario puede votar
```

---

## 📊 Base de Datos

### **Tabla: `otp_votacion`**

```sql
CREATE TABLE otp_votacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asamblea_id UUID REFERENCES asambleas(id) NOT NULL,
  email TEXT NOT NULL,
  codigo_otp TEXT NOT NULL,
  usado BOOLEAN DEFAULT false,
  expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
  intentos INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_otp_email ON otp_votacion(email);
CREATE INDEX idx_otp_codigo ON otp_votacion(codigo_otp);
CREATE INDEX idx_otp_expiracion ON otp_votacion(expira_en);
```

---

## 🔧 Funciones SQL

### **1. Generar OTP**

```sql
CREATE OR REPLACE FUNCTION generar_otp(
  p_asamblea_id UUID,
  p_email TEXT
)
RETURNS TABLE (
  codigo TEXT,
  expira_en TIMESTAMP WITH TIME ZONE,
  mensaje TEXT
) AS $$
DECLARE
  v_codigo TEXT;
  v_expira TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Generar código de 6 dígitos
  v_codigo := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Expiración: 10 minutos
  v_expira := NOW() + INTERVAL '10 minutes';
  
  -- Invalidar códigos anteriores
  UPDATE otp_votacion
  SET usado = true
  WHERE email = p_email
    AND asamblea_id = p_asamblea_id
    AND usado = false;
  
  -- Insertar nuevo código
  INSERT INTO otp_votacion (asamblea_id, email, codigo_otp, expira_en)
  VALUES (p_asamblea_id, p_email, v_codigo, v_expira);
  
  RETURN QUERY
  SELECT 
    v_codigo AS codigo,
    v_expira AS expira_en,
    'Código generado exitosamente' AS mensaje;
END;
$$ LANGUAGE plpgsql;
```

### **2. Validar OTP**

```sql
CREATE OR REPLACE FUNCTION validar_otp(
  p_asamblea_id UUID,
  p_email TEXT,
  p_codigo_ingresado TEXT
)
RETURNS TABLE (
  valido BOOLEAN,
  token_sesion TEXT,
  mensaje TEXT
) AS $$
DECLARE
  v_otp RECORD;
  v_token TEXT;
BEGIN
  -- Buscar OTP
  SELECT * INTO v_otp
  FROM otp_votacion
  WHERE asamblea_id = p_asamblea_id
    AND email = p_email
    AND codigo_otp = p_codigo_ingresado
    AND usado = false
    AND expira_en > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Si no existe o ya expiró
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      false AS valido,
      NULL::TEXT AS token_sesion,
      'Código inválido o expirado' AS mensaje;
    RETURN;
  END IF;
  
  -- Marcar como usado
  UPDATE otp_votacion
  SET usado = true
  WHERE id = v_otp.id;
  
  -- Generar token de sesión (válido 24 horas)
  v_token := encode(
    digest(
      p_email || p_asamblea_id::TEXT || NOW()::TEXT || RANDOM()::TEXT,
      'sha256'
    ),
    'hex'
  );
  
  RETURN QUERY
  SELECT 
    true AS valido,
    v_token AS token_sesion,
    'Verificación exitosa' AS mensaje;
END;
$$ LANGUAGE plpgsql;
```

---

## 📧 Email Template

### **Asunto:** Código de Verificación - Votación Asamblea

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
    <h2 style="color: #1a73e8;">🗳️ Verificación de Votación</h2>
    
    <p>Hola,</p>
    
    <p>Has solicitado acceso para votar en:</p>
    <p><strong>{{NOMBRE_ASAMBLEA}}</strong><br>
    <strong>{{NOMBRE_CONJUNTO}}</strong></p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="color: #666; margin-bottom: 10px;">Tu código de verificación es:</p>
      <h1 style="color: #1a73e8; font-size: 48px; letter-spacing: 8px; margin: 10px 0;">
        {{CODIGO_OTP}}
      </h1>
      <p style="color: #999; font-size: 14px;">Este código expira en 10 minutos</p>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      ⚠️ Si no solicitaste este código, ignora este mensaje.
    </p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    
    <p style="color: #999; font-size: 12px;">
      Este es un correo automático, por favor no respondas.
    </p>
  </div>
</body>
</html>
```

---

## 🖥️ Interfaz de Usuario

### **Paso 1: Solicitar Verificación**

```typescript
// app/votar/[codigo]/page.tsx

const [step, setStep] = useState<'email' | 'otp' | 'votar'>('email')
const [email, setEmail] = useState('')
const [loading, setLoading] = useState(false)

const handleSolicitarOTP = async () => {
  setLoading(true)
  
  try {
    // 1. Validar que el email existe
    const { data: validacion } = await supabase.rpc('validar_votante_asamblea', {
      p_codigo_asamblea: codigoAsamblea,
      p_email_votante: email
    })
    
    if (!validacion.puede_votar) {
      alert(validacion.mensaje)
      return
    }
    
    // 2. Generar y enviar OTP
    const { data: otp } = await supabase.rpc('generar_otp', {
      p_asamblea_id: asambleaId,
      p_email: email
    })
    
    // 3. Enviar email (vía API Route)
    await fetch('/api/enviar-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        codigo: otp.codigo,
        nombreAsamblea: asamblea.nombre,
        nombreConjunto: asamblea.conjunto
      })
    })
    
    setStep('otp')
    alert('Hemos enviado un código de verificación a tu email')
    
  } catch (error) {
    console.error(error)
    alert('Error al enviar código')
  } finally {
    setLoading(false)
  }
}
```

### **Paso 2: Validar OTP**

```typescript
const [codigoOTP, setCodigoOTP] = useState('')

const handleValidarOTP = async () => {
  setLoading(true)
  
  try {
    const { data: resultado } = await supabase.rpc('validar_otp', {
      p_asamblea_id: asambleaId,
      p_email: email,
      p_codigo_ingresado: codigoOTP
    })
    
    if (!resultado.valido) {
      alert(resultado.mensaje)
      return
    }
    
    // Guardar token en sessionStorage
    sessionStorage.setItem('votacion_token', resultado.token_sesion)
    sessionStorage.setItem('votacion_email', email)
    
    setStep('votar')
    
  } catch (error) {
    console.error(error)
    alert('Error al validar código')
  } finally {
    setLoading(false)
  }
}
```

### **UI Visual:**

```tsx
{step === 'email' && (
  <div className="max-w-md mx-auto p-6">
    <h2>Verificación de Identidad</h2>
    <p>Ingresa tu email para recibir un código de verificación</p>
    
    <input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder="tu@email.com"
      className="w-full p-3 border rounded"
    />
    
    <Button onClick={handleSolicitarOTP} disabled={loading}>
      {loading ? 'Enviando...' : 'Enviar Código'}
    </Button>
  </div>
)}

{step === 'otp' && (
  <div className="max-w-md mx-auto p-6">
    <h2>Ingresa el Código</h2>
    <p>Hemos enviado un código de 6 dígitos a:</p>
    <p className="font-bold">{email}</p>
    
    <div className="flex gap-2 justify-center my-4">
      {[0,1,2,3,4,5].map((i) => (
        <input
          key={i}
          type="text"
          maxLength={1}
          className="w-12 h-14 text-center text-2xl border-2 rounded"
          onChange={(e) => handleOTPInput(i, e.target.value)}
        />
      ))}
    </div>
    
    <Button onClick={handleValidarOTP} disabled={loading}>
      {loading ? 'Verificando...' : 'Verificar Código'}
    </Button>
    
    <button onClick={handleReenviarOTP} className="text-sm text-blue-600">
      ¿No recibiste el código? Reenviar
    </button>
  </div>
)}

{step === 'votar' && (
  <div>
    {/* Aquí va la interfaz de votación */}
    <h2>¡Bienvenido!</h2>
    <p>Estás votando por:</p>
    {/* Lista de unidades... */}
  </div>
)}
```

---

## 🔐 Seguridad Adicional

### **Protección contra ataques:**

1. **Límite de intentos:**
```sql
-- Máximo 3 intentos por email cada 10 minutos
CREATE OR REPLACE FUNCTION limitar_intentos_otp(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_intentos INT;
BEGIN
  SELECT COUNT(*) INTO v_intentos
  FROM otp_votacion
  WHERE email = p_email
    AND created_at > NOW() - INTERVAL '10 minutes';
  
  RETURN v_intentos < 3;
END;
$$ LANGUAGE plpgsql;
```

2. **Rate limiting por IP:**
```typescript
// En la API Route
const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
// Registrar y limitar intentos por IP
```

3. **Auditoría:**
```sql
-- Tabla de auditoría
CREATE TABLE auditoria_otp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  ip_address TEXT,
  accion TEXT,
  exito BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ Ventajas de OTP

| Aspecto | Sin OTP | Con OTP |
|---------|---------|---------|
| Suplantación | ❌ Posible | ✅ Imposible (requiere acceso al email) |
| Facilidad | ✅ Muy fácil | ✅ Fácil (1 paso más) |
| Seguridad | ⚠️ Baja | ✅ Alta |
| Legal | ⚠️ Cuestionable | ✅ Cumple normativas |
| Costo | Gratis | ~$0.0001/email |

---

## 🚀 Implementación

**Archivos a crear:**

1. `supabase/AGREGAR-SISTEMA-OTP.sql` (funciones SQL)
2. `app/api/enviar-otp/route.ts` (envío de emails)
3. Actualizar `app/votar/[codigo]/page.tsx` (UI de OTP)

---

**¿Quieres que implemente este sistema OTP completo ahora?** 🚀
