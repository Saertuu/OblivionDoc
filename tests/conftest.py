import os
import tempfile
from pathlib import Path

os.environ["OBLIVION_DATA_DIR"] = tempfile.mkdtemp(prefix="OblivionDoc-tests-")
os.environ["OBLIVION_DESKTOP_KEY"] = "automated-tests-only-key"

import pytest
from fastapi.testclient import TestClient
from backend.main import app, DESKTOP_KEY
from backend.database import Base, engine


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app, headers={"X-Oblivion-Key": DESKTOP_KEY}) as client:
        yield client
