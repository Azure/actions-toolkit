
import * as core from '@actions/core';
import * as querystring from 'querystring';

import { WebRequest, WebRequestOptions, WebResponse, sendRequest } from "@azure-actions/utilities/lib/http";
import { IExecSyncResult, IExecSyncOptions } from "@azure-actions/utilities/lib/toolrunner";
import { execSync } from '@azure-actions/utilities';

export async function getAzureAccessToken(creds?: string): Promise<string> {
    if (!!creds) {
        return getTokenUsingCredObject(creds);
    }
    else {
        try {
            let token = getTokenUsingAzCLI();
            return Promise.resolve(token);
        } catch (ex) {
            return Promise.reject(ex);
        }
    }
}

async function getTokenUsingCredObject(creds: string) {
    let credsObject: { [key: string]: string; };
    try {
        credsObject = JSON.parse(creds);
    } catch (ex) {
        throw new Error('Credentials object is not a valid JSON');
    }

    let servicePrincipalId: string = credsObject["clientId"];
    let servicePrincipalKey: string = credsObject["clientSecret"];
    let tenantId: string = credsObject["tenantId"];
    let authorityUrl: string = credsObject["activeDirectoryEndpointUrl"] || "https://login.microsoftonline.com";
    let managementEndpointUrl: string = credsObject["resourceManagerEndpointUrl"] || "https://management.azure.com/";
    if (!servicePrincipalId || !servicePrincipalKey || !tenantId || !authorityUrl) {
        throw new Error("Not all values are present in the creds object. Ensure clientId, clientSecret, tenantId and activeDirectoryEndpointUrl are supplied in the provided object");
    }
    return new Promise<string>((resolve, reject) => {
        let webRequest = new WebRequest();
        webRequest.method = "POST";
        webRequest.uri = `${authorityUrl}/${tenantId}/oauth2/token/`;
        webRequest.body = querystring.stringify({
            resource: managementEndpointUrl,
            client_id: servicePrincipalId,
            grant_type: "client_credentials",
            client_secret: servicePrincipalKey
        });
        webRequest.headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
        };

        let webRequestOptions: WebRequestOptions = {
            retriableStatusCodes: [400, 408, 409, 500, 502, 503, 504],
        };

        sendRequest(webRequest, webRequestOptions).then(
            (response: WebResponse) => {
                if (response.statusCode == 200) {
                    resolve(response.body.access_token);
                }
                else if ([400, 401, 403].indexOf(response.statusCode) != -1) {
                    reject('ExpiredServicePrincipal');
                }
                else {
                    reject('CouldNotFetchAccessTokenforAzureStatusCode');
                }
            },
            (error: Error) => {
                reject(error);
            }
        );
    });
}

function getTokenUsingAzCLI() {
    let resultOfExec: IExecSyncResult = execSync("az", "account get-access-token --query \"accessToken\"", { silent: true } as IExecSyncOptions);
    if (resultOfExec.code != 0) {
        core.error(`Login with azure/login action to fetch token. Error Code: ${resultOfExec.code}`)
        throw resultOfExec;
    }
    let token = resultOfExec.stdout.trim();
    return token.substring(1, token.length - 1); // The result of the above is enclosed in quotes, ex: '"accessToken"'. Trimming the enclosed quotes to extract the token. Alternative could be JSON.parse
}