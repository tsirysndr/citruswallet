/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type HeadersMap } from '@atproto/xrpc'
import * as AppCitruswalletDefs from './defs'

export interface QueryParams {
  q: string
}

export type InputSchema = undefined

export interface OutputSchema {
  actors: AppCitruswalletDefs.Actor[]
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
