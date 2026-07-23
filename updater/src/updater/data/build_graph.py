"""Declarative build ordering for the DataFrames.

Each stage declares what it depends on, and the order is derived by
topological sort rather than hand-maintained in a fixed sequence. The
dependencies are genuine data dependencies (team ratings are derived from the
standings tables, form weights results by opposition rating, and the upcoming
predictions need all of them), so this does not make the build faster - it
makes the ordering self-documenting and impossible to get silently wrong.
"""

from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Stage:
    name: str
    build: Callable[[], None]
    depends_on: tuple[str, ...] = field(default_factory=tuple)


def resolve_order(stages: list[Stage]) -> list[Stage]:
    """Return stages in dependency order.

    Raises:
        ValueError: A dependency is unknown, or the graph contains a cycle.
    """
    by_name = {stage.name: stage for stage in stages}

    for stage in stages:
        for dependency in stage.depends_on:
            if dependency not in by_name:
                raise ValueError(
                    f"Stage {stage.name!r} depends on unknown stage {dependency!r}"
                )

    ordered: list[Stage] = []
    done: set[str] = set()
    visiting: set[str] = set()

    def visit(stage: Stage):
        if stage.name in done:
            return
        if stage.name in visiting:
            raise ValueError(f"Circular dependency involving stage {stage.name!r}")

        visiting.add(stage.name)
        for dependency in stage.depends_on:
            visit(by_name[dependency])
        visiting.discard(stage.name)

        done.add(stage.name)
        ordered.append(stage)

    # Sorted for a deterministic order between stages that do not depend on
    # each other.
    for stage in sorted(stages, key=lambda s: s.name):
        visit(stage)

    return ordered
