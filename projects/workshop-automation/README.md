# The Complete Guide to Kubernetes - Workshop Automation

Most commands below should be run via `doppler run` for secret injection.

## Create a New Workshop

## GitHub OAuth Application

You need a GitHub OAuth application.

`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` will need to be available.

## Create Teleport Server

```bash
export name=workshop-name

pulumi stack init ${name} \
   --secrets-provider="gcpkms://projects/rawkode-academy/locations/europe-west2/keyRings/automation/cryptoKeys/workshops"
pulumi stack select ${name}
pulumi config set google-native:project rawkode-academy
```
