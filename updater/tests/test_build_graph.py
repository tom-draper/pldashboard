import pytest
from updater.data.build_graph import Stage, resolve_order


def _names(stages):
    return [s.name for s in stages]


def test_resolve_order_respects_dependencies():
    stages = [
        Stage("upcoming", lambda: None, depends_on=("form", "fixtures")),
        Stage("form", lambda: None, depends_on=("team_ratings",)),
        Stage("team_ratings", lambda: None, depends_on=("standings",)),
        Stage("standings", lambda: None),
        Stage("fixtures", lambda: None),
    ]
    order = _names(resolve_order(stages))

    for stage in stages:
        for dependency in stage.depends_on:
            assert order.index(dependency) < order.index(stage.name)


def test_resolve_order_is_deterministic():
    stages = [Stage("b", lambda: None), Stage("a", lambda: None)]
    assert _names(resolve_order(stages)) == _names(resolve_order(stages))


def test_resolve_order_includes_every_stage():
    stages = [
        Stage("a", lambda: None),
        Stage("b", lambda: None, depends_on=("a",)),
        Stage("c", lambda: None),
    ]
    assert sorted(_names(resolve_order(stages))) == ["a", "b", "c"]


def test_resolve_order_rejects_cycles():
    stages = [
        Stage("a", lambda: None, depends_on=("b",)),
        Stage("b", lambda: None, depends_on=("a",)),
    ]
    with pytest.raises(ValueError, match="Circular dependency"):
        resolve_order(stages)


def test_resolve_order_rejects_unknown_dependency():
    stages = [Stage("a", lambda: None, depends_on=("nope",))]
    with pytest.raises(ValueError, match="unknown stage"):
        resolve_order(stages)


def test_real_build_graph_resolves():
    """The updater's own declared stages must form a valid DAG."""
    from updater.updater import Updater

    order = _names(resolve_order(Updater().build_stages(4, False)))
    assert order.index("standings") < order.index("team_ratings")
    assert order.index("team_ratings") < order.index("form")
    assert order.index("form") < order.index("upcoming")
    assert order.index("fixtures") < order.index("upcoming")
    assert order.index("home_advantages") < order.index("upcoming")
