# Projects

## Creating a New Pulumi Project

In-order for new Pulumi projects to have the correct access requirements to store their state in a Google Cloud Storage Bucket, you'll need to go create your project in the [GCP Control Plane](./core-infrastructure//gcp-control-plane/) program first.

This will let you know what KMS key to use and what path within the bucket you have permissions to read and write.

```shell
pulumi stack init <NAME> \
   --secrets-provider="gcpkms://projects/rawkode-academy/locations/europe-west2/keyRings/automation/cryptoKeys/workshops"
pulumi stack select <NAME>
pulumi config set google-native:project rawkode-academy
```
