import { HttpBackend } from "cdktf";
import { Construct } from "constructs";

const baseUrl = "https://terraform-state-backend.rawkode-academy.workers.dev";

export const getBackend = (scope: Construct, name: string): HttpBackend => {
  return new HttpBackend(scope, {
    address: `${baseUrl}/states/${name}`,
    lockMethod: "PUT",
    unlockMethod: "DELETE",
    lockAddress: `${baseUrl}/states/${name}/lock`,
    unlockAddress: `${baseUrl}/states/${name}/lock`,
    username: "rawkodeacademy",
  });
}
