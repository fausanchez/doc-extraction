import { z } from 'zod'

// Reusable validator for `:id` path params. `coerce.number` rejects non-numeric
// strings up front so endpoints never see a `NaN` reaching the database.
export const idParamSchema = z.object({
    id: z.coerce.number().int().positive()
})

// Reusable query-param schema for paginated list endpoints.
export const pageQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25)
})
