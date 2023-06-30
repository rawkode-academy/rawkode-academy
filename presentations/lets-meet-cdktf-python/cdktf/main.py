#!/usr/bin/env python
from constructs import Construct
from cdktf import App, TerraformStack
from imports.scaleway.provider import ScalewayProvider
from imports.scaleway.instance_server import InstanceServer
from imports.cloudflare.provider import CloudflareProvider
from imports.cloudflare.record import Record
from imports.cloudflare.data_cloudflare_zone import DataCloudflareZone


class MyStack(TerraformStack):
    def __init__(self, scope: Construct, id: str):
        super().__init__(scope, id)

        ScalewayProvider(self, "scaleway",
                         project_id="b07462e9-1a00-43b4-a6a8-6e3004a31984")
        CloudflareProvider(self, "cloudflare")

        zone = DataCloudflareZone(self, "zone", name="rawkode.cloud")


        nginx = InstanceServer(
            self, "nginx", type="DEV1-S", image="ubuntu-focal", enable_dynamic_ip=True, user_data={"nginx": "apt update && apt install --yes nginx"})

        Record(self, "dns-nginx", name="nginx",
               value=nginx.public_ip, type="A", zone_id=zone.id)


app = App()
MyStack(app, "cdktf")

app.synth()
