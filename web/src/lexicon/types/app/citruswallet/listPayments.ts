/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type HeadersMap } from '@atproto/xrpc'
import * as AppCitruswalletDefs from './defs'

export interface QueryParams {
  q?: string
  direction?: 'all' | 'sent' | 'received'
  status?:
    | 'all'
    | 'waiting'
    | 'ready'
    | 'prepared'
    | 'submitted'
    | 'confirming'
    | 'confirmed'
    | 'failed'
    | 'cancelled'
    | 'expired'
  /** Inclusive Unix timestamp in milliseconds, encoded as a decimal string. */
  after?: string
  /** Inclusive Unix timestamp in milliseconds, encoded as a decimal string. */
  before?: string
  page?: number
  pageSize?: number
  sort?: 'newest' | 'oldest'
}

export type InputSchema = undefined

export interface OutputSchema {
  total: number
  page: number
  pageSize: number
  payments: AppCitruswalletDefs.Payment[]
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
