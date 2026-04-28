import { zValidator as zv } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'
import type { ValidationTargets } from 'hono/types'
import * as z from 'zod'
import { sign, verify } from 'hono/jwt'

export const zValidator = <T extends z.ZodSchema, Target extends keyof ValidationTargets>(
    target: Target,
    schema: T
) =>
    zv(target, schema, (result, c) => {
        if (!result.success) {
            throw new HTTPException(400, { cause: result.error })
        }
    })

type JwtPayload = {
    sub: number
    role: string
    exp: number
}

export const generateToken = async (userId: number, role: string, secret: string) => {
    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
    const payload: JwtPayload = { sub: userId, role, exp }
    return await sign(payload, secret, 'HS256')
}

export const verifyToken = async (token: string, secret: string) => {
    return (await verify(token, secret, 'HS256')) as JwtPayload
}
