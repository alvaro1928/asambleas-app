# k6 (Grafana) – Pruebas de carga

[k6](https://k6.io/) es una herramienta de prueba de carga y rendimiento. Los scripts en esta carpeta simulan muchos usuarios accediendo a la app a la vez.

---

## 1. Instalar k6

### Windows (Chocolatey)
```powershell
choco install k6
```

### Windows (winget)
```powershell
winget install k6 --source winget
```

### Windows (manual)
Descarga el binario desde [Releases · grafana/k6](https://github.com/grafana/k6/releases) y añade la carpeta al PATH.

### macOS (Homebrew)
```bash
brew install k6
```

### Linux
```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

Más opciones: [k6 docs – Installation](https://k6.io/docs/get-started/installation/).

---

## 2. Ejecutar las pruebas

### Prueba moderada (hasta ~100 usuarios)
```bash
k6 run k6/load-test.js
```

Contra tu app en producción:
```bash
k6 run k6/load-test.js -e BASE_URL=https://asambleas-app-epbco.vercel.app
```

### Prueba fuerte (hasta ~500 usuarios)
```bash
k6 run k6/load-test-500.js -e BASE_URL=https://tu-dominio.vercel.app
```

### Solo 10 iteraciones (prueba rápida)
```bash
k6 run --vus 10 --duration 30s k6/load-test.js
```

---

## 3. Qué hace cada script

| Script | Usuarios máximos | Duración aprox. | Qué prueba |
|--------|-------------------|-----------------|------------|
| `load-test.js` | 100 | ~5 min | Login, home, `/api/client-info` |
| `load-test-500.js` | 500 | ~9 min | Login bajo mucha carga |

`BASE_URL` por defecto es `http://localhost:3000`. Cámbialo con `-e BASE_URL=...` para probar producción.

---

## 4. Cómo leer el resultado

Al terminar, k6 muestra algo como:

- **http_req_duration**: tiempo de respuesta (avg, min, max, p(95)).
- **http_reqs**: peticiones por segundo.
- **iterations**: cuántas veces se ejecutó el script (una “iteración” = un usuario virtual haciendo el flujo).
- **vus**: usuarios virtuales activos.

Si `http_req_failed` supera el umbral configurado (p. ej. 5%), la prueba “falla” y verás qué checks no pasaron.

---

## 5. Añadir más escenarios

Puedes copiar `load-test.js` y añadir:

- **Login con POST**: si quieres probar muchos logins, necesitas credenciales de prueba (o un usuario por iteración) y hacer `http.post(BASE_URL + '/api/auth/callback', ...)` según tu flujo real.
- **Página de votación**: `http.get(BASE_URL + '/votar/' + CODIGO)` usando un código de acceso de prueba.
- **Dashboard**: requiere sesión (cookies); se puede hacer con `http.get(..., { cookies: { ... } })` si tienes una sesión de prueba.

Si quieres, en un siguiente paso se puede crear un script que haga login (POST) y luego pida el dashboard con cookies.
