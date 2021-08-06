
class TwoWayDict(dict):
    def __init__(self, dict):
        super().__init__()
        for key, value in dict.items():
            self.__setitem__(key, value)
    
    def __setitem__(self, key, value):
        # Remove any previous connections with these values
        if key in self:
            del self[key]
        if value in self:
            del self[value]
        dict.__setitem__(self, key, value)
        dict.__setitem__(self, value, key)

    def __delitem__(self, key):
        dict.__delitem__(self, self[key])
        dict.__delitem__(self, key)

    def __len__(self):
        """Returns the number of connections"""
        return dict.__len__(self) // 2

class Utilities:
    names_and_initials = TwoWayDict({
            'ARS': 'Arsenal FC',
            'AVL': 'Aston Villa FC',
            'BHA': 'Brighton and Hove Albion FC',
            'BUR': 'Burnley FC',
            'CHE': 'Chelsea FC',
            'CRY': 'Crystal Palace FC',
            'EVE': 'Everton FC',
            'FUL': 'Fulham FC',
            'LEE': 'Leeds United FC',
            'LEI': 'Leicester City FC',
            'LIV': 'Liverpool FC',
            'MCI': 'Manchester City FC',
            'MUN': 'Manchester United FC',
            'NEW': 'Newcastle United FC',
            'SHU': 'Sheffield United FC',
            'SOU': 'Southampton FC',
            'TOT': 'Tottenham Hotspur FC',
            'WBA': 'West Bromwich Albion FC',
            'WHU': 'West Ham United FC',
            'WOL': 'Wolverhampton Wanderers FC',
    })
    
    def convert_team_name_or_initials(self, team_name: str) -> str:
        if team_name in self.names_and_initials.keys():
            return self.names_and_initials[team_name]
        elif len(team_name) == 3:
            # If no match found and input is initials
            raise KeyError("Team name does not exist")
        else:
            # If no match found and input is team name, shorten team name
            return team_name[:3].upper()