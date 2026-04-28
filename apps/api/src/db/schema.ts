import { sql } from 'drizzle-orm'
import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    name: text('name').notNull().default(''),
    avatar: text('avatar').notNull().default(''),
    provider: text('provider').notNull().default('google'), // google | github
    providerId: text('provider_id').notNull().default(''),
    role: text('role').notNull().default('user'),
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
