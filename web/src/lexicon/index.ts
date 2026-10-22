/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { XrpcClient, type FetchHandler, type FetchHandlerOptions } from '@atproto/xrpc'
import { schemas } from './lexicons'
import * as AppCitruswalletAcceptInvitation from './types/app/citruswallet/acceptInvitation'
import * as AppCitruswalletCancelPayment from './types/app/citruswallet/cancelPayment'
import * as AppCitruswalletCreateChallenge from './types/app/citruswallet/createChallenge'
import * as AppCitruswalletCreateInvitation from './types/app/citruswallet/createInvitation'
import * as AppCitruswalletCreatePayment from './types/app/citruswallet/createPayment'
import * as AppCitruswalletDeletePayment from './types/app/citruswallet/deletePayment'
import * as AppCitruswalletGetAddresses from './types/app/citruswallet/getAddresses'
import * as AppCitruswalletGetInvitation from './types/app/citruswallet/getInvitation'
import * as AppCitruswalletGetPayment from './types/app/citruswallet/getPayment'
import * as AppCitruswalletGetProfile from './types/app/citruswallet/getProfile'
import * as AppCitruswalletGetSession from './types/app/citruswallet/getSession'
import * as AppCitruswalletListPayments from './types/app/citruswallet/listPayments'
import * as AppCitruswalletLogout from './types/app/citruswallet/logout'
import * as AppCitruswalletPreparePayment from './types/app/citruswallet/preparePayment'
import * as AppCitruswalletResolveRecipient from './types/app/citruswallet/resolveRecipient'
import * as AppCitruswalletSearchActors from './types/app/citruswallet/searchActors'
import * as AppCitruswalletSetDefaultAddress from './types/app/citruswallet/setDefaultAddress'
import * as AppCitruswalletStartLogin from './types/app/citruswallet/startLogin'
import * as AppCitruswalletSubmitPayment from './types/app/citruswallet/submitPayment'
import * as AppCitruswalletSyncAddresses from './types/app/citruswallet/syncAddresses'
import * as AppCitruswalletUnlinkAddress from './types/app/citruswallet/unlinkAddress'
import * as AppCitruswalletVerifyChallenge from './types/app/citruswallet/verifyChallenge'

export * as AppCitruswalletAcceptInvitation from './types/app/citruswallet/acceptInvitation'
export * as AppCitruswalletAddress from './types/app/citruswallet/address'
export * as AppCitruswalletCancelPayment from './types/app/citruswallet/cancelPayment'
export * as AppCitruswalletCreateChallenge from './types/app/citruswallet/createChallenge'
export * as AppCitruswalletCreateInvitation from './types/app/citruswallet/createInvitation'
export * as AppCitruswalletCreatePayment from './types/app/citruswallet/createPayment'
export * as AppCitruswalletDefs from './types/app/citruswallet/defs'
export * as AppCitruswalletDeletePayment from './types/app/citruswallet/deletePayment'
export * as AppCitruswalletGetAddresses from './types/app/citruswallet/getAddresses'
export * as AppCitruswalletGetInvitation from './types/app/citruswallet/getInvitation'
export * as AppCitruswalletGetPayment from './types/app/citruswallet/getPayment'
export * as AppCitruswalletGetProfile from './types/app/citruswallet/getProfile'
export * as AppCitruswalletGetSession from './types/app/citruswallet/getSession'
export * as AppCitruswalletListPayments from './types/app/citruswallet/listPayments'
export * as AppCitruswalletLogout from './types/app/citruswallet/logout'
export * as AppCitruswalletPreparePayment from './types/app/citruswallet/preparePayment'
export * as AppCitruswalletResolveRecipient from './types/app/citruswallet/resolveRecipient'
export * as AppCitruswalletSearchActors from './types/app/citruswallet/searchActors'
export * as AppCitruswalletSetDefaultAddress from './types/app/citruswallet/setDefaultAddress'
export * as AppCitruswalletStartLogin from './types/app/citruswallet/startLogin'
export * as AppCitruswalletSubmitPayment from './types/app/citruswallet/submitPayment'
export * as AppCitruswalletSyncAddresses from './types/app/citruswallet/syncAddresses'
export * as AppCitruswalletUnlinkAddress from './types/app/citruswallet/unlinkAddress'
export * as AppCitruswalletVerifyChallenge from './types/app/citruswallet/verifyChallenge'

export class AtpBaseClient extends XrpcClient {
  app: AppNS

  constructor(options: FetchHandler | FetchHandlerOptions) {
    super(options, schemas)
    this.app = new AppNS(this)
  }

  /** @deprecated use `this` instead */
  get xrpc(): XrpcClient {
    return this
  }
}

export class AppNS {
  _client: XrpcClient
  citruswallet: AppCitruswalletNS

  constructor(client: XrpcClient) {
    this._client = client
    this.citruswallet = new AppCitruswalletNS(client)
  }
}

export class AppCitruswalletNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  acceptInvitation(
    data: AppCitruswalletAcceptInvitation.InputSchema,
    opts?: AppCitruswalletAcceptInvitation.CallOptions,
  ): Promise<AppCitruswalletAcceptInvitation.Response> {
    return this._client.call(
      'app.citruswallet.acceptInvitation',
      opts?.qp,
      data,
      opts,
    )
  }

  cancelPayment(
    data: AppCitruswalletCancelPayment.InputSchema,
    opts?: AppCitruswalletCancelPayment.CallOptions,
  ): Promise<AppCitruswalletCancelPayment.Response> {
    return this._client.call(
      'app.citruswallet.cancelPayment',
      opts?.qp,
      data,
      opts,
    )
  }

  createChallenge(
    data: AppCitruswalletCreateChallenge.InputSchema,
    opts?: AppCitruswalletCreateChallenge.CallOptions,
  ): Promise<AppCitruswalletCreateChallenge.Response> {
    return this._client.call(
      'app.citruswallet.createChallenge',
      opts?.qp,
      data,
      opts,
    )
  }

  createInvitation(
    data: AppCitruswalletCreateInvitation.InputSchema,
    opts?: AppCitruswalletCreateInvitation.CallOptions,
  ): Promise<AppCitruswalletCreateInvitation.Response> {
    return this._client.call(
      'app.citruswallet.createInvitation',
      opts?.qp,
      data,
      opts,
    )
  }

  createPayment(
    data: AppCitruswalletCreatePayment.InputSchema,
    opts?: AppCitruswalletCreatePayment.CallOptions,
  ): Promise<AppCitruswalletCreatePayment.Response> {
    return this._client.call(
      'app.citruswallet.createPayment',
      opts?.qp,
      data,
      opts,
    )
  }

  deletePayment(
    data: AppCitruswalletDeletePayment.InputSchema,
    opts?: AppCitruswalletDeletePayment.CallOptions,
  ): Promise<AppCitruswalletDeletePayment.Response> {
    return this._client.call(
      'app.citruswallet.deletePayment',
      opts?.qp,
      data,
      opts,
    )
  }

  getAddresses(
    params?: AppCitruswalletGetAddresses.QueryParams,
    opts?: AppCitruswalletGetAddresses.CallOptions,
  ): Promise<AppCitruswalletGetAddresses.Response> {
    return this._client.call(
      'app.citruswallet.getAddresses',
      params,
      undefined,
      opts,
    )
  }

  getInvitation(
    params?: AppCitruswalletGetInvitation.QueryParams,
    opts?: AppCitruswalletGetInvitation.CallOptions,
  ): Promise<AppCitruswalletGetInvitation.Response> {
    return this._client.call(
      'app.citruswallet.getInvitation',
      params,
      undefined,
      opts,
    )
  }

  getPayment(
    params?: AppCitruswalletGetPayment.QueryParams,
    opts?: AppCitruswalletGetPayment.CallOptions,
  ): Promise<AppCitruswalletGetPayment.Response> {
    return this._client.call(
      'app.citruswallet.getPayment',
      params,
      undefined,
      opts,
    )
  }

  getProfile(
    params?: AppCitruswalletGetProfile.QueryParams,
    opts?: AppCitruswalletGetProfile.CallOptions,
  ): Promise<AppCitruswalletGetProfile.Response> {
    return this._client.call(
      'app.citruswallet.getProfile',
      params,
      undefined,
      opts,
    )
  }

  getSession(
    params?: AppCitruswalletGetSession.QueryParams,
    opts?: AppCitruswalletGetSession.CallOptions,
  ): Promise<AppCitruswalletGetSession.Response> {
    return this._client.call(
      'app.citruswallet.getSession',
      params,
      undefined,
      opts,
    )
  }

  listPayments(
    params?: AppCitruswalletListPayments.QueryParams,
    opts?: AppCitruswalletListPayments.CallOptions,
  ): Promise<AppCitruswalletListPayments.Response> {
    return this._client.call(
      'app.citruswallet.listPayments',
      params,
      undefined,
      opts,
    )
  }

  logout(
    data: AppCitruswalletLogout.InputSchema,
    opts?: AppCitruswalletLogout.CallOptions,
  ): Promise<AppCitruswalletLogout.Response> {
    return this._client.call('app.citruswallet.logout', opts?.qp, data, opts)
  }

  preparePayment(
    data: AppCitruswalletPreparePayment.InputSchema,
    opts?: AppCitruswalletPreparePayment.CallOptions,
  ): Promise<AppCitruswalletPreparePayment.Response> {
    return this._client.call(
      'app.citruswallet.preparePayment',
      opts?.qp,
      data,
      opts,
    )
  }

  resolveRecipient(
    data: AppCitruswalletResolveRecipient.InputSchema,
    opts?: AppCitruswalletResolveRecipient.CallOptions,
  ): Promise<AppCitruswalletResolveRecipient.Response> {
    return this._client.call(
      'app.citruswallet.resolveRecipient',
      opts?.qp,
      data,
      opts,
    )
  }

  searchActors(
    params?: AppCitruswalletSearchActors.QueryParams,
    opts?: AppCitruswalletSearchActors.CallOptions,
  ): Promise<AppCitruswalletSearchActors.Response> {
    return this._client.call(
      'app.citruswallet.searchActors',
      params,
      undefined,
      opts,
    )
  }

  setDefaultAddress(
    data: AppCitruswalletSetDefaultAddress.InputSchema,
    opts?: AppCitruswalletSetDefaultAddress.CallOptions,
  ): Promise<AppCitruswalletSetDefaultAddress.Response> {
    return this._client.call(
      'app.citruswallet.setDefaultAddress',
      opts?.qp,
      data,
      opts,
    )
  }

  startLogin(
    data: AppCitruswalletStartLogin.InputSchema,
    opts?: AppCitruswalletStartLogin.CallOptions,
  ): Promise<AppCitruswalletStartLogin.Response> {
    return this._client.call(
      'app.citruswallet.startLogin',
      opts?.qp,
      data,
      opts,
    )
  }

  submitPayment(
    data: AppCitruswalletSubmitPayment.InputSchema,
    opts?: AppCitruswalletSubmitPayment.CallOptions,
  ): Promise<AppCitruswalletSubmitPayment.Response> {
    return this._client.call(
      'app.citruswallet.submitPayment',
      opts?.qp,
      data,
      opts,
    )
  }

  syncAddresses(
    data: AppCitruswalletSyncAddresses.InputSchema,
    opts?: AppCitruswalletSyncAddresses.CallOptions,
  ): Promise<AppCitruswalletSyncAddresses.Response> {
    return this._client.call(
      'app.citruswallet.syncAddresses',
      opts?.qp,
      data,
      opts,
    )
  }

  unlinkAddress(
    data: AppCitruswalletUnlinkAddress.InputSchema,
    opts?: AppCitruswalletUnlinkAddress.CallOptions,
  ): Promise<AppCitruswalletUnlinkAddress.Response> {
    return this._client.call(
      'app.citruswallet.unlinkAddress',
      opts?.qp,
      data,
      opts,
    )
  }

  verifyChallenge(
    data: AppCitruswalletVerifyChallenge.InputSchema,
    opts?: AppCitruswalletVerifyChallenge.CallOptions,
  ): Promise<AppCitruswalletVerifyChallenge.Response> {
    return this._client.call(
      'app.citruswallet.verifyChallenge',
      opts?.qp,
      data,
      opts,
    )
  }
}

