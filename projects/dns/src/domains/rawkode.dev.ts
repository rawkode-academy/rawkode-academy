import { ManagedZone } from "../domains";

export const rawkodeDev = new ManagedZone("rawkode-dev", {
  domain: "rawkode.dev",
  description: "Managed by Pulumi",
})
  .enableGSuite()
  .addRecord({
    name: "google._domainkey",
    type: "TXT",
    ttl: 300,
    values: [
      "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm/VKFbV7zRGQzL4w2WYRk8uPty4it7BicPhEBamVWPjOh6s9IojKT1GCbiJUkM8nFKNw3tF85OV0+LJkht30/PbtdtA2Lzp/sCVGhueViRNG6pEQYC8OKfxhj/A9Xgot5kbo1ihCiRtDYv2w95BeEbK7OxBgGhdICTcwjlNbI5djE4BR9ZxUMhl7RSOd9UlHzmPxh9NrkAWkNvooaRgro2PNZgZkUQuQaAGa5sbmohNq7KqRhyUYd3vMc275dnWT5/nEkU4jQe99yFrbTKkjmwJosnwcw9x94RRgSWOCsCbd8pSUMS5T8rj0Pv1ct2rnFbNTa5DMDtz1vAuLhSqxjwIDAQAB",
    ],
  });
