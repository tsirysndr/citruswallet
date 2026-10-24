/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type HeadersMap } from '@atproto/xrpc'

export interface QueryParams {}

export interface InputSchema {
  chainId: number
  from: string
  to: string
  value: string
  data: string
  nonce: number
  [k: string]: unknown
}

export interface OutputSchema {
  chainId: number
  from: string
  to: string
  value: string
  data: string
  nonce: number
  gasLimit: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  maxFeeWei: string
  expiresAt: number
  [k: string]: unknown
}

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
