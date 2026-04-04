import { neon } from "@neondatabase/serverless";

export type Sql = ReturnType<typeof neon>;

export function getSql(): Sql {
    const url = process.env.POSTGRES_URL;
    if (!url) {
        const err: any = new Error("Missing env POSTGRES_URL");
        err.code = "MISSING_POSTGRES_URL";
        throw err;
    }
    return neon(url);
}

export async function ensureSchema(sql: Sql) {
    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS scores (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            client_id TEXT,
            score INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `;

    await sql`ALTER TABLE scores ADD COLUMN IF NOT EXISTS client_id TEXT;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_scores_user_created_at ON scores(user_id, created_at DESC);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_scores_user_client_id ON scores(user_id, client_id) WHERE client_id IS NOT NULL;`;

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (LOWER(username)) WHERE username IS NOT NULL;`;
}

