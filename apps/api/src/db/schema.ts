import { sql } from 'drizzle-orm'
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'

// Catalogue of access tiers. Each product encodes the limits a user gets;
// for now the only enforced limit is `monthlyExtractionCredits` (NULL means
// unlimited). One row is flagged `isDefault = 1` and assigned to every new
// signup.
export const products = sqliteTable('products', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // Stable handle for code lookups (e.g. 'free', 'pro', 'enterprise').
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    // NULL = unlimited extractions per rolling 30-day window.
    monthlyExtractionCredits: integer('monthly_extraction_credits'),
    // Lower values render first in pricing UIs.
    sortOrder: integer('sort_order').notNull().default(0),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    status: text('status').notNull().default('active'), // active | archived
    createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at')
        .notNull()
        .default(sql`(unixepoch() * 1000)`)
        .$onUpdate(() => sql`(unixepoch() * 1000)`)
})

// A way to pay for a product. `interval = 'free'` represents the no-cost
// path; paid intervals (`month`, `year`, `one_time`) carry an `amount` in
// minor currency units (cents). `providerPriceId` slots a Stripe / vendor
// reference for when checkout is wired up.
export const prices = sqliteTable(
    'prices',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        productId: integer('product_id')
            .references(() => products.id)
            .notNull(),
        amount: integer('amount').notNull().default(0), // minor units
        currency: text('currency').notNull().default('USD'),
        interval: text('interval').notNull(), // month | year | one_time | free
        intervalCount: integer('interval_count').notNull().default(1),
        providerPriceId: text('provider_price_id').notNull().default(''),
        status: text('status').notNull().default('active'),
        createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
        updatedAt: integer('updated_at')
            .notNull()
            .default(sql`(unixepoch() * 1000)`)
            .$onUpdate(() => sql`(unixepoch() * 1000)`)
    },
    (t) => [index('prices_product_id_idx').on(t.productId)]
)

export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    name: text('name').notNull().default(''),
    avatar: text('avatar').notNull().default(''),
    provider: text('provider').notNull().default('google'), // google | github
    providerId: text('provider_id').notNull().default(''),
    role: text('role').notNull().default('user'),
    // Active product. Nullable in the schema because SQLite's ALTER ADD
    // COLUMN can't introduce a NOT NULL FK without a default; the migration
    // backfills every existing row to the Free product and `upsertGoogle/
    // GitHubUser` always sets it on insert. Reads should still tolerate
    // NULL by falling back to the default product.
    productId: integer('product_id').references(() => products.id),
    createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(CURRENT_TIMESTAMP)`)
        .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
})

// Session = a refresh-token grant. The opaque refresh token is hashed before
// storage so a DB leak doesn't yield usable credentials. `revokedAt` enables
// server-side logout / rotation: a non-null value invalidates the row.
export const sessions = sqliteTable(
    'sessions',
    {
        id: text('id').primaryKey(),
        userId: integer('user_id')
            .references(() => users.id)
            .notNull(),
        // SHA-256 hex of the refresh token issued to the client.
        tokenHash: text('token_hash').notNull().default(''),
        expiresAt: integer('expires_at').notNull(),
        revokedAt: integer('revoked_at'),
        createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`)
    },
    (t) => [index('sessions_token_hash_idx').on(t.tokenHash)]
)

// Templates define the JSON structure for data extraction
export const templates = sqliteTable('templates', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
        .references(() => users.id)
        .notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    // JSON schema defining the fields to extract
    // e.g. [{ key: "invoice_number", label: "Invoice Number", type: "string" }]
    schema: text('schema').notNull().default('[]'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(CURRENT_TIMESTAMP)`)
        .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
})

export const documents = sqliteTable('documents', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
        .references(() => users.id)
        .notNull(),
    name: text('name').notNull(),
    filePath: text('file_path').notNull(),
    mimeType: text('mime_type').notNull().default(''),
    size: integer('size').notNull().default(0),
    status: text('status').notNull().default('uploaded'), // uploaded | processing | done | error
    createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(CURRENT_TIMESTAMP)`)
        .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
})

export const extractions = sqliteTable('extractions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    documentId: integer('document_id')
        .references(() => documents.id)
        .notNull(),
    templateId: integer('template_id')
        .references(() => templates.id)
        .notNull(),
    userId: integer('user_id')
        .references(() => users.id)
        .notNull(),
    // JSON result matching the template schema
    result: text('result').notNull().default('{}'),
    status: text('status').notNull().default('pending'), // pending | processing | done | error
    errorMessage: text('error_message').notNull().default(''),
    createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(CURRENT_TIMESTAMP)`)
        .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`)
})
