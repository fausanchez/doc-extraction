# Production Readiness Audit — dvop.io

> Auditoría realizada el 2026-05-02 sobre el estado del monorepo tras la implementación del plan de 15 PRs.

---

## CRITICAL

### 1. Sin índices en la base de datos

**Archivo:** `apps/api/src/db/schema.ts`

Las tablas `documents`, `extractions` y `templates` no tienen índices en `user_id`. Cada request hace un full-table scan. Con volumen real el sistema se degrada severamente.

**Fix:**
```sql
CREATE INDEX documents_user_id_idx      ON documents(user_id);
CREATE INDEX extractions_user_id_idx    ON extractions(user_id);
CREATE INDEX extractions_document_id_idx ON extractions(document_id);
CREATE INDEX templates_user_id_idx      ON templates(user_id);
```

En Drizzle ORM, agregar en el schema:
```ts
export const documents = sqliteTable('documents', { ... }, (t) => ({
  userIdIdx: index('documents_user_id_idx').on(t.userId),
}))
```

---

### 2. Endpoints de lista sin paginación en la API

**Archivos:**
- `apps/api/src/router/documents.ts`
- `apps/api/src/router/extractions.ts`
- `apps/api/src/router/templates.ts`

Los tres endpoints `GET /` devuelven **todos** los registros sin `LIMIT/OFFSET`. La paginación client-side del frontend no resuelve esto — la DB sigue enviando todos los registros al Worker. Un usuario con 100k documentos puede crashear el servicio.

**Fix:** Implementar cursor-based o offset/limit pagination en los tres endpoints y exponer `?page=&limit=` como query params.

---

### 3. Sin límite de tamaño en uploads a nivel servidor

**Archivo:** `apps/api/src/router/documents.ts`

El límite de 10 MB solo se valida en el cliente (`apps/app`). Un cliente malicioso puede ignorarlo y subir archivos arbitrariamente grandes, agotando la cuota de R2 y generando costos inesperados.

**Fix:** Agregar validación del `Content-Length` header o del tamaño del buffer antes de llamar a `formData()`, o configurar un límite en el Worker a nivel de Hono middleware.

---

## HIGH

### 4. Sin tests — cero cobertura

No existe ningún archivo `.test.ts`, `.spec.ts`, `vitest.config` ni `jest.config` en todo el monorepo. Las rutas críticas (auth, rate limiting, API tokens, extracción) nunca se testean.

**Prioridad mínima antes de producción:**
- Tests de auth middleware (validación de token, expiración, revocación)
- Tests de rate limit middleware
- Tests de verificación de API tokens
- Tests de contratos de la API (request/response shapes)

---

### 5. Checkout deshabilitado — sin cobros

**Archivo:** `apps/app/src/app/billing/billing.tsx`

Los botones de upgrade están con `disabled` y `title="Checkout coming soon"`. No hay integración con ningún procesador de pagos. Sin billing funcional el producto no puede monetizar.

**Fix:** Integrar Stripe Checkout o similar antes del lanzamiento.

---

### 6. TODOs sin resolver en `wrangler.jsonc`

**Archivo:** `apps/api/wrangler.jsonc`

Al menos 8 comentarios `TODO(manual)` sobre renombrar Workers, bases de datos D1 y buckets R2 de `doc-extraction-*` a `dvop-io-*`. Si se deployea sin resolver estos, el sistema apuntará a recursos del proyecto anterior o inexistentes.

**Fix:** Completar el checklist de renombrado en Cloudflare dashboard y actualizar `wrangler.jsonc` antes del primer deploy a producción.

---

### 7. Sin error tracking ni observabilidad

No hay Sentry, Datadog, Honeycomb ni ningún sistema de error tracking en `apps/api` ni en `apps/app`. Los errores de producción serían completamente silenciosos.

**Fix:** Integrar Sentry (mínimo) en el Worker de Hono y en la app React antes del lanzamiento. Sin esto, no hay forma de saber qué falla en producción.

---

### 8. Health check superficial

**Archivo:** `apps/api/src/router/index.ts`

El endpoint `GET /health` devuelve `'OK'` de forma estática sin verificar conectividad con D1, R2 ni el provider de extracción. Un load balancer no puede detectar fallos parciales.

**Fix:**
```ts
router.get('/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').run()
    // verificar R2 y extraction provider
    return c.json({ status: 'ok', checks: { db: 'ok', r2: 'ok' } })
  } catch (err) {
    return c.json({ status: 'degraded', error: String(err) }, 503)
  }
})
```

---

## MEDIUM

### 9. Sin timeouts en llamadas a la IA

**Archivo:** `apps/api/src/lib/extraction/index.ts`

La llamada a `provider.extract()` no tiene timeout explícito. Si Claude o OpenAI se traban, el Worker cuelga hasta el límite de Cloudflare (30s en paid plans). El usuario queda con un extraction en estado `processing` que nunca resuelve.

**Fix:** Wrappear la llamada con `Promise.race` y un timeout de ~25 segundos. Si vence, marcar la extracción como `error` con mensaje descriptivo.

---

### 10. Validación de schema de templates insuficiente

**Archivo:** `apps/api/src/router/templates.ts`

Los campos del template schema no tienen límite de cantidad ni de longitud. Un schema con 500 campos y descripciones enormes puede romper la extracción o hacer prompt injection al LLM.

**Fix:**
```ts
const fieldSchema = z.object({
  key:         z.string().min(1).max(64).regex(/^[a-z_][a-z0-9_]*$/i),
  label:       z.string().min(1).max(256),
  type:        z.enum(['string', 'number', 'date', 'boolean', 'array']),
  required:    z.boolean().optional().default(false),
  description: z.string().max(512).optional(),
})

const createTemplateSchema = z.object({
  name:        z.string().min(1).max(256),
  description: z.string().max(1024).optional(),
  schema:      z.array(fieldSchema).min(1).max(50),
})
```

---

### 11. Endpoint de download sin rate limit

**Archivo:** `apps/api/src/router/documents.ts`

`GET /documents/:id/download` no está rate-limited, a diferencia de upload y extractions. Un atacante puede mass-download todos los documentos de una cuenta en un loop simple.

**Fix:** Aplicar el mismo rate limit middleware que se usa en upload al endpoint de download.

---

### 12. Delete sin loading state en UI

**Archivo:** `apps/app/src/app/documents/documents.tsx`

La operación de borrado (`handleDelete`) no tiene estado de carga. El UI parece congelado durante el delete, y el usuario puede hacer click múltiples veces.

**Fix:** Agregar `const [deletingId, setDeletingId] = useState<number | null>(null)` y deshabilitar el botón durante la operación.

---

### 13. Sin límite en tamaño del resultado de extracción

**Archivo:** `apps/api/src/lib/extraction/index.ts`

El resultado JSON que devuelve el LLM se almacena sin validación de tamaño. Un LLM que devuelva un objeto muy grande puede exceder los límites de fila de D1.

**Fix:** Validar que `JSON.stringify(result).length < 1_000_000` antes de guardar.

---

## LOW

### 14. Soft delete inconsistente

Templates usan soft delete (`status: 'deleted'`), pero documents y extractions hacen hard delete. No hay audit trail en los datos más críticos del producto.

**Recomendación:** Adoptar soft delete consistente en todas las entidades, o documentar la decisión explícitamente.

---

### 15. Documentación de API incompleta

En `/docs` falta:
- Taxonomía completa de errores (qué esperar en 400, 401, 402, 429, 500)
- Cómo manejar rate limit responses (`Retry-After` header)
- Estrategia de versionado de la API
- Política de deprecación
- Ejemplos de error handling en código

---

### 16. Sin GDPR / política de retención de datos

No hay términos de servicio ni documentación de retención de datos. Los usuarios no saben si sus documentos y extracciones se borran tras N días.

**Recomendación:** Documentar la política de retención antes del lanzamiento público, especialmente si se opera en Europa.

---

### 17. CORS `maxAge` muy conservador

**Archivo:** `apps/api/src/index.ts`

`maxAge: 600` (10 minutos) hace que el browser envíe un preflight OPTIONS en cada sesión nueva, agregando latencia innecesaria.

**Fix:** Cambiar a `maxAge: 86400` (24 horas).

---

### 18. Download de documentos deshabilitado en UI

**Archivo:** `apps/app/src/app/documents/documents.tsx`

El item "Download" en el dropdown está con `disabled`. La API ya tiene el endpoint `GET /documents/:id/download`. Solo falta conectar el frontend.

---

## Resumen ejecutivo

| Severidad | Cantidad | Bloqueante para launch |
|-----------|----------|------------------------|
| CRITICAL  | 3        | Sí                     |
| HIGH      | 5        | Sí (checkout y tests)  |
| MEDIUM    | 5        | Recomendado            |
| LOW       | 4        | No                     |

### Antes de lanzar (obligatorio)
1. Agregar índices en DB (`userId`, `documentId`)
2. Paginación en los endpoints de lista de la API
3. Límite de tamaño en uploads a nivel servidor
4. Integrar Stripe o similar (checkout funcional)
5. Integrar Sentry (error tracking)
6. Completar TODOs en `wrangler.jsonc`
7. Health check con validación real de dependencias
8. Al menos tests de auth, rate limiting y API tokens

### Corto plazo post-lanzamiento
- Timeouts en llamadas al LLM
- Rate limit en endpoint de download
- Loading state en operaciones de borrado
- Límite de tamaño en resultados de extracción
- Documentación de errores y rate limits en `/docs`

### Roadmap
- Soft delete consistente en todas las entidades
- Política GDPR y retención de datos
- Aumentar CORS `maxAge`
- Conectar download de documentos en el frontend
