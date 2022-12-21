import { ManagedZone } from "../domains";

export const rawkodeChat = new ManagedZone("rawkode-chat", {
  domain: "rawkode.chat",
  description: "Managed by Pulumi",
})
  .disableEmail()
  .setupShortiO("@");
