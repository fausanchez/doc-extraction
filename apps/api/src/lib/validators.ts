import { z } from 'zod'

// Reusable validator for `:id` path params. `coerce.number` rejects non-numeric
// strings up front so endpoints never see a `NaN` reaching the database.
export const idParamSchema = z.object({
    id: z.coerce.number().int().positive()
})
