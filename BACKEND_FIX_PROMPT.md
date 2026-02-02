# Prompt para Backend .NET - Solución ERR_TOO_MANY_REDIRECTS

## Problema
El frontend está recibiendo el error `ERR_TOO_MANY_REDIRECTS` al hacer peticiones a los endpoints:
- `GET /api/v1/MultiClick`
- `GET /api/v1/MultiClick/GetMultiClickEnergyContract`

El error indica que el servidor está entrando en un bucle de redirecciones infinitas.

## Diagnóstico y Solución

### 1. Verificar Middleware de Redirección HTTPS

**Problema común:** El middleware `UseHttpsRedirection()` puede causar bucles si:
- El servidor está detrás de un proxy/load balancer que maneja HTTPS
- Los headers `X-Forwarded-Proto` no están configurados correctamente

**Solución:**

```csharp
// Program.cs o Startup.cs

// Si estás detrás de un proxy/ingress (como Kubernetes), configura:
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | 
                               ForwardedHeaders.XForwardedProto | 
                               ForwardedHeaders.XForwardedHost;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// IMPORTANTE: UseForwardedHeaders debe ir ANTES de UseHttpsRedirection
app.UseForwardedHeaders();

// Solo redirigir HTTPS si NO estás detrás de un proxy que ya maneja HTTPS
// Si estás en Kubernetes con ingress, COMENTA o ELIMINA esta línea:
// app.UseHttpsRedirection();
```

**Alternativa si necesitas HTTPS redirection:**
```csharp
// Solo redirigir si la petición NO viene de un proxy
app.UseWhen(context => !context.Request.Headers.ContainsKey("X-Forwarded-Proto"), 
    appBuilder => appBuilder.UseHttpsRedirection());
```

### 2. Verificar Configuración de CORS

**Problema común:** CORS mal configurado puede causar redirecciones.

**Solución:**

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("https://tu-dominio-frontend.com", 
                          "http://localhost:5173") // Desarrollo
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Solo si usas cookies
    });
});

var app = builder.Build();

// IMPORTANTE: UseCors debe ir ANTES de UseAuthentication/UseAuthorization
app.UseCors("AllowFrontend");
```

### 3. Verificar Middleware de Autenticación

**Problema común:** Si el middleware de autenticación redirige en lugar de devolver 401, puede causar bucles.

**Solución:**

```csharp
// Asegúrate de que los endpoints de API NO redirijan, solo devuelvan 401/403
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // ... configuración JWT
        options.Events = new JwtBearerEvents
        {
            OnChallenge = context =>
            {
                // NO redirigir, solo devolver 401
                context.HandleResponse();
                context.Response.StatusCode = 401;
                context.Response.ContentType = "application/json";
                return Task.CompletedTask;
            }
        };
    });

// En el middleware, asegúrate de que no haya redirecciones:
app.UseAuthentication();
app.UseAuthorization();
```

### 4. Verificar Rutas y Endpoints

**Problema común:** Rutas que redirigen a sí mismas.

**Solución:**

```csharp
// Verifica que tus controladores NO tengan redirecciones en los endpoints:
[ApiController]
[Route("api/v1/[controller]")]
public class MultiClickController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        // ❌ NO hacer esto:
        // return Redirect("/api/v1/MultiClick");
        
        // ✅ Hacer esto:
        var data = await _service.GetData();
        return Ok(data);
    }
}
```

### 5. Verificar Configuración de Kubernetes/Ingress

Si estás usando Kubernetes con ingress, asegúrate de que:

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: beta-omip-httpapi
  annotations:
    # IMPORTANTE: Configurar correctamente para evitar redirecciones
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "false"  # No forzar si ya es HTTPS
    nginx.ingress.kubernetes.io/proxy-redirect-from: "http://"
    nginx.ingress.kubernetes.io/proxy-redirect-to: "https://"
    # O si usas otro ingress controller, ajusta según corresponda
spec:
  tls:
    - hosts:
        - beta-omip-httpapi.sucapp.com
      secretName: omip-httpapi-tls
  rules:
    - host: beta-omip-httpapi.sucapp.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: omip-httpapi
                port:
                  number: 80  # El servicio interno puede ser HTTP
```

### 6. Verificar Headers y Proxy

Si estás detrás de un proxy (Kubernetes Ingress, Nginx, etc.):

```csharp
// Program.cs
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.All;
    // Si conoces las IPs de tus proxies, agrégalas:
    // options.KnownProxies.Add(IPAddress.Parse("10.0.0.0/8"));
    // options.KnownProxies.Add(IPAddress.Parse("172.16.0.0/12"));
    // options.KnownProxies.Add(IPAddress.Parse("192.168.0.0/16"));
    
    // Para desarrollo/testing, permite todos:
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

// Orden CRÍTICO de middleware:
app.UseForwardedHeaders();  // PRIMERO
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
// app.UseHttpsRedirection();  // COMENTAR si el proxy ya maneja HTTPS
app.MapControllers();
```

### 7. Logging para Diagnóstico

Agrega logging temporal para diagnosticar:

```csharp
app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    logger.LogInformation("Request: {Method} {Path} {Scheme} {Headers}",
        context.Request.Method,
        context.Request.Path,
        context.Request.Scheme,
        string.Join(", ", context.Request.Headers.Select(h => $"{h.Key}: {h.Value}")));
    
    await next();
    
    logger.LogInformation("Response: {StatusCode}", context.Response.StatusCode);
});
```

### 8. Verificar que los Endpoints NO Redirijan

Asegúrate de que tus controladores devuelvan JSON, no redirecciones:

```csharp
[HttpGet]
[Route("GetMultiClickEnergyContract")]
public async Task<IActionResult> GetMultiClickEnergyContract(
    [FromQuery] string customerNo,
    [FromQuery] string marketerNo,
    // ... otros parámetros
)
{
    try
    {
        var result = await _service.GetContracts(customerNo, marketerNo);
        return Ok(result);  // ✅ Devuelve 200 OK con JSON
        // ❌ NO hacer: return Redirect(...);
    }
    catch (UnauthorizedAccessException)
    {
        return Unauthorized();  // ✅ Devuelve 401, NO redirige
    }
    catch (Exception ex)
    {
        return StatusCode(500, new { error = ex.Message });  // ✅ Devuelve 500 con JSON
    }
}
```

## Checklist de Verificación

- [ ] `UseHttpsRedirection()` está comentado o condicionado si estás detrás de un proxy
- [ ] `UseForwardedHeaders()` está configurado y va ANTES de otros middlewares
- [ ] CORS está configurado correctamente y va ANTES de autenticación
- [ ] Los endpoints devuelven JSON (Ok, BadRequest, Unauthorized) en lugar de redirecciones
- [ ] El middleware de autenticación NO redirige, solo devuelve 401
- [ ] El ingress de Kubernetes está configurado correctamente
- [ ] Los headers `X-Forwarded-Proto` están siendo procesados correctamente

## Prueba Rápida

Para probar si el problema es HTTPS redirection:

1. Comenta temporalmente `app.UseHttpsRedirection()` en `Program.cs`
2. Despliega y prueba
3. Si funciona, el problema es la configuración de HTTPS redirection
4. Si no funciona, el problema está en otro middleware o en la lógica de los endpoints

## Comando para Probar desde Terminal

```bash
# Probar directamente el endpoint (sin redirecciones del navegador)
curl -v -H "Authorization: Bearer TU_TOKEN" \
     https://beta-omip-httpapi.sucapp.com/api/v1/MultiClick

# Si ves múltiples respuestas 301/302, hay un bucle de redirecciones
```



