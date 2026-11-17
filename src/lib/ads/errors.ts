/** Errors surfaced by the Google Ads integration. */

export class AdsApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null,
    readonly grpcStatus: string | null,
    readonly errorCodes: string[] = [],
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "AdsApiError";
  }
}

/** The user must reconnect Google (revoked/expired grant or lost access). */
export class ReconnectRequiredError extends Error {
  constructor(message = "Reconnect your account") {
    super(message);
    this.name = "ReconnectRequiredError";
  }
}

/** We are at (or near) the daily operation cap for our access level. */
export class QuotaExceededError extends Error {
  constructor(message = "Google Ads API daily quota reached") {
    super(message);
    this.name = "QuotaExceededError";
  }
}
