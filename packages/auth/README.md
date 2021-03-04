# `@azure-actions/auth`

> An NPM module to use with azure related actions to help communicate with Azure API

## Usage 

## Import the package 

```js
// javascript
const core = require('@azure-actions/auth');

// typescript
import * as core from '@azure-actions/auth';
```

## getAzureAccessToken(creds?: string)

There are two scenarios in which you could use this.

1. Get Access token within `az login` context.

```js
let token = getAzureAccessToken();
```

2. Passing the SPN creds inline as a string in JSON.

```js
let credentials = core.getInput('azure-credentials'); // SPN creds input
let token = getAzureAccessToken(credentials);
```

### How to fetch SPN

To fetch the credentials required to authenticate with Azure, run the following command:

```sh
az ad sp create-for-rbac --sdk-auth
```

For more details on this command, refer to [service principal documentation](https://docs.microsoft.com/cli/azure/ad/sp?view=azure-cli-latest#az-ad-sp-create-for-rbac)

This generates a service principal and the output of the above command will be in the following format:

```json
{
  "clientId": "<client id>",
  "clientSecret": "<client secret>",
  "subscriptionId": "<subscription id>",
  "tenantId": "<tenant id>",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```