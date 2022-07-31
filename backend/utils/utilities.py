
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
        'ARS': 'Arsenal',
        'AVL': 'Aston Villa',
        'BHA': 'Brighton and Hove Albion',
        'BUR': 'Burnley',
        'BRE': 'Brentford',
        'CHE': 'Chelsea',
        'CRY': 'Crystal Palace',
        'EVE': 'Everton',
        'FUL': 'Fulham',
        'LEE': 'Leeds United',
        'LEI': 'Leicester City',
        'LIV': 'Liverpool',
        'MCI': 'Manchester City',
        'MUN': 'Manchester United',
        'NOR': 'Norwich City',
        'NEW': 'Newcastle United',
        'SHU': 'Sheffield United',
        'SOU': 'Southampton',
        'TOT': 'Tottenham Hotspur',
        'WAT': 'Watford',
        'WBA': 'West Bromwich Albion',
        'WHU': 'West Ham United',
        'WOL': 'Wolverhampton Wanderers',
        'NOT': 'Nottingham Forest',
        
    })

    def convert_team_name_or_initials(self, team_name: str) -> str:
        if (team_name in self.names_and_initials or 
            team_name in self.names_and_initials.values()):
            return self.names_and_initials[team_name]
        elif len(team_name) == 3:
            # Cannot convert initials to a full team name if not in dict
            raise KeyError("Team name corresponding to input initials does not exist")
        else:
            # If no match found for a given full team name, shorten name to
            # create initials
            return team_name[:3].upper()

    @staticmethod
    def extract_int_score(score: str) -> tuple[int, int]:
        home, _, away = score.split(' ')
        return int(home), int(away)

    @staticmethod
    def extract_str_score(score: str) -> tuple[str, str]:
        home, _, away = score.split(' ')
        return home, away
    
    @staticmethod
    def extract_int_score_from_scoreline(score: str) -> tuple[int, int]:
        _, home, _, away, _ = score.split(' ')
        return int(home), int(away)
    
    @staticmethod
    def extract_str_score_from_scoreline(score: str) -> tuple[str, str]:
        _, home, _, away, _ = score.split(' ')
        return home, away
    
    @staticmethod
    def identical_fixtures(scoreline1: str, scoreline2: str) -> bool:
        identical = False
        if scoreline1 is not None and scoreline2 is not None:
            home_p, _, _, _, away_p = scoreline1.split(' ')
            home_s, _, _, _, away_s = scoreline2.split(' ')
            identical = (home_p == home_s) and (away_p == away_s)
        return identical

    @staticmethod
    def identical_result(pred_home_goals, pred_away_goals, act_home_goals, act_away_goals):
        return (pred_home_goals == pred_away_goals and act_home_goals == act_away_goals) or \
               (pred_home_goals > pred_away_goals and act_home_goals > act_away_goals) or \
               (pred_home_goals < pred_away_goals and act_home_goals < act_away_goals)

    def format_scoreline_str_from_str(self, team_name: str, opp_team_name: str, 
                                      score: str, at_home: bool) -> str:
        team_name_initials = self.convert_team_name_or_initials(team_name)
        opp_team_name_initials = self.convert_team_name_or_initials(opp_team_name)

        if at_home:
            scoreline = f'{team_name_initials} {score} {opp_team_name_initials}'
        else:
            scoreline = f'{opp_team_name_initials} {score} {team_name_initials}'
        return scoreline

    def format_scoreline_str(self, team_name: str, opp_team_name: str, scored: int, 
                             conceded: int, at_home: bool) -> str:
        team_name_initials = self.convert_team_name_or_initials(team_name)
        opp_team_name_initials = self.convert_team_name_or_initials(opp_team_name)
        
        # Construct prediction string for display...
        if at_home:
            scoreline = f'{team_name_initials} {scored} - {conceded} {opp_team_name_initials}'
        else:
            scoreline = f'{opp_team_name_initials} {conceded} - {scored} {team_name_initials}'
        return scoreline
    
    def clean_full_team_name(self, full_team_name: str) -> str:
        return full_team_name.replace(' FC', '').replace('AFC ', '').replace('&', '')