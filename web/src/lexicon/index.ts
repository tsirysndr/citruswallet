/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { XrpcClient, type FetchHandler, type FetchHandlerOptions } from '@atproto/xrpc'
import { schemas } from './lexicons'
import * as AppPeachletAcceptInvitation from './types/app/peachlet/acceptInvitation'
import * as AppPeachletCancelPayment from './types/app/peachlet/cancelPayment'
import * as AppPeachletCreateChallenge from './types/app/peachlet/createChallenge'
import * as AppPeachletCreateInvitation from './types/app/peachlet/createInvitation'
import * as AppPeachletCreatePayment from './types/app/peachlet/createPayment'
import * as AppPeachletDeletePayment from './types/app/peachlet/deletePayment'
import * as AppPeachletEstimateFees from './types/app/peachlet/estimateFees'
import * as AppPeachletExchangeNativeSession from './types/app/peachlet/exchangeNativeSession'
import * as AppPeachletGetAddresses from './types/app/peachlet/getAddresses'
import * as AppPeachletGetAsset from './types/app/peachlet/getAsset'
import * as AppPeachletGetAssets from './types/app/peachlet/getAssets'
import * as AppPeachletGetEthPrice from './types/app/peachlet/getEthPrice'
import * as AppPeachletGetInvitation from './types/app/peachlet/getInvitation'
import * as AppPeachletGetPayment from './types/app/peachlet/getPayment'
import * as AppPeachletGetProfile from './types/app/peachlet/getProfile'
import * as AppPeachletGetSession from './types/app/peachlet/getSession'
import * as AppPeachletGetWebPushConfig from './types/app/peachlet/getWebPushConfig'
import * as AppPeachletListNotifications from './types/app/peachlet/listNotifications'
import * as AppPeachletListPayments from './types/app/peachlet/listPayments'
import * as AppPeachletLogout from './types/app/peachlet/logout'
import * as AppPeachletMarkAllNotificationsRead from './types/app/peachlet/markAllNotificationsRead'
import * as AppPeachletMarkNotificationRead from './types/app/peachlet/markNotificationRead'
import * as AppPeachletPreparePayment from './types/app/peachlet/preparePayment'
import * as AppPeachletRegisterPushToken from './types/app/peachlet/registerPushToken'
import * as AppPeachletRegisterWebPush from './types/app/peachlet/registerWebPush'
import * as AppPeachletResolveRecipient from './types/app/peachlet/resolveRecipient'
import * as AppPeachletSearchActors from './types/app/peachlet/searchActors'
import * as AppPeachletSetDefaultAddress from './types/app/peachlet/setDefaultAddress'
import * as AppPeachletStartLogin from './types/app/peachlet/startLogin'
import * as AppPeachletSubmitPayment from './types/app/peachlet/submitPayment'
import * as AppPeachletSubscribeNotifications from './types/app/peachlet/subscribeNotifications'
import * as AppPeachletSyncAddresses from './types/app/peachlet/syncAddresses'
import * as AppPeachletUnlinkAddress from './types/app/peachlet/unlinkAddress'
import * as AppPeachletUnregisterPushToken from './types/app/peachlet/unregisterPushToken'
import * as AppPeachletUnregisterWebPush from './types/app/peachlet/unregisterWebPush'
import * as AppPeachletVerifyChallenge from './types/app/peachlet/verifyChallenge'

export * as AppPeachletAcceptInvitation from './types/app/peachlet/acceptInvitation'
export * as AppPeachletAddress from './types/app/peachlet/address'
export * as AppPeachletCancelPayment from './types/app/peachlet/cancelPayment'
export * as AppPeachletCreateChallenge from './types/app/peachlet/createChallenge'
export * as AppPeachletCreateInvitation from './types/app/peachlet/createInvitation'
export * as AppPeachletCreatePayment from './types/app/peachlet/createPayment'
export * as AppPeachletDefs from './types/app/peachlet/defs'
export * as AppPeachletDeletePayment from './types/app/peachlet/deletePayment'
export * as AppPeachletEstimateFees from './types/app/peachlet/estimateFees'
export * as AppPeachletExchangeNativeSession from './types/app/peachlet/exchangeNativeSession'
export * as AppPeachletGetAddresses from './types/app/peachlet/getAddresses'
export * as AppPeachletGetAsset from './types/app/peachlet/getAsset'
export * as AppPeachletGetAssets from './types/app/peachlet/getAssets'
export * as AppPeachletGetEthPrice from './types/app/peachlet/getEthPrice'
export * as AppPeachletGetInvitation from './types/app/peachlet/getInvitation'
export * as AppPeachletGetPayment from './types/app/peachlet/getPayment'
export * as AppPeachletGetProfile from './types/app/peachlet/getProfile'
export * as AppPeachletGetSession from './types/app/peachlet/getSession'
export * as AppPeachletGetWebPushConfig from './types/app/peachlet/getWebPushConfig'
export * as AppPeachletListNotifications from './types/app/peachlet/listNotifications'
export * as AppPeachletListPayments from './types/app/peachlet/listPayments'
export * as AppPeachletLogout from './types/app/peachlet/logout'
export * as AppPeachletMarkAllNotificationsRead from './types/app/peachlet/markAllNotificationsRead'
export * as AppPeachletMarkNotificationRead from './types/app/peachlet/markNotificationRead'
export * as AppPeachletPreparePayment from './types/app/peachlet/preparePayment'
export * as AppPeachletRegisterPushToken from './types/app/peachlet/registerPushToken'
export * as AppPeachletRegisterWebPush from './types/app/peachlet/registerWebPush'
export * as AppPeachletResolveRecipient from './types/app/peachlet/resolveRecipient'
export * as AppPeachletSearchActors from './types/app/peachlet/searchActors'
export * as AppPeachletSetDefaultAddress from './types/app/peachlet/setDefaultAddress'
export * as AppPeachletStartLogin from './types/app/peachlet/startLogin'
export * as AppPeachletSubmitPayment from './types/app/peachlet/submitPayment'
export * as AppPeachletSubscribeNotifications from './types/app/peachlet/subscribeNotifications'
export * as AppPeachletSyncAddresses from './types/app/peachlet/syncAddresses'
export * as AppPeachletUnlinkAddress from './types/app/peachlet/unlinkAddress'
export * as AppPeachletUnregisterPushToken from './types/app/peachlet/unregisterPushToken'
export * as AppPeachletUnregisterWebPush from './types/app/peachlet/unregisterWebPush'
export * as AppPeachletVerifyChallenge from './types/app/peachlet/verifyChallenge'

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
  peachlet: AppPeachletNS

  constructor(client: XrpcClient) {
    this._client = client
    this.peachlet = new AppPeachletNS(client)
  }
}

export class AppPeachletNS {
  _client: XrpcClient

  constructor(client: XrpcClient) {
    this._client = client
  }

  acceptInvitation(
    data?: AppPeachletAcceptInvitation.InputSchema,
    opts?: AppPeachletAcceptInvitation.CallOptions,
  ): Promise<AppPeachletAcceptInvitation.Response> {
    return this._client.call(
      'app.peachlet.acceptInvitation',
      opts?.qp,
      data,
      opts,
    )
  }

  cancelPayment(
    data?: AppPeachletCancelPayment.InputSchema,
    opts?: AppPeachletCancelPayment.CallOptions,
  ): Promise<AppPeachletCancelPayment.Response> {
    return this._client.call('app.peachlet.cancelPayment', opts?.qp, data, opts)
  }

  createChallenge(
    data?: AppPeachletCreateChallenge.InputSchema,
    opts?: AppPeachletCreateChallenge.CallOptions,
  ): Promise<AppPeachletCreateChallenge.Response> {
    return this._client.call(
      'app.peachlet.createChallenge',
      opts?.qp,
      data,
      opts,
    )
  }

  createInvitation(
    data?: AppPeachletCreateInvitation.InputSchema,
    opts?: AppPeachletCreateInvitation.CallOptions,
  ): Promise<AppPeachletCreateInvitation.Response> {
    return this._client.call(
      'app.peachlet.createInvitation',
      opts?.qp,
      data,
      opts,
    )
  }

  createPayment(
    data?: AppPeachletCreatePayment.InputSchema,
    opts?: AppPeachletCreatePayment.CallOptions,
  ): Promise<AppPeachletCreatePayment.Response> {
    return this._client.call('app.peachlet.createPayment', opts?.qp, data, opts)
  }

  deletePayment(
    data?: AppPeachletDeletePayment.InputSchema,
    opts?: AppPeachletDeletePayment.CallOptions,
  ): Promise<AppPeachletDeletePayment.Response> {
    return this._client.call('app.peachlet.deletePayment', opts?.qp, data, opts)
  }

  estimateFees(
    data?: AppPeachletEstimateFees.InputSchema,
    opts?: AppPeachletEstimateFees.CallOptions,
  ): Promise<AppPeachletEstimateFees.Response> {
    return this._client.call('app.peachlet.estimateFees', opts?.qp, data, opts)
  }

  exchangeNativeSession(
    data?: AppPeachletExchangeNativeSession.InputSchema,
    opts?: AppPeachletExchangeNativeSession.CallOptions,
  ): Promise<AppPeachletExchangeNativeSession.Response> {
    return this._client.call(
      'app.peachlet.exchangeNativeSession',
      opts?.qp,
      data,
      opts,
    )
  }

  getAddresses(
    params?: AppPeachletGetAddresses.QueryParams,
    opts?: AppPeachletGetAddresses.CallOptions,
  ): Promise<AppPeachletGetAddresses.Response> {
    return this._client.call(
      'app.peachlet.getAddresses',
      params,
      undefined,
      opts,
    )
  }

  getAsset(
    params?: AppPeachletGetAsset.QueryParams,
    opts?: AppPeachletGetAsset.CallOptions,
  ): Promise<AppPeachletGetAsset.Response> {
    return this._client.call('app.peachlet.getAsset', params, undefined, opts)
  }

  getAssets(
    params?: AppPeachletGetAssets.QueryParams,
    opts?: AppPeachletGetAssets.CallOptions,
  ): Promise<AppPeachletGetAssets.Response> {
    return this._client.call('app.peachlet.getAssets', params, undefined, opts)
  }

  getEthPrice(
    params?: AppPeachletGetEthPrice.QueryParams,
    opts?: AppPeachletGetEthPrice.CallOptions,
  ): Promise<AppPeachletGetEthPrice.Response> {
    return this._client.call(
      'app.peachlet.getEthPrice',
      params,
      undefined,
      opts,
    )
  }

  getInvitation(
    params?: AppPeachletGetInvitation.QueryParams,
    opts?: AppPeachletGetInvitation.CallOptions,
  ): Promise<AppPeachletGetInvitation.Response> {
    return this._client.call(
      'app.peachlet.getInvitation',
      params,
      undefined,
      opts,
    )
  }

  getPayment(
    params?: AppPeachletGetPayment.QueryParams,
    opts?: AppPeachletGetPayment.CallOptions,
  ): Promise<AppPeachletGetPayment.Response> {
    return this._client.call('app.peachlet.getPayment', params, undefined, opts)
  }

  getProfile(
    params?: AppPeachletGetProfile.QueryParams,
    opts?: AppPeachletGetProfile.CallOptions,
  ): Promise<AppPeachletGetProfile.Response> {
    return this._client.call('app.peachlet.getProfile', params, undefined, opts)
  }

  getSession(
    params?: AppPeachletGetSession.QueryParams,
    opts?: AppPeachletGetSession.CallOptions,
  ): Promise<AppPeachletGetSession.Response> {
    return this._client.call('app.peachlet.getSession', params, undefined, opts)
  }

  getWebPushConfig(
    params?: AppPeachletGetWebPushConfig.QueryParams,
    opts?: AppPeachletGetWebPushConfig.CallOptions,
  ): Promise<AppPeachletGetWebPushConfig.Response> {
    return this._client.call(
      'app.peachlet.getWebPushConfig',
      params,
      undefined,
      opts,
    )
  }

  listNotifications(
    params?: AppPeachletListNotifications.QueryParams,
    opts?: AppPeachletListNotifications.CallOptions,
  ): Promise<AppPeachletListNotifications.Response> {
    return this._client.call(
      'app.peachlet.listNotifications',
      params,
      undefined,
      opts,
    )
  }

  listPayments(
    params?: AppPeachletListPayments.QueryParams,
    opts?: AppPeachletListPayments.CallOptions,
  ): Promise<AppPeachletListPayments.Response> {
    return this._client.call(
      'app.peachlet.listPayments',
      params,
      undefined,
      opts,
    )
  }

  logout(
    data?: AppPeachletLogout.InputSchema,
    opts?: AppPeachletLogout.CallOptions,
  ): Promise<AppPeachletLogout.Response> {
    return this._client.call('app.peachlet.logout', opts?.qp, data, opts)
  }

  markAllNotificationsRead(
    data?: AppPeachletMarkAllNotificationsRead.InputSchema,
    opts?: AppPeachletMarkAllNotificationsRead.CallOptions,
  ): Promise<AppPeachletMarkAllNotificationsRead.Response> {
    return this._client.call(
      'app.peachlet.markAllNotificationsRead',
      opts?.qp,
      data,
      opts,
    )
  }

  markNotificationRead(
    data?: AppPeachletMarkNotificationRead.InputSchema,
    opts?: AppPeachletMarkNotificationRead.CallOptions,
  ): Promise<AppPeachletMarkNotificationRead.Response> {
    return this._client.call(
      'app.peachlet.markNotificationRead',
      opts?.qp,
      data,
      opts,
    )
  }

  preparePayment(
    data?: AppPeachletPreparePayment.InputSchema,
    opts?: AppPeachletPreparePayment.CallOptions,
  ): Promise<AppPeachletPreparePayment.Response> {
    return this._client.call(
      'app.peachlet.preparePayment',
      opts?.qp,
      data,
      opts,
    )
  }

  registerPushToken(
    data?: AppPeachletRegisterPushToken.InputSchema,
    opts?: AppPeachletRegisterPushToken.CallOptions,
  ): Promise<AppPeachletRegisterPushToken.Response> {
    return this._client.call(
      'app.peachlet.registerPushToken',
      opts?.qp,
      data,
      opts,
    )
  }

  registerWebPush(
    data?: AppPeachletRegisterWebPush.InputSchema,
    opts?: AppPeachletRegisterWebPush.CallOptions,
  ): Promise<AppPeachletRegisterWebPush.Response> {
    return this._client.call(
      'app.peachlet.registerWebPush',
      opts?.qp,
      data,
      opts,
    )
  }

  resolveRecipient(
    data?: AppPeachletResolveRecipient.InputSchema,
    opts?: AppPeachletResolveRecipient.CallOptions,
  ): Promise<AppPeachletResolveRecipient.Response> {
    return this._client.call(
      'app.peachlet.resolveRecipient',
      opts?.qp,
      data,
      opts,
    )
  }

  searchActors(
    params?: AppPeachletSearchActors.QueryParams,
    opts?: AppPeachletSearchActors.CallOptions,
  ): Promise<AppPeachletSearchActors.Response> {
    return this._client.call(
      'app.peachlet.searchActors',
      params,
      undefined,
      opts,
    )
  }

  setDefaultAddress(
    data?: AppPeachletSetDefaultAddress.InputSchema,
    opts?: AppPeachletSetDefaultAddress.CallOptions,
  ): Promise<AppPeachletSetDefaultAddress.Response> {
    return this._client.call(
      'app.peachlet.setDefaultAddress',
      opts?.qp,
      data,
      opts,
    )
  }

  startLogin(
    data?: AppPeachletStartLogin.InputSchema,
    opts?: AppPeachletStartLogin.CallOptions,
  ): Promise<AppPeachletStartLogin.Response> {
    return this._client.call('app.peachlet.startLogin', opts?.qp, data, opts)
  }

  submitPayment(
    data?: AppPeachletSubmitPayment.InputSchema,
    opts?: AppPeachletSubmitPayment.CallOptions,
  ): Promise<AppPeachletSubmitPayment.Response> {
    return this._client.call('app.peachlet.submitPayment', opts?.qp, data, opts)
  }

  subscribeNotifications(
    params?: AppPeachletSubscribeNotifications.QueryParams,
    opts?: AppPeachletSubscribeNotifications.CallOptions,
  ): Promise<AppPeachletSubscribeNotifications.Response> {
    return this._client.call(
      'app.peachlet.subscribeNotifications',
      params,
      undefined,
      opts,
    )
  }

  syncAddresses(
    data?: AppPeachletSyncAddresses.InputSchema,
    opts?: AppPeachletSyncAddresses.CallOptions,
  ): Promise<AppPeachletSyncAddresses.Response> {
    return this._client.call('app.peachlet.syncAddresses', opts?.qp, data, opts)
  }

  unlinkAddress(
    data?: AppPeachletUnlinkAddress.InputSchema,
    opts?: AppPeachletUnlinkAddress.CallOptions,
  ): Promise<AppPeachletUnlinkAddress.Response> {
    return this._client.call('app.peachlet.unlinkAddress', opts?.qp, data, opts)
  }

  unregisterPushToken(
    data?: AppPeachletUnregisterPushToken.InputSchema,
    opts?: AppPeachletUnregisterPushToken.CallOptions,
  ): Promise<AppPeachletUnregisterPushToken.Response> {
    return this._client.call(
      'app.peachlet.unregisterPushToken',
      opts?.qp,
      data,
      opts,
    )
  }

  unregisterWebPush(
    data?: AppPeachletUnregisterWebPush.InputSchema,
    opts?: AppPeachletUnregisterWebPush.CallOptions,
  ): Promise<AppPeachletUnregisterWebPush.Response> {
    return this._client.call(
      'app.peachlet.unregisterWebPush',
      opts?.qp,
      data,
      opts,
    )
  }

  verifyChallenge(
    data?: AppPeachletVerifyChallenge.InputSchema,
    opts?: AppPeachletVerifyChallenge.CallOptions,
  ): Promise<AppPeachletVerifyChallenge.Response> {
    return this._client.call(
      'app.peachlet.verifyChallenge',
      opts?.qp,
      data,
      opts,
    )
  }
}

