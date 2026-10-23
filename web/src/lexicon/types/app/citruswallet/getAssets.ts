/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type HeadersMap } from '@atproto/xrpc'
import * as AppCitruswalletDefs from './defs'

export interface QueryParams {
  address: string
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  assets: AppCitruswalletDefs.AssetBalance[]
  cursor?: string
  discoveryAvailable: boolean
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
