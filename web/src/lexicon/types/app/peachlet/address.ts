/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../util'
import { lexicons } from '../../../lexicons'

export interface Record {
  chain: string
  address: string
  message: string
  signature: string
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.peachlet.address#main' ||
      v.$type === 'app.peachlet.address')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.peachlet.address#main', v)
}
