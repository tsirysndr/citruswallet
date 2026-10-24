/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type HeadersMap } from '@atproto/xrpc'
import { type ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../util'
import { lexicons } from '../../../lexicons'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  notifications: Notification[]
  unread: number
  [k: string]: unknown
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface Notification {
  id: string
  paymentId: string
  createdAt: string
  kind: 'payment_received' | 'recipient_ready' | (string & {})
  read: boolean
  [k: string]: unknown
}

export function isNotification(v: unknown): v is Notification {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.peachlet.listNotifications#notification'
  )
}

export function validateNotification(v: unknown): ValidationResult {
  return lexicons.validate('app.peachlet.listNotifications#notification', v)
}
