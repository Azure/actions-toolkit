import { StatusCodes, WebRequest, WebRequestOptions, WebResponse, sendRequest } from "./http";
import { sleepFor } from './sleep';


// interfaces
exports.StatusCodes = StatusCodes;
exports.WebRequest = WebRequest;
exports.WebRequestOptions = WebRequestOptions;
exports.WebResponse = WebResponse;

// functions
exports.sendRequest = sendRequest;
exports.sleepFor = sleepFor;