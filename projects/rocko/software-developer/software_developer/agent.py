import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap

from google.adk import Agent
from google.adk.tools.tool_context import ToolContext
from kagent.adk.models import OpenAI

WORKSPACE_DIR = os.environ.get("WORKSPACE_DIR", "/workspace")
ZOT_REGISTRY = os.environ.get("ZOT_REGISTRY", "zot.zot.svc.cluster.local:5000")
DEPLOY_NAMESPACE = os.environ.get("DEPLOY_NAMESPACE", "apps")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")


def _run(cmd: list[str], cwd: str | None = None) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=300)
    if result.returncode != 0:
        return f"Command failed (exit {result.returncode}):\n{result.stderr}"
    return result.stdout


def _prepare_docker_archive(image_path: str) -> tuple[str, Path | None]:
    source_path = Path(image_path)
    if source_path.suffix != ".gz":
        return str(source_path), None

    with tempfile.NamedTemporaryFile(suffix=".tar", delete=False) as temporary_archive:
        temporary_path = Path(temporary_archive.name)

    with gzip.open(source_path, "rb") as source_file, temporary_path.open("wb") as archive_file:
        shutil.copyfileobj(source_file, archive_file)

    return str(temporary_path), temporary_path


def generate_app(app_name: str, description: str, tool_context: ToolContext) -> str:
    """Generate a TypeScript web application from a description.

    Creates a Deno-based TypeScript web app in the workspace directory,
    including a main.ts entry point and a Nix flake for building an OCI image.

    Args:
        app_name: Name of the application (used as directory and image name).
        description: Natural language description of what the app should do.

    Returns:
        A summary of the generated files and their locations.
    """
    app_dir = os.path.join(WORKSPACE_DIR, app_name)
    src_dir = os.path.join(app_dir, "src")
    os.makedirs(src_dir, exist_ok=True)

    # Copy the template flake.nix
    template_flake = "/opt/templates/flake.nix"
    if os.path.exists(template_flake):
        with open(template_flake) as f:
            flake_content = f.read()
        with open(os.path.join(app_dir, "flake.nix"), "w") as f:
            f.write(flake_content)

    tool_context.state["current_app"] = app_name
    tool_context.state["app_dir"] = app_dir

    return f"App directory created at {app_dir} with flake.nix template. Write the TypeScript source files to {src_dir}/main.ts using the write_file tool."


def write_file(file_path: str, content: str, tool_context: ToolContext) -> str:
    """Write content to a file in the current app's workspace.

    Args:
        file_path: Path relative to the app's source directory (e.g. "src/main.ts").
        content: The file content to write.

    Returns:
        Confirmation of the file write.
    """
    app_name = tool_context.state.get("current_app")
    if not app_name:
        return "Error: no app context. Call generate_app first."

    app_dir = tool_context.state.get("app_dir", os.path.join(WORKSPACE_DIR, app_name))
    full_path = os.path.join(app_dir, file_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    with open(full_path, "w") as f:
        f.write(content)

    return f"Wrote {len(content)} bytes to {full_path}"


def build_image(tool_context: ToolContext) -> str:
    """Build an OCI container image for the current app using Nix.

    Uses the flake.nix in the app directory to build a container image
    via nixpkgs dockerTools.

    Returns:
        The path to the built image or an error message.
    """
    app_name = tool_context.state.get("current_app")
    if not app_name:
        return "Error: no app context. Call generate_app first."

    app_dir = tool_context.state.get("app_dir", os.path.join(WORKSPACE_DIR, app_name))
    output = _run(["nix", "build", ".#docker-image", "--no-link", "--print-out-paths"], cwd=app_dir)

    if "Command failed" in output:
        return f"Build failed:\n{output}"

    image_path = output.strip()
    tool_context.state["image_path"] = image_path
    return f"Image built successfully at {image_path}"


def push_image(tool_context: ToolContext) -> str:
    """Push the built OCI image to the in-cluster Zot registry.

    Nix dockerTools emits a Docker archive tarball. Zot accepts that archive
    when it is uploaded through skopeo, which can also read the compressed
    `.tar.gz` output after a temporary decompression step.

    Returns:
        The full image reference or an error message.
    """
    app_name = tool_context.state.get("current_app")
    image_path = tool_context.state.get("image_path")
    if not app_name or not image_path:
        return "Error: no image to push. Call build_image first."

    image_ref = f"{ZOT_REGISTRY}/{app_name}:latest"
    archive_path, temporary_archive = _prepare_docker_archive(image_path)

    try:
        output = _run(
            [
                "skopeo",
                "copy",
                "--insecure-policy",
                "--dest-tls-verify=false",
                f"docker-archive:{archive_path}",
                f"docker://{image_ref}",
            ]
        )
    finally:
        if temporary_archive is not None:
            temporary_archive.unlink(missing_ok=True)

    if "Command failed" in output:
        return f"Push failed:\n{output}"

    tool_context.state["image_ref"] = image_ref
    return f"Image pushed to {image_ref}"


def deploy_app(port: int, tool_context: ToolContext) -> str:
    """Deploy the application to Kubernetes with NetBird exposure.

    Creates a Deployment and Service in the apps namespace.
    The Service is annotated with netbird.io/expose for network access.

    Args:
        port: The port the application listens on.

    Returns:
        Confirmation of the deployment or an error message.
    """
    app_name = tool_context.state.get("current_app")
    image_ref = tool_context.state.get("image_ref")
    if not app_name or not image_ref:
        return "Error: no image ref. Call push_image first."

    manifest = textwrap.dedent(f"""\
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: {app_name}
          namespace: {DEPLOY_NAMESPACE}
          labels:
            app: {app_name}
        spec:
          replicas: 1
          selector:
            matchLabels:
              app: {app_name}
          template:
            metadata:
              labels:
                app: {app_name}
            spec:
              containers:
                - name: {app_name}
                  image: {image_ref}
                  ports:
                    - containerPort: {port}
        ---
        apiVersion: v1
        kind: Service
        metadata:
          name: {app_name}
          namespace: {DEPLOY_NAMESPACE}
          annotations:
            netbird.io/expose: "true"
        spec:
          type: ClusterIP
          selector:
            app: {app_name}
          ports:
            - port: 80
              targetPort: {port}
    """)

    result = subprocess.run(
        ["kubectl", "apply", "-f", "-"],
        input=manifest,
        capture_output=True,
        text=True,
        timeout=60,
    )

    if result.returncode != 0:
        return f"Deploy failed:\n{result.stderr}"

    return f"Deployed {app_name} to namespace {DEPLOY_NAMESPACE}. Service exposed via NetBird."


root_agent = Agent(
    model=OpenAI(
        model=OPENAI_MODEL,
        type="openai",
        api_key=os.environ["OPENAI_API_KEY"],
    ),
    name="software_developer",
    description="Generates TypeScript web applications, builds OCI images with Nix, and deploys to Kubernetes.",
    instruction=textwrap.dedent("""\
        You are a software developer agent for Rawkode Academy.

        Your workflow for creating and deploying an application:
        1. Call generate_app with the app name and description to set up the workspace.
        2. Call write_file to create src/main.ts (and any other source files) with the TypeScript code.
        3. Call build_image to build the OCI container image using Nix.
        4. Call push_image to push the image to the Zot registry.
        5. Call deploy_app with the port the app listens on to deploy to Kubernetes.

        Always follow these steps in order. Each step depends on the previous one.
        Generate clean, working Deno TypeScript code.
        Only create Deployment and Service resources - no Ingress or Gateway.
    """),
    tools=[generate_app, write_file, build_image, push_image, deploy_app],
)
