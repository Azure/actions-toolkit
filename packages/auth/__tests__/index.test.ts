import { getAzureAccessToken } from "../src";
import { mocked } from "ts-jest";
import * as http from "@azure-actions/utilities/lib/http";

mocked(http, true);

test("getAzureAccessToken fails when no values are supplied", () => {
  const sampleCred = JSON.stringify({});
  expect(getAzureAccessToken(sampleCred)).resolves.toThrowError();
});

test("getAzureAccessToken fails when clientSecret is not added", () => {
  const sampleCred = JSON.stringify({
    clientId: "clientId"
  });
  expect(getAzureAccessToken(sampleCred)).resolves.toThrowError();
});

test("getAzureAccessToken fails when tenantId is not added", () => {
  const sampleCred = JSON.stringify({
    clientId: "clientId",
    clientSecret: "clientSecret"
  });
  expect(getAzureAccessToken(sampleCred)).resolves.toThrowError();
});
