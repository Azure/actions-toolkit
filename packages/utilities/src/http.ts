import * as core from "@actions/core";
import util = require("util");
import httpClient = require("typed-rest-client/HttpClient");

const httpCallbackClient = new httpClient.HttpClient(
  "AZURE_ACTIONS_GITHUB_RUNNER",
  [],
  {}
);

export enum StatusCodes {
  OK = 200,
  CREATED = 201,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

export class WebRequest {
  method: string;
  uri: string;
  // body can be string or ReadableStream
  body: string;
  headers: any;

  constructor() {
    this.method = "";
    this.uri = "";
    this.body = "";
  }
}

export class WebResponse {
  statusCode: number;
  statusMessage: string;
  headers: any;
  body: any;
  constructor() {
    this.statusCode = -1;
    this.statusMessage = "Not set";
  }
}

export class WebRequestOptions {
  retriableErrorCodes?: string[];
  retryCount?: number;
  retryIntervalInSeconds?: number;
  retriableStatusCodes?: number[];
  retryRequestTimedout?: boolean;
}

export async function sendRequest(
  request: WebRequest,
  options?: WebRequestOptions
): Promise<WebResponse> {
  let i = 0;
  const retryCount = options && options.retryCount ? options.retryCount : 5;
  const retryIntervalInSeconds =
    options && options.retryIntervalInSeconds
      ? options.retryIntervalInSeconds
      : 2;
  const retriableErrorCodes =
    options && options.retriableErrorCodes
      ? options.retriableErrorCodes
      : [
          "ETIMEDOUT",
          "ECONNRESET",
          "ENOTFOUND",
          "ESOCKETTIMEDOUT",
          "ECONNREFUSED",
          "EHOSTUNREACH",
          "EPIPE",
          "EA_AGAIN"
        ];
  const retriableStatusCodes =
    options && options.retriableStatusCodes
      ? options.retriableStatusCodes
      : [408, 409, 500, 502, 503, 504];
  let timeToWait: number = retryIntervalInSeconds;
  while (true) {
    try {
      const response: WebResponse = await sendRequestInternal(request);
      if (
        retriableStatusCodes.includes(response.statusCode) &&
        ++i < retryCount
      ) {
        core.debug(
          util.format(
            "Encountered a retriable status code: %s. Message: '%s'.",
            response.statusCode,
            response.statusMessage
          )
        );
        await sleepFor(timeToWait);
        timeToWait =
          timeToWait * retryIntervalInSeconds + retryIntervalInSeconds;
        continue;
      }

      return response;
    } catch (error) {
      if (retriableErrorCodes.includes(error.code) && ++i < retryCount) {
        core.debug(
          util.format(
            "Encountered a retriable error:%s. Message: %s.",
            error.code,
            error.message
          )
        );
        await sleepFor(timeToWait);
        timeToWait =
          timeToWait * retryIntervalInSeconds + retryIntervalInSeconds;
      } else {
        if (error.code) {
          core.debug(`error code =${error.code}`);
        }

        throw error;
      }
    }
  }
}

async function sendRequestInternal(request: WebRequest): Promise<WebResponse> {
  core.debug(util.format("[%s]%s", request.method, request.uri));
  const response: httpClient.HttpClientResponse = await httpCallbackClient.request(
    request.method,
    request.uri,
    request.body,
    request.headers
  );
  return await toWebResponse(response);
}

async function toWebResponse(
  response: httpClient.HttpClientResponse
): Promise<WebResponse> {
  const res = new WebResponse();
  if (response) {
    res.statusCode = response.message.statusCode || 0;
    res.statusMessage = response.message.statusMessage || "";
    res.headers = response.message.headers;
    const body = await response.readBody();
    if (body) {
      try {
        res.body = JSON.parse(body);
      } catch (error) {
        core.debug(`Could not parse response: ${JSON.stringify(error)}`);
        core.debug(`Response: ${JSON.stringify(res.body)}`);
        res.body = body;
      }
    }
  }

  return res;
}

export async function sleepFor(sleepDurationInSeconds: number): Promise<any> {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, sleepDurationInSeconds * 1000);
  });
}
