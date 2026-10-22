/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../util'
import { lexicons } from '../../../lexicons'

export interface Actor {
  did: string
  handle: string
  displayName: string | null
  avatar: string | null
  [k: string]: unknown
}

export function isActor(v: unknown): v is Actor {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.citruswallet.defs#actor'
  )
}

export function validateActor(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#actor', v)
}

export interface Currency {
  name: string
  symbol: string
  decimals: number
  [k: string]: unknown
}

export function isCurrency(v: unknown): v is Currency {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#currency'
  )
}

export function validateCurrency(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#currency', v)
}

export interface Network {
  chainId: number
  chainIdHex: string
  name: string
  nativeCurrency: Currency
  rpcUrls?: string[]
  [k: string]: unknown
}

export function isNetwork(v: unknown): v is Network {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#network'
  )
}

export function validateNetwork(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#network', v)
}

export interface Link {
  did: string
  address: string
  chain_id: number
  message: string
  signature: string
  linked_at: string
  public: boolean
  is_default: boolean
  [k: string]: unknown
}

export function isLink(v: unknown): v is Link {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.citruswallet.defs#link'
  )
}

export function validateLink(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#link', v)
}

export interface Session {
  network: Network
  paymentsEnabled: boolean
  did: string | null
  csrf: string
  links: Link[]
  addressSyncPending: boolean
  [k: string]: unknown
}

export function isSession(v: unknown): v is Session {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#session'
  )
}

export function validateSession(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#session', v)
}

export type PaymentState =
  | 'waiting'
  | 'ready'
  | 'prepared'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | (string & {})

export interface Payment {
  id: string
  senderDid: string
  recipientDid: string
  recipientLabel: string
  chainId: number
  asset: string
  amount: string
  amountWei: string
  state: PaymentState
  address: string | null
  revision: number
  source: string
  createdAt: string
  expiresAt: string
  txHash: string | null
  error: string | null
  confirmationsRequired: number
  attemptId?: string | null
  fromAddress?: string | null
  nonce?: number | null
  [k: string]: unknown
}

export function isPayment(v: unknown): v is Payment {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#payment'
  )
}

export function validatePayment(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#payment', v)
}

export interface Transaction {
  from: string
  to: string
  value: string
  chainId: string
  nonce: string
  data: string
  [k: string]: unknown
}

export function isTransaction(v: unknown): v is Transaction {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#transaction'
  )
}

export function validateTransaction(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#transaction', v)
}

export interface Attempt {
  payment: Payment
  attemptId: string
  transaction: Transaction
  [k: string]: unknown
}

export function isAttempt(v: unknown): v is Attempt {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#attempt'
  )
}

export function validateAttempt(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#attempt', v)
}

export interface Recipient {
  did: string
  handle: string | null
  chainId: number
  address: string | null
  [k: string]: unknown
}

export function isRecipient(v: unknown): v is Recipient {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#recipient'
  )
}

export function validateRecipient(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#recipient', v)
}

export interface Challenge {
  id: string
  address: string
  chainId: number
  message: string
  expiresAt: string
  [k: string]: unknown
}

export function isChallenge(v: unknown): v is Challenge {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#challenge'
  )
}

export function validateChallenge(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#challenge', v)
}

export interface LinksResult {
  links: Link[]
  addressSyncPending?: boolean
  [k: string]: unknown
}

export function isLinksResult(v: unknown): v is LinksResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#linksResult'
  )
}

export function validateLinksResult(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#linksResult', v)
}

export interface PaymentResult {
  payment: Payment
  [k: string]: unknown
}

export function isPaymentResult(v: unknown): v is PaymentResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#paymentResult'
  )
}

export function validatePaymentResult(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#paymentResult', v)
}

export interface InvitationResult {
  invitationUrl: string
  [k: string]: unknown
}

export function isInvitationResult(v: unknown): v is InvitationResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.citruswallet.defs#invitationResult'
  )
}

export function validateInvitationResult(v: unknown): ValidationResult {
  return lexicons.validate('app.citruswallet.defs#invitationResult', v)
}
