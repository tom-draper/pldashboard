"""Every module must import on its own.

The prediction engines and the DataFrame package refer to each other:
form_predictor builds Fixtures frames, and the upcoming frame runs
FormPredictor. That is a genuine cycle, and it used to mean
`import updater.predictions.form_predictor` raised ImportError unless
something had already imported updater.data.dataframes. upcoming.py now defers
its side of it.

Each module is imported in a clean interpreter, because import order within one
process hides exactly this fault: once any test has pulled in the DataFrames,
the broken import starts working.
"""

import subprocess
import sys
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "src"

MODULES = sorted(
    str(path.relative_to(SRC).with_suffix("")).replace("/", ".").removesuffix(".__init__")
    for path in SRC.rglob("*.py")
    if "egg-info" not in str(path)
)


@pytest.mark.parametrize("module", MODULES)
def test_module_imports_standalone(module: str):
    result = subprocess.run(
        [sys.executable, "-c", f"import {module}"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"`import {module}` failed in a clean interpreter:\n{result.stderr}"
    )
