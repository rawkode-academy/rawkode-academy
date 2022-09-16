import { ManagedZone } from "../domains";

export const rawkodeNews = new ManagedZone("rawkode-news", {
  domain: "rawkode.news",
  description: "Managed by Pulumi",
}).disableEmail();
