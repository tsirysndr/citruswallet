/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type HeadersMap } from '@atproto/xrpc'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  usd: string
  updatedAt: number
  source: string
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
