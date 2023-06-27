import pytest
from cdktf import Testing, TerraformStack

from imports.scaleway.provider import ScalewayProvider
from imports.cloudflare.provider import CloudflareProvider
from imports.scaleway.instance_server import InstanceServer
from imports.cloudflare.record import Record
from main import MyStack


class TestMain:
    app = Testing.app()
    stack = MyStack(app, "app-abstraction")
    synthesized = Testing.synth(stack)

    def test_has_providers(self):
        assert Testing.to_have_provider(self.synthesized, CloudflareProvider.TF_RESOURCE_TYPE)
        assert Testing.to_have_provider(self.synthesized, ScalewayProvider.TF_RESOURCE_TYPE)

    def test_should_use_an_ubuntu_image(self):
        assert Testing.to_have_resource_with_properties(self.synthesized, InstanceServer.TF_RESOURCE_TYPE, {
            "image": "ubuntu-focal",
        })

    def test_should_set_a_record(self):
        assert Testing.to_have_resource_with_properties(self.synthesized, Record.TF_RESOURCE_TYPE, {
            "type": "A",
        })

    def test_check_validity(self):
        assert Testing.to_be_valid_terraform(Testing.full_synth(self.stack))
