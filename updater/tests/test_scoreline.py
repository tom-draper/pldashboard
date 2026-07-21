"""Behaviour of the Scoreline value object.

Scorelines are used both as data (a predicted result) and as dict keys whose
equality is deliberately switchable: with teams shown, two scorelines match
only if the teams line up too; with teams hidden, they collapse by goals alone
so results from different fixtures can be pooled. The prediction code leans on
both modes, so they are pinned here.
"""

from updater.predictions.scoreline import Scoreline


class TestConstruction:
    def test_missing_teams_become_blank(self):
        s = Scoreline(0, 0)
        assert s.home_team == Scoreline.BLANK_TEAM
        assert s.away_team == Scoreline.BLANK_TEAM

    def test_goals_and_teams_are_stored(self):
        s = Scoreline(2, 1, "Arsenal", "Chelsea")
        assert (s.home_goals, s.away_goals) == (2, 1)
        assert (s.home_team, s.away_team) == ("Arsenal", "Chelsea")


class TestReverse:
    def test_swaps_teams_and_goals_together(self):
        s = Scoreline(2, 1, "Arsenal", "Chelsea")
        s.reverse()
        assert (s.home_team, s.away_team) == ("Chelsea", "Arsenal")
        assert (s.home_goals, s.away_goals) == (1, 2)


class TestToDict:
    def test_shape(self):
        s = Scoreline(2, 1, "Arsenal", "Chelsea")
        assert s.to_dict() == {
            "homeTeam": "Arsenal",
            "awayTeam": "Chelsea",
            "homeGoals": 2,
            "awayGoals": 1,
        }


class TestEqualityWithTeamsShown:
    def test_equal_only_when_teams_and_goals_match(self):
        a = Scoreline(2, 1, "Arsenal", "Chelsea")
        same = Scoreline(2, 1, "Arsenal", "Chelsea")
        assert a == same
        assert hash(a) == hash(same)

    def test_same_goals_different_teams_are_distinct(self):
        a = Scoreline(2, 1, "Arsenal", "Chelsea")
        b = Scoreline(2, 1, "Tottenham", "Everton")
        assert a != b

    def test_reversed_fixture_is_not_equal(self):
        a = Scoreline(2, 1, "Arsenal", "Chelsea")
        b = Scoreline(1, 2, "Chelsea", "Arsenal")
        assert a != b


class TestEqualityWithTeamsHidden:
    def test_collapses_by_goals_only(self):
        a = Scoreline(2, 1, "Arsenal", "Chelsea", show_teams=False)
        b = Scoreline(2, 1, "Tottenham", "Everton", show_teams=False)
        assert a == b
        assert hash(a) == hash(b)

    def test_pools_as_a_single_dict_key(self):
        a = Scoreline(2, 1, "Arsenal", "Chelsea", show_teams=False)
        b = Scoreline(2, 1, "Tottenham", "Everton", show_teams=False)
        freq = {a: 3}
        assert b in freq

    def test_different_goals_stay_distinct(self):
        a = Scoreline(2, 1, "Arsenal", "Chelsea", show_teams=False)
        b = Scoreline(1, 1, "Arsenal", "Chelsea", show_teams=False)
        assert a != b


class TestStr:
    def test_teams_hidden_shows_goals_only(self):
        assert str(Scoreline(2, 1, "Arsenal", "Chelsea", show_teams=False)) == "2 - 1"

    def test_blank_teams_are_rendered_verbatim(self):
        assert str(Scoreline(2, 1)) == "___ 2 - 1 ___"
