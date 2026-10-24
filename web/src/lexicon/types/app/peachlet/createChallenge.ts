/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type HeadersMap } from '@atproto/xrpc'
import * as AppPeachletDefs from './defs'

export interface QueryParams {}

export interface InputSchema {
  address: string
  public?: boolean
  [k: string]: unknown
}

export type OutputSchema = AppPeachletDefs.Challenge

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}
