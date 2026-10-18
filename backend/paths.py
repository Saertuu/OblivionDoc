"""Persistent files belong to the user's account, never the frozen bundle."""
import os
import sys
from pathlib import Path


def get_data_dir() -> Path:
    override = os.environ.get("OBLIVION_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local")) / "OblivionDoc"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "OblivionDoc"


DATA_DIR = get_data_dir()
DATA_DIR.mkdir(parents=True, exist_ok=True)
