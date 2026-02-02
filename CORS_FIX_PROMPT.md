# Solución para Error de CORS - Preflight Request

## Problema
El frontend está recibiendo el error:
```
Access to XMLHttpRequest at 'http://localhost:5000/api/auth/login' from origin 'http://localhost:5173' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Causa del Problema

Cuando el navegador envía una petición POST con `Content-Type: application/json`, automáticamente envía primero una **petición preflight OPTIONS** al servidor. El backend debe responder correctamente a esta petición OPTIONS antes de que el navegador permita la petición POST real.

El error indica que el backend **NO está respondiendo correctamente** a la petición OPTIONS, aunque pueda estar configurado para aceptar el origen en las peticiones normales.

## Solución en el Backend (.NET)

### 1. Configurar CORS Correctamente

El backend debe estar configurado para:
- Responder a las peticiones OPTIONS (preflight)
- Incluir los headers de CORS necesarios en la respuesta OPTIONS
- Permitir los métodos y headers que el frontend está usando

**Código para Program.cs (ASP.NET Core):**

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",  // Vite dev server
                "https://tu-dominio-produccion.com"  // Producción
            )
            .AllowAnyMethod()  // Permite GET, POST, PUT, DELETE, OPTIONS, etc.
            .AllowAnyHeader()  // Permite Content-Type, Authorization, etc.
            .AllowCredentials();  // Solo si usas cookies/sesiones
    });
});

var app = builder.Build();

// IMPORTANTE: UseCors debe ir ANTES de UseAuthentication y UseAuthorization
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
```

### 2. Verificar que el Middleware Responda a OPTIONS

Si estás usando un middleware personalizado, asegúrate de que NO bloquee las peticiones OPTIONS:

```csharp
app.Use(async (context, next) =>
{
    // Permitir que las peticiones OPTIONS pasen sin autenticación
    if (context.Request.Method == "OPTIONS")
    {
        await next();
        return;
    }
    
    // Tu lógica de middleware aquí
    await next();
});
```

### 3. Si Usas [Authorize] en Controladores

Si tus controladores tienen `[Authorize]`, las peticiones OPTIONS pueden estar siendo bloqueadas. Tienes dos opciones:

**Opción A: Permitir OPTIONS sin autenticación**

```csharp
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    [HttpOptions]  // Permitir OPTIONS sin autenticación
    [AllowAnonymous]
    public IActionResult Options()
    {
        return Ok();
    }
    
    [HttpPost("login")]
    [AllowAnonymous]  // O el endpoint que necesites
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        // Tu lógica aquí
    }
}
```

**Opción B: Configurar CORS para manejar OPTIONS automáticamente**

Si usas `AllowAnyMethod()` en la política de CORS, ASP.NET Core debería manejar OPTIONS automáticamente. Si no funciona, agrega esto:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .SetPreflightMaxAge(TimeSpan.FromSeconds(86400));  // Cache preflight por 24 horas
    });
});
```

### 4. Verificar Headers Específicos

Si el problema persiste, verifica que el backend permita explícitamente los headers que estás enviando:

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyMethod()
            .WithHeaders(
                "Content-Type",
                "Authorization",
                "Accept",
                "X-Requested-With"
            )
            .AllowCredentials();
    });
});
```

### 5. Verificar el Orden de los Middlewares

El orden es **CRÍTICO**. Debe ser exactamente este:

```csharp
var app = builder.Build();

// 1. PRIMERO: Manejo de headers forward (si usas proxy)
app.UseForwardedHeaders();

// 2. SEGUNDO: CORS (debe ir ANTES de autenticación)
app.UseCors("AllowFrontend");

// 3. TERCERO: Autenticación
app.UseAuthentication();

// 4. CUARTO: Autorización
app.UseAuthorization();

// 5. ÚLTIMO: Rutas
app.MapControllers();
```

### 6. Si Usas Middleware Personalizado que Intercepta OPTIONS

Si tienes middleware personalizado que intercepta todas las peticiones, asegúrate de que permita OPTIONS:

```csharp
app.Use(async (context, next) =>
{
    // Si es OPTIONS, dejar que CORS lo maneje
    if (context.Request.Method == "OPTIONS")
    {
        await next();
        return;
    }
    
    // Tu lógica aquí
    await next();
});
```

## Verificación

### 1. Probar la Petición OPTIONS Manualmente

Desde la terminal, prueba si el backend responde correctamente a OPTIONS:

```bash
curl -X OPTIONS http://localhost:5000/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v
```

**Respuesta esperada:**
```
< HTTP/1.1 204 No Content
< Access-Control-Allow-Origin: http://localhost:5173
< Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE
< Access-Control-Allow-Headers: Content-Type, Authorization, Accept
< Access-Control-Max-Age: 86400
```

### 2. Verificar en el Navegador

Abre las DevTools del navegador (F12) y ve a la pestaña Network:
1. Busca la petición OPTIONS (debería aparecer antes del POST)
2. Verifica que tenga status 200 o 204
3. Verifica que los headers de respuesta incluyan `Access-Control-Allow-Origin`

## Checklist de Verificación

- [ ] CORS está configurado con `WithOrigins("http://localhost:5173")`
- [ ] `AllowAnyMethod()` está incluido (o al menos incluye OPTIONS)
- [ ] `AllowAnyHeader()` está incluido (o incluye Content-Type y Authorization)
- [ ] `UseCors()` está ANTES de `UseAuthentication()` y `UseAuthorization()`
- [ ] No hay middleware personalizado que bloquee peticiones OPTIONS
- [ ] La petición OPTIONS manual (con curl) devuelve los headers correctos
- [ ] El backend está corriendo en `http://localhost:5000`

## Problemas Comunes

### Problema 1: CORS configurado pero OPTIONS devuelve 404
**Solución:** Asegúrate de que `UseCors()` esté antes de `MapControllers()` y que no haya rutas que intercepten OPTIONS.

### Problema 2: OPTIONS devuelve 401 Unauthorized
**Solución:** Las peticiones OPTIONS NO deben requerir autenticación. Asegúrate de que `UseCors()` esté antes de `UseAuthentication()`.

### Problema 3: Headers de CORS no aparecen en la respuesta
**Solución:** Verifica que la política de CORS esté correctamente aplicada y que el origen coincida exactamente (incluyendo el puerto).

### Problema 4: Funciona en Postman pero no en el navegador
**Solución:** Postman no aplica CORS. El problema está en la configuración del backend para peticiones desde el navegador.

## Nota Importante

El frontend ya está configurado correctamente. El problema está **100% en el backend**. El backend debe:
1. Responder a las peticiones OPTIONS con status 200/204
2. Incluir los headers `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, y `Access-Control-Allow-Headers` en la respuesta OPTIONS
3. Permitir que las peticiones OPTIONS pasen sin autenticación

