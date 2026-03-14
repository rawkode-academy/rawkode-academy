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

SOURCE_IMAGE_PREFIX = f"{ZOT_REGISTRY}/source"
SOURCE_IMAGE_ANNOTATION = "rawkode.academy/source-image"
SOURCE_STORAGE_ANNOTATION = "rawkode.academy/source-storage"
SOURCE_DIGEST_ANNOTATION = "rawkode.academy/source-digest"
LEGACY_SOURCE_SECRET_SUFFIX = "-source"


def _run(
    cmd: list[str],
    cwd: str | None = None,
    input_text: str | None = None,
    timeout: int = 300,
) -> str:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd,
        input=input_text,
        timeout=timeout,
    )
    if result.returncode != 0:
        output = result.stderr.strip() or result.stdout.strip()
        return f"Command failed (exit {result.returncode}):\n{output}"
    return result.stdout


def _run_json(cmd: list[str], cwd: str | None = None, timeout: int = 300) -> dict:
    output = _run(cmd, cwd=cwd, timeout=timeout)
    if output.startswith("Command failed"):
        raise RuntimeError(output)
    return json.loads(output)


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


def _source_image_ref(app_name: str) -> str:
    return f"{SOURCE_IMAGE_PREFIX}/{app_name}:latest"


def _legacy_source_secret_name(app_name: str) -> str:
    return f"{app_name}{LEGACY_SOURCE_SECRET_SUFFIX}"


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


def _extract_archive(archive: tarfile.TarFile, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    destination_root = destination.resolve()

    for member in archive.getmembers():
        member_path = (destination / member.name).resolve()
        if member_path != destination_root and destination_root not in member_path.parents:
            raise ValueError(f"Archive contained unsafe path: {member.name}")

    archive.extractall(destination)


def _extract_tar_file(archive_path: Path, destination: Path) -> None:
    with tarfile.open(archive_path, "r:") as archive:
        _extract_archive(archive, destination)


def _extract_gzip_tar_bytes(compressed_archive: bytes, destination: Path) -> None:
    archive_bytes = gzip.decompress(compressed_archive)
    with tarfile.open(fileobj=io.BytesIO(archive_bytes), mode="r:") as archive:
        _extract_archive(archive, destination)


def _create_source_layer(app_dir: Path) -> Path:
    with tempfile.NamedTemporaryFile(suffix=".tar", delete=False) as temporary_archive:
        archive_path = Path(temporary_archive.name)

    with tarfile.open(archive_path, "w:") as archive:
        for path in sorted(app_dir.rglob("*")):
            archive.add(path, arcname=path.relative_to(app_dir), recursive=False)

    return archive_path


def _prepare_app_dir(app_name: str) -> Path:
    app_dir = _app_path(app_name)
    if app_dir.exists():
        shutil.rmtree(app_dir)
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir


def _set_current_app(tool_context: ToolContext, app_name: str, app_dir: Path) -> None:
    tool_context.state["current_app"] = app_name
    tool_context.state["app_dir"] = str(app_dir)
    tool_context.state["source_image_ref"] = _source_image_ref(app_name)
    _reset_build_state(tool_context)


def _source_image_exists(app_name: str) -> bool:
    result = subprocess.run(
        ["crane", "digest", "--insecure", _source_image_ref(app_name)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    return result.returncode == 0


def _deployment_exists(app_name: str) -> bool:
    result = subprocess.run(
        ["kubectl", "get", "deployment", app_name, "-n", DEPLOY_NAMESPACE],
        capture_output=True,
        text=True,
        timeout=60,
    )
    return result.returncode == 0


def _get_deployment(app_name: str) -> dict | None:
    result = subprocess.run(
        ["kubectl", "get", "deployment", app_name, "-n", DEPLOY_NAMESPACE, "-o", "json"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        return None
    return json.loads(result.stdout)


def _restore_source_image(app_name: str, destination: Path) -> None:
    source_image_ref = _source_image_ref(app_name)
    with tempfile.NamedTemporaryFile(suffix=".tar", delete=False) as temporary_archive:
        archive_path = Path(temporary_archive.name)

    try:
        output = _run(
            ["crane", "export", "--insecure", source_image_ref, str(archive_path)],
            timeout=300,
        )
        if output.startswith("Command failed"):
            raise RuntimeError(output)
        _extract_tar_file(archive_path, destination)
    finally:
        archive_path.unlink(missing_ok=True)


def _restore_legacy_source_secret(app_name: str, destination: Path) -> None:
    secret = _run_json(
        [
            "kubectl",
            "get",
            "secret",
            _legacy_source_secret_name(app_name),
            "-n",
            DEPLOY_NAMESPACE,
            "-o",
            "json",
        ]
    )
    encoded_archive = secret.get("data", {}).get("src.tar.gz")
    if not encoded_archive:
        raise RuntimeError("Legacy source secret is missing src.tar.gz")

    _extract_gzip_tar_bytes(base64.b64decode(encoded_archive), destination)


def _publish_source_image(app_name: str, app_dir: Path) -> tuple[str, str]:
    source_image_ref = _source_image_ref(app_name)
    archive_path = _create_source_layer(app_dir)

    try:
        output = _run(
            [
                "crane",
                "append",
                "--insecure",
                "--oci-empty-base",
                "--new_layer",
                str(archive_path),
                "--new_tag",
                source_image_ref,
            ],
            timeout=300,
        )
        if output.startswith("Command failed"):
            raise RuntimeError(output)

        digest_output = _run(
            ["crane", "digest", "--insecure", source_image_ref],
            timeout=60,
        )
        if digest_output.startswith("Command failed"):
            raise RuntimeError(digest_output)
    finally:
        archive_path.unlink(missing_ok=True)

    return source_image_ref, digest_output.strip()


def list_apps() -> str:
    """List deployed applications that can be restored into the ephemeral workspace."""
    try:
        deployments = _run_json(
            ["kubectl", "get", "deployments", "-n", DEPLOY_NAMESPACE, "-o", "json"]
        )
        secrets = _run_json(
            ["kubectl", "get", "secrets", "-n", DEPLOY_NAMESPACE, "-o", "json"]
        )
    except RuntimeError as error:
        return f"Error: {error}"

    legacy_secret_names = {
        item["metadata"]["name"]
        for item in secrets.get("items", [])
        if item["metadata"]["name"].endswith(LEGACY_SOURCE_SECRET_SUFFIX)
    }

    apps: list[str] = []
    for item in sorted(deployments.get("items", []), key=lambda entry: entry["metadata"]["name"]):
        app_name = item["metadata"]["name"]
        annotations = item["metadata"].get("annotations", {})
        if annotations.get(SOURCE_STORAGE_ANNOTATION) == "oci":
            source_mode = "source=oci"
        elif _legacy_source_secret_name(app_name) in legacy_secret_names:
            source_mode = "source=legacy-secret"
        else:
            source_mode = "source=unknown"

        apps.append(f"- {app_name} ({source_mode})")

    if not apps:
        return f"No deployed apps found in namespace {DEPLOY_NAMESPACE}"

    return "Available deployed apps:\n" + "\n".join(apps)


def select_app(app_name: str, tool_context: ToolContext) -> str:
    """Restore a deployed app into the ephemeral workspace for inspection or editing."""
    local_app_dir = _app_path(app_name)
    if local_app_dir.exists() and not _deployment_exists(app_name) and not _source_image_exists(app_name):
        _set_current_app(tool_context, app_name, local_app_dir)
        return (
            f"Selected local draft app {app_name} at {local_app_dir}. "
            "This draft is not durable until you deploy it."
        )

    deployment = _get_deployment(app_name)
    if deployment is None and not _source_image_exists(app_name):
        return (
            f"Error: app {app_name!r} is not deployed in {DEPLOY_NAMESPACE} and has no "
            "durable source artifact. Call list_apps first."
        )

    app_dir = _prepare_app_dir(app_name)
    restored_from: str | None = None

    try:
        if _source_image_exists(app_name):
            _restore_source_image(app_name, app_dir)
            restored_from = "OCI source image"
        else:
            _restore_legacy_source_secret(app_name, app_dir)
            restored_from = "legacy source secret"
    except (RuntimeError, ValueError) as error:
        shutil.rmtree(app_dir, ignore_errors=True)
        return f"Error: failed to restore app {app_name!r}: {error}"

    _set_current_app(tool_context, app_name, app_dir)
    return f"Selected app {app_name} at {app_dir}, restored from {restored_from}."


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
    """Generate a new TypeScript app in the ephemeral workspace."""
    app_dir = _app_path(app_name)
    if app_dir.exists() and any(app_dir.iterdir()):
        return (
            f"Error: app {app_name!r} already exists at {app_dir}. "
            "Use select_app to modify it instead of generating a new app."
        )

    if _deployment_exists(app_name) or _source_image_exists(app_name):
        return (
            f"Error: app {app_name!r} already exists as a durable app. "
            "Use select_app to modify it instead of generating a new app."
        )

    src_dir = app_dir / "src"
    src_dir.mkdir(parents=True, exist_ok=True)

    template_flake = "/opt/templates/flake.nix"
    if os.path.exists(template_flake):
        with open(template_flake) as source_file:
            flake_content = source_file.read()
        with open(app_dir / "flake.nix", "w") as target_file:
            target_file.write(flake_content)

    _set_current_app(tool_context, app_name, app_dir)

    return (
        f"App directory created at {app_dir} with flake.nix template. "
        f"Write the TypeScript source files to {src_dir}/main.ts using the write_file tool. "
        "This app remains an ephemeral draft until you deploy it."
    )


def write_file(file_path: str, content: str, tool_context: ToolContext) -> str:
    """Write content to a file in the current application's workspace."""
    try:
        _, app_dir = _require_current_app(tool_context)
        relative_path = _validate_relative_path(file_path)
    except ValueError as error:
        return f"Error: {error}"

    full_path = app_dir / relative_path
    full_path.parent.mkdir(parents=True, exist_ok=True)

    with open(full_path, "w") as file_handle:
        file_handle.write(content)

    _reset_build_state(tool_context)
    return f"Wrote {len(content)} bytes to {full_path}"


def build_image(tool_context: ToolContext) -> str:
    """Build an OCI container image for the current app using Nix."""
    try:
        _, app_dir = _require_current_app(tool_context)
    except ValueError as error:
        return f"Error: {error}"

    output = _run(
        ["nix", "build", ".#docker-image", "--no-link", "--print-out-paths"],
        cwd=str(app_dir),
        timeout=600,
    )

    if output.startswith("Command failed"):
        return f"Build failed:\n{output}"

    image_path = output.strip()
    tool_context.state["image_path"] = image_path
    return f"Image built successfully at {image_path}"


def push_image(tool_context: ToolContext) -> str:
    """Push the built OCI image to the in-cluster Zot registry."""
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
            ],
            timeout=600,
        )
    finally:
        if temporary_archive is not None:
            temporary_archive.unlink(missing_ok=True)

    if output.startswith("Command failed"):
        return f"Push failed:\n{output}"

    tool_context.state["image_ref"] = image_ref
    return f"Image pushed to {image_ref}"


def deploy_app(port: int, tool_context: ToolContext) -> str:
    """Persist app source to OCI and deploy the app into Kubernetes."""
    try:
        app_name, app_dir = _require_current_app(tool_context)
    except ValueError as error:
        return f"Error: {error}"

    try:
        source_image_ref, source_digest = _publish_source_image(app_name, app_dir)
    except RuntimeError as error:
        return f"Deploy failed while publishing source image:\n{error}"

    manifest = textwrap.dedent(
        f"""\
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: {app_name}
          namespace: {DEPLOY_NAMESPACE}
          labels:
            app: {app_name}
          annotations:
            {SOURCE_IMAGE_ANNOTATION}: "{source_image_ref}"
            {SOURCE_STORAGE_ANNOTATION}: "oci"
            {SOURCE_DIGEST_ANNOTATION}: "{source_digest}"
        spec:
          replicas: 1
          selector:
            matchLabels:
              app: {app_name}
          template:
            metadata:
              labels:
                app: {app_name}
              annotations:
                {SOURCE_IMAGE_ANNOTATION}: "{source_image_ref}"
                {SOURCE_STORAGE_ANNOTATION}: "oci"
                {SOURCE_DIGEST_ANNOTATION}: "{source_digest}"
            spec:
              securityContext:
                fsGroup: 1001
                runAsGroup: 1001
                runAsNonRoot: true
                runAsUser: 1001
                seccompProfile:
                  type: RuntimeDefault
              initContainers:
                - name: pull-source
                  image: {DEPLOY_RUNTIME_IMAGE}
                  env:
                    - name: SOURCE_IMAGE
                      value: "{source_image_ref}"
                  command:
                    - sh
                    - -lc
                    - mkdir -p /app && crane export --insecure "$SOURCE_IMAGE" - | tar -xf - -C /app
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
        """
    )

    apply_output = _run(
        ["kubectl", "apply", "-f", "-"],
        input_text=manifest,
        timeout=120,
    )
    if apply_output.startswith("Command failed"):
        return f"Deploy failed:\n{apply_output}"

    delete_secret_output = _run(
        [
            "kubectl",
            "delete",
            "secret",
            _legacy_source_secret_name(app_name),
            "-n",
            DEPLOY_NAMESPACE,
            "--ignore-not-found",
        ],
        timeout=60,
    )
    if delete_secret_output.startswith("Command failed"):
        return (
            f"Deployed {app_name}, but failed to clean up the legacy source secret:\n"
            f"{delete_secret_output}"
        )

    image_ref = tool_context.state.get("image_ref")
    _set_current_app(tool_context, app_name, app_dir)

    message = (
        f"Persisted source for {app_name} to {source_image_ref} "
        f"({source_digest}) and deployed it to namespace {DEPLOY_NAMESPACE} "
        f"using runtime image {DEPLOY_RUNTIME_IMAGE}. Service exposed via NetBird."
    )
    if image_ref:
        message += f" Built OCI image remains available at {image_ref}."
    return message


root_agent = Agent(
    model=OpenAI(
        model=OPENAI_MODEL,
        type="openai",
        api_key=os.environ["OPENAI_API_KEY"],
    ),
    name="software_developer",
    description=(
        "Stateless software developer that restores deployed apps from OCI source "
        "images, then builds, fixes, debugs, and deploys them using bash, Nix, and kubectl."
    ),
    instruction=textwrap.dedent(
        """\
        You are a pragmatic software developer agent for Rawkode Academy.

        Environment:
        - You have a bash tool and may use it freely for inspection, testing, formatting,
          debugging, git, nix, kubectl, curl, and general software engineering work.
        - Nix is installed.
        - kubectl is installed and configured for the current cluster.
        - Your workspace root is /workspace, and it is ephemeral.
        - Durable source for deployed apps lives in the internal registry as OCI source images.
        - Deployed app source is restored into /workspace on demand when you call select_app.
        - New or updated applications are deployed into the Kubernetes namespace apps.
        - Built images may be pushed to the internal registry zot.zot.svc.cluster.local:5000.
        - The runtime image used for deployed apps is provided via DEPLOY_RUNTIME_IMAGE.

        Your job:
        - Build new software when asked.
        - Modify, fix, debug, and improve existing software when asked.
        - Use the existing app in place unless the user explicitly asks to rebuild from scratch.
        - Verify your work with bash whenever practical instead of guessing.
        - Remember that undeployed draft changes are not durable across pod restarts.

        Preferred workflow for existing software:
        1. Call list_apps if you need to discover or confirm the deployed app name.
        2. Call select_app to restore the app into the ephemeral workspace.
        3. Inspect with list_files, read_file, and bash.
        4. Update files in place with write_file or use bash for broader edits.
        5. Validate with bash.
        6. Call deploy_app when the user wants rollout or when your changes should become durable.

        Preferred workflow for new software:
        1. Call generate_app to create the ephemeral draft scaffold.
        2. Create or refine files with write_file and bash.
        3. Validate with bash.
        4. Call deploy_app when the app should become durable and live.
        5. Call build_image and push_image only when the user explicitly wants a standalone app image artifact.

        Important rules:
        - Do not default to generating a new app when the request is about fixing or changing an existing one.
        - Ask a concise follow-up question only when the target app or desired outcome is genuinely ambiguous.
        - Prefer concrete execution and verification over high-level plans.
        - Keep deployed workloads simple: Deployment and Service resources only unless the user explicitly asks otherwise.
        """
    ),
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
