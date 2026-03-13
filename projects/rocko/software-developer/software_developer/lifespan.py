import logging
import os
from contextlib import asynccontextmanager
from typing import Any


@asynccontextmanager
async def lifespan(app: Any):
    workspace = os.environ.get("WORKSPACE_DIR", "/workspace")
    os.makedirs(workspace, exist_ok=True)
    logging.info("software-developer agent starting, workspace=%s", workspace)
    try:
        yield
    finally:
        logging.info("software-developer agent shutting down")
