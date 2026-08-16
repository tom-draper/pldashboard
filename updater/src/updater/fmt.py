from collections.abc import Hashable


class TwoWayDict(dict):
    def __init__(self, dict: dict[Hashable, Hashable]):
        super().__init__()
        for key, value in dict.items():
            self.__setitem__(key, value)

    def __setitem__(self, key: Hashable, value: Hashable):
        # Remove any previous connections with these values
        if key in self:
            del self[key]
        if value in self:
            del self[value]
        dict.__setitem__(self, key, value)
        dict.__setitem__(self, value, key)

    def __delitem__(self, key: Hashable):
        dict.__delitem__(self, self[key])
        dict.__delitem__(self, key)

    def __len__(self):
        """Returns the number of connections"""
        return dict.__len__(self) // 2


names_and_initials = TwoWayDict(
    {
        "ARS": "Arsenal",
        "AVL": "Aston Villa",
        "BHA": "Brighton and Hove Albion",
        "BUR": "Burnley",
        "BRE": "Brentford",
        "BOU": "Bournemouth",
        "CHE": "Chelsea",
        "CRY": "Crystal Palace",
        "EVE": "Everton",
        "FUL": "Fulham",
        "LEE": "Leeds United",
        "LEI": "Leicester City",
        "LIV": "Liverpool",
        "LUT": "Luton Town",
        "MCI": "Manchester City",
        "MUN": "Manchester United",
        "NOR": "Norwich City",
        "NEW": "Newcastle United",
        "SHU": "Sheffield United",
        "SOU": "Southampton",
        "TOT": "Tottenham Hotspur",
        "WAT": "Watford",
        "WBA": "West Bromwich Albion",
        "WHU": "West Ham United",
        "WOL": "Wolverhampton Wanderers",
        "NOT": "Nottingham Forest",
    }
)


def convert_team_name_or_initials(team: str):
    """Converts team name to three-letter initials, or converts three-letter
    initials to a team name.

    Args:
        team (str): Team name or three-letter team initials.

    Raises:
        KeyError: Team name or team initials are invalid.

    Returns:
        str: Three-letter team initials or team name.
    """
    if team in names_and_initials:
        return names_and_initials[team]
    elif team is None or len(team) == 3:
        # Cannot convert initials to a full team name if not in dict
        raise KeyError(
            f"Team name {team} corresponding to input initials does not exist"
        )
    # If no match found for a given full team name, shorten name to
    # create initials
    return team[:3].upper()


def clean_full_team_name(full_team_name: str):
    """Remove FC, AFC postfixes and replace ampersand for 'and'."""
    return (
        full_team_name.replace(" FC", "")
        .replace("AFC ", "")
        .replace(" AFC", "")
        .replace("&", "and")
    )
