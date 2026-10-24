/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type HeadersMap } from '@atproto/xrpc'
import * as AppPeachletDefs from './defs'

export interface QueryParams {
  token: string
}

export type InputSchema = undefined
export type OutputSchema = AppPeachletDefs.PaymentResult

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
