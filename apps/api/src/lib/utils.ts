import { zValidator as zv } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import type { ValidationTargets } from 'hono/types'
import * as z from 'zod'
import { sign, verify } from 'hono/jwt'

export const zValidator = <T extends z.ZodSchema, Target extends keyof ValidationTargets>(
    target: Target,
    schema: T
) =>
    zv(target, schema, (result, _c) => {
        if (!result.success) {
            throw new HTTPException(400, { cause: result.error })
        }
    })

// Short-lived bearer token. Embeds the session id (`sid`) so tokens issued by
// a revoked refresh-token chain can be tracked back to a row in `sessions`.
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 // 1 hour

export type AccessTokenPayload = {
    sub: number
    sid: string
    role: string
    exp: number
}

export const generateAccessToken = async (
    userId: number,
    sessionId: string,
    role: string,
    secret: string
): Promise<string> => {
    const exp = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId, role, exp }
    return sign(payload, secret, 'HS256')
}

export const verifyAccessToken = async (
    token: string,
    secret: string
): Promise<AccessTokenPayload> => {
    return (await verify(token, secret, 'HS256')) as AccessTokenPayload
}
