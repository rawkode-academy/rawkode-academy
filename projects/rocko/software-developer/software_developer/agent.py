import base64
import gzip
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import textwrap

from google.adk import Agent
from google.adk.tools.tool_context import ToolContext
from kagent.adk.models import OpenAI

WORKSPACE_DIR = os.environ.get("WORKSPACE_DIR", "/workspace")
ZOT_REGISTRY = os.environ.get("ZOT_REGISTRY", "zot.zot.svc.cluster.local:5000")
DEPLOY_NAMESPACE = os.environ.get("DEPLOY_NAMESPACE", "apps")
DEPLOY_RUNTIME_IMAGE = os.environ.get(
    "DEPLOY_RUNTIME_IMAGE",
    "ghcr.io/rawkode-academy/rocko-software-developer:latest",
)
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4")


def _run(cmd: list[str], cwd: str | None = None) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=300)
    if result.returncode != 0:
        return f"Command failed (exit {result.returncode}):\n{result.stderr}"
    return result.stdout


def bash(command: str, tool_context: ToolContext, cwd: str | None = None) -> str:
    """Run a shell command inside the developer container."""
    working_dir = cwd or tool_context.state.get("app_dir") or WORKSPACE_DIR
    result = subprocess.run(
        ["bash", "-lc", command],
        capture_output=True,
        text=True,
        cwd=working_dir,
        timeout=600,
    )
    output = result.stdout
    if result.stderr:
        output = f"{output}\n{result.stderr}" if output else result.stderr

    if result.returncode != 0:
        return (
            f"Command failed (exit {result.returncode}) in {working_dir}:\n"
            f"{output.strip()}"
        )

    return f"Command succeeded in {working_dir}:\n{output.strip()}"


def _workspace_path() -> Path:
    return Path(WORKSPACE_DIR)


def _app_path(app_name: str) -> Path:
    return _workspace_path() / app_name


def _validate_relative_path(path: str) -> Path:
    relative_path = Path(path)
    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError("Paths must stay within the current app directory.")
    return relative_path


def _require_current_app(tool_context: ToolContext) -> tuple[str, Path]:
    app_name = tool_context.state.get("current_app")
    if not app_name:
        raise ValueError("No app context. Call select_app or generate_app first.")

    app_dir = Path(tool_context.state.get("app_dir", os.path.join(WORKSPACE_DIR, app_name)))
    if not app_dir.exists() or not app_dir.is_dir():
        raise ValueError(f"App directory does not exist: {app_dir}")

    return app_name, app_dir


def _reset_build_state(tool_context: ToolContext) -> None:
    # google.adk State is mapping-like but does not implement pop/delete.
    tool_context.state["image_path"] = None
    tool_context.state["image_ref"] = None


def _prepare_docker_archive(image_path: str) -> tuple[str, Path | None]:
    source_path = Path(image_path)
    if source_path.suffix != ".gz":
        return str(source_path), None

    with tempfile.NamedTemporaryFile(suffix=".tar", delete=False) as temporary_archive:
        temporary_path = Path(temporary_archive.name)

    with gzip.open(source_path, "rb") as source_file, temporary_path.open("wb") as archive_file:
        shutil.copyfileobj(source_file, archive_file)

    return str(temporary_path), temporary_path


def _build_source_archive(app_dir: str) -> str:
    app_path = Path(app_dir)
    archive_buffer = io.BytesIO()

    with tarfile.open(fileobj=archive_buffer, mode="w:gz") as archive:
        for path in sorted(app_path.rglob("*")):
            archive.add(path, arcname=path.relative_to(app_path))

    return base64.b64encode(archive_buffer.getvalue()).decode("ascii")


def list_apps() -> str:
    """List application directories currently available in the workspace."""
    workspace = _workspace_path()
    if not workspace.exists():
        return f"Workspace directory does not exist: {workspace}"

    apps: list[str] = []
    for path in sorted(workspace.iterdir()):
        if not path.is_dir():
            continue

        summary: list[str] = []
        if (path / "src" / "main.ts").exists():
            summary.append("src/main.ts")
        if (path / "flake.nix").exists():
            summary.append("flake.nix")

        details = ", ".join(summary) if summary else "directory"
        apps.append(f"- {path.name} ({details})")

    if not apps:
        return f"No apps found in {workspace}"

    return "Available apps:\n" + "\n".join(apps)


def select_app(app_name: str, tool_context: ToolContext) -> str:
    """Select an existing application in the workspace for inspection or editing."""
    app_dir = _app_path(app_name)
    if not app_dir.exists() or not app_dir.is_dir():
        return f"Error: app {app_name!r} does not exist in {WORKSPACE_DIR}. Call list_apps first."

    tool_context.state["current_app"] = app_name
    tool_context.state["app_dir"] = str(app_dir)
    _reset_build_state(tool_context)
    return f"Selected existing app {app_name} at {app_dir}"


def list_files(subdirectory: str = ".", tool_context: ToolContext | None = None) -> str:
    """List files within the current application's directory."""
    try:
        if tool_context is None:
            raise ValueError("No tool context available.")
        app_name, app_dir = _require_current_app(tool_context)
        relative_path = _validate_relative_path(subdirectory)
    except ValueError as error:
        return f"Error: {error}"

    target_dir = app_dir / relative_path
    if not target_dir.exists():
        return f"Error: path does not exist: {target_dir}"
    if not target_dir.is_dir():
        return f"Error: path is not a directory: {target_dir}"

    paths = [
        path.relative_to(app_dir).as_posix()
        for path in sorted(target_dir.rglob("*"))
        if path.is_file()
    ]
    if not paths:
        return f"No files found in {target_dir}"

    return f"Files for {app_name}:\n" + "\n".join(f"- {path}" for path in paths[:200])


def read_file(file_path: str, tool_context: ToolContext) -> str:
    """Read a file from the current application's directory."""
    try:
        _, app_dir = _require_current_app(tool_context)
        relative_path = _validate_relative_path(file_path)
    except ValueError as error:
        return f"Error: {error}"

    full_path = app_dir / relative_path
    if not full_path.exists() or not full_path.is_file():
        return f"Error: file does not exist: {full_path}"

    return full_path.read_text()


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
    app_dir = _app_path(app_name)
    if app_dir.exists() and any(app_dir.iterdir()):
        return (
            f"Error: app {app_name!r} already exists at {app_dir}. "
            "Use select_app to modify it instead of generating a new app."
        )

    src_dir = app_dir / "src"
    src_dir.mkdir(parents=True, exist_ok=True)

    # Copy the template flake.nix
    template_flake = "/opt/templates/flake.nix"
    if os.path.exists(template_flake):
        with open(template_flake) as f:
            flake_content = f.read()
        with open(app_dir / "flake.nix", "w") as f:
            f.write(flake_content)

    tool_context.state["current_app"] = app_name
    tool_context.state["app_dir"] = str(app_dir)
    _reset_build_state(tool_context)

    return f"App directory created at {app_dir} with flake.nix template. Write the TypeScript source files to {src_dir}/main.ts using the write_file tool."


def write_file(file_path: str, content: str, tool_context: ToolContext) -> str:
    """Write content to a file in the current app's workspace.

    Args:
        file_path: Path relative to the app's source directory (e.g. "src/main.ts").
        content: The file content to write.

    Returns:
        Confirmation of the file write.
    """
    try:
        _, app_dir = _require_current_app(tool_context)
        relative_path = _validate_relative_path(file_path)
    except ValueError as error:
        return f"Error: {error}"

    full_path = app_dir / relative_path
    full_path.parent.mkdir(parents=True, exist_ok=True)

    with open(full_path, "w") as f:
        f.write(content)

    _reset_build_state(tool_context)
    return f"Wrote {len(content)} bytes to {full_path}"


def build_image(tool_context: ToolContext) -> str:
    """Build an OCI container image for the current app using Nix.

    Uses the flake.nix in the app directory to build a container image
    via nixpkgs dockerTools.

    Returns:
        The path to the built image or an error message.
    """
    try:
        app_name, app_dir = _require_current_app(tool_context)
    except ValueError as error:
        return f"Error: {error}"

    output = _run(["nix", "build", ".#docker-image", "--no-link", "--print-out-paths"], cwd=str(app_dir))

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
    The source tree is bundled into a Secret and unpacked by an init container
    so nodes can run the app from a public runtime image instead of pulling the
    in-cluster Zot image directly.

    Args:
        port: The port the application listens on.

    Returns:
        Confirmation of the deployment or an error message.
    """
    app_name = tool_context.state.get("current_app")
    image_ref = tool_context.state.get("image_ref")
    if not app_name or not image_ref:
        return "Error: no image ref. Call push_image first."

    app_dir = tool_context.state.get("app_dir", os.path.join(WORKSPACE_DIR, app_name))
    source_archive = _build_source_archive(app_dir)
    source_secret_name = f"{app_name}-source"

    manifest = textwrap.dedent(f"""\
        apiVersion: v1
        kind: Secret
        metadata:
          name: {source_secret_name}
          namespace: {DEPLOY_NAMESPACE}
        type: Opaque
        data:
          src.tar.gz: {source_archive}
        ---
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
              securityContext:
                fsGroup: 1001
                runAsGroup: 1001
                runAsNonRoot: true
                runAsUser: 1001
                seccompProfile:
                  type: RuntimeDefault
              initContainers:
                - name: unpack-source
                  image: {DEPLOY_RUNTIME_IMAGE}
                  command:
                    - sh
                    - -lc
                    - mkdir -p /app && tar -xzf /source/src.tar.gz -C /app
                  securityContext:
                    allowPrivilegeEscalation: false
                    capabilities:
                      drop:
                        - ALL
                    runAsGroup: 1001
                    runAsNonRoot: true
                    runAsUser: 1001
                    seccompProfile:
                      type: RuntimeDefault
                  volumeMounts:
                    - name: source
                      mountPath: /source
                    - name: app
                      mountPath: /app
              containers:
                - name: {app_name}
                  image: {DEPLOY_RUNTIME_IMAGE}
                  command:
                    - deno
                    - run
                    - --allow-net
                    - --allow-env
                    - --allow-read
                    - /app/src/main.ts
                  ports:
                    - containerPort: {port}
                  securityContext:
                    allowPrivilegeEscalation: false
                    capabilities:
                      drop:
                        - ALL
                    runAsGroup: 1001
                    runAsNonRoot: true
                    runAsUser: 1001
                    seccompProfile:
                      type: RuntimeDefault
                  volumeMounts:
                    - name: app
                      mountPath: /app
              volumes:
                - name: source
                  secret:
                    secretName: {source_secret_name}
                - name: app
                  emptyDir: {{}}
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

    return (
        f"Deployed {app_name} to namespace {DEPLOY_NAMESPACE} using runtime image "
        f"{DEPLOY_RUNTIME_IMAGE}. Built image remains available at {image_ref}. "
        "Service exposed via NetBird."
    )


root_agent = Agent(
    model=OpenAI(
        model=OPENAI_MODEL,
        type="openai",
        api_key=os.environ["OPENAI_API_KEY"],
    ),
    name="software_developer",
    description="Builds new software and modifies, fixes, debugs, and deploys existing software using bash, Nix, and kubectl.",
    instruction=textwrap.dedent("""\
        You are a pragmatic software developer agent for Rawkode Academy.

        Environment:
        - You have a bash tool and may use it freely for inspection, testing, formatting,
          debugging, git, nix, kubectl, curl, and general software engineering work.
        - Nix is installed.
        - kubectl is installed and configured for the current cluster.
        - Your shared workspace root is /workspace.
        - Existing app directories live under /workspace.
        - New or updated applications are deployed into the Kubernetes namespace apps.
        - Built images are pushed to the internal registry zot.zot.svc.cluster.local:5000.
        - The runtime image used for deployed apps is provided via DEPLOY_RUNTIME_IMAGE.

        Your job:
        - Build new software when asked.
        - Modify, fix, debug, and improve existing software when asked.
        - Use the existing app in place unless the user explicitly asks to rebuild from scratch.
        - Verify your work with bash whenever practical instead of guessing.

        Preferred workflow for existing software:
        1. Call list_apps if you need to discover or confirm the app name.
        2. Call select_app to work inside the existing app directory.
        3. Inspect with list_files, read_file, and bash.
        4. Update files in place with write_file or use bash for broader edits.
        5. Validate with bash.
        6. Build, push, and deploy when the user asks for rollout or when deployment verification is part of the request.

        Preferred workflow for new software:
        1. Call generate_app to create the workspace scaffold.
        2. Create or refine files with write_file and bash.
        3. Validate with bash.
        4. Call build_image, push_image, and deploy_app when needed.

        Important rules:
        - Do not default to generating a new app when the request is about fixing or changing an existing one.
        - Ask a concise follow-up question only when the target app or desired outcome is genuinely ambiguous.
        - Prefer concrete execution and verification over high-level plans.
        - Keep deployed workloads simple: Deployment and Service resources only unless the user explicitly asks otherwise.
    """),
    tools=[
        bash,
        list_apps,
        select_app,
        list_files,
        read_file,
        generate_app,
        write_file,
        build_image,
        push_image,
        deploy_app,
    ],
)
