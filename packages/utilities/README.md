# @azure-actions/utilities

This module contains a few helper functions which you can use in your actions to avoid rewriting some logic, like httpclient.

## HTTP module

```ts
import {
  WebRequest,
  WebRequestOptions,
  WebResponse,
  sendRequest
} from "@azure-actions/utilities/lib/http";

const webRequest = new WebRequest();
webRequest.method = "POST";
webRequest.uri = `https://my-rest-endpoint`;
webRequest.body = "body";
webRequest.headers = {
    "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
};

const webRequestOptions: WebRequestOptions = {
    retriableStatusCodes: [400, 408, 409, 500, 502, 503, 504]
};

sendRequest(webRequest, webRequestOptions).then(
    (response: WebResponse) => {
        if (response.statusCode == 200) {
        // Do something
        } else {
        // Handle other statusCodes
        }
    },
    (error: Error) => {
     // Handle error
    }
);
```

## util functions

```ts
import * as utils from '@azure-actions/utilities';
```

### utils.cp

Copies a file or folder.
```javascript
cp(source:string, dest:string, options?:string, continueOnError?:boolean):void
```
 
Param | Type | Description
--- | --- | ---
source | string | source path
dest | string | destination path
options | string | string \-r, \-f or \-rf for recursive and force 
continueOnError | boolean | optional. whether to continue on error
 
### utils.checkShell

Tests if error occurred in the last command and pipes it to runner logs.
```javascript
checkShell(cmd: string, continueOnError?: boolean):void
```
 
Param | Type | Description
--- | --- | ---
cmd | string | source path
continueOnError | boolean | optional. whether to continue on error


### utils.mkdirP

Make a directory.  Creates the full path with folders in between; Will throw if it fails

```javascript
mkdirP(p: string): void 
```
 
Param | Type | Description
--- | --- | ---
p | string | path to create

### utils.find
Recursively finds all paths a given path. Returns an array of paths.

```javascript
find(findPath: string): string[] {
```
 
Param | Type | Description
--- | --- | ---
find | string | path to search


### utils.MatchOptions
 
Property | Type | Description
--- | --- | ---
debug | boolean | 
nobrace | boolean | 
noglobstar | boolean | 
dot | boolean | 
noext | boolean | 
nocase | boolean | 
nonull | boolean | 
matchBase | boolean | 
nocomment | boolean | 
nonegate | boolean | 
flipNegate | boolean | 

### utils.match
Applies glob patterns to a list of paths. Supports interleaved exclude patterns.

```javascript
 match(list: string[], patterns: string[] | string, patternRoot?: string, options?: MatchOptions): string[]
```

Param | Type | Description
--- | --- | ---
list | string\[\] | array of paths
patterns | string\[\] \| string | patterns to apply. supports interleaved exclude patterns.
patternRoot | string | optional. default root to apply to unrooted patterns. not applied to basename\-only patterns when matchBase:true.
options | MatchOptions | optional. defaults to \{ dot: true, nobrace: true, nocase: process.platform == 'win32' \}.

### utils.execSync
Exec a tool synchronously.  Convenience wrapper over ToolRunner to execSync with args in one call.
Output will be *not* be streamed to the live console.  It will be returned after execution is complete.
Appropriate for short running tools
Returns IExecResult with output and return code
```javascript
execSync(tool:string, args:string | string[], options?:IExecSyncOptions):IExecSyncResult
```
 
Param | Type | Description
--- | --- | ---
tool | string | path to tool to exec
args | string \| string\[\] | an arg string or array of args
options | IExecSyncOptions | optional exec options.  See IExecSyncOptions

### toolrunner.IExecSyncResult 
```js
import * as toolrunner from '@azure-actions/utilities/lib/toolrunner';
```

Interface for exec results returned from synchronous exec functions
 
Property | Type | Description
--- | --- | ---
stdout | string | standard output 
stderr | string | error output 
code | number | return code 
error | Error | Error on failure 