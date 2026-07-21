"""Timing helpers.

`timebudget`'s decorator labels every measurement with the bare function name,
so the seven `build` methods all report as "build" and are impossible to tell
apart. `timed` wraps it in a block named after the owning class, giving output
like "Form.build took 950ms".
"""

from functools import wraps

from timebudget import timebudget


def timed(method):
    """Time an instance method, labelled `ClassName.method`."""

    @wraps(method)
    def inner(self, *args, **kwargs):
        with timebudget(f"{type(self).__name__}.{method.__name__}"):
            return method(self, *args, **kwargs)

    return inner
