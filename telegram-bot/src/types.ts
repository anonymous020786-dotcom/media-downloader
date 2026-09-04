import type { Context } from 'telegraf'

/**
 * The bot keeps no per-request session on the context itself — user state lives
 * in `session.ts` keyed by Telegram user id. This alias exists so handlers share
 * one context type and we can widen it later without touching every file.
 */
export type BotContext = Context
