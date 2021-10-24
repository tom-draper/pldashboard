
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
        'BRE': 'Brentford FC',
        'CHE': 'Chelsea FC',
        'CRY': 'Crystal Palace FC',
        'EVE': 'Everton FC',
        'FUL': 'Fulham FC',
        'LEE': 'Leeds United FC',
        'LEI': 'Leicester City FC',
        'LIV': 'Liverpool FC',
        'MCI': 'Manchester City FC',
        'MUN': 'Manchester United FC',
        'NOR': 'Norwich City FC',
        'NEW': 'Newcastle United FC',
        'SHU': 'Sheffield United FC',
        'SOU': 'Southampton FC',
        'TOT': 'Tottenham Hotspur FC',
        'WAT': 'Watford FC',
        'WBA': 'West Bromwich Albion FC',
        'WHU': 'West Ham United FC',
        'WOL': 'Wolverhampton Wanderers FC',
    })

    team_colours = {
        'Sheffield United FC': 'rgb(238, 39, 55)',
        'Leeds United FC': 'rgb(255, 205, 0)',
        'Aston Villa FC': 'rgb(103, 14, 54)',
        'Fulham FC': 'rgb(204, 0, 0)',
        'Wolverhampton Wanderers FC': 'rgb(253, 185, 19)',
        'West Ham United FC': 'rgb(122, 38, 58)',
        'West Bromwich Albion FC': 'rgb(18, 47, 103)',
        'Tottenham Hotspur FC': 'rgb(19, 34, 87)',
        'Southampton FC': 'rgb(215, 25, 32)',
        'Newcastle United FC': 'rgb(45, 41, 38)',
        'Manchester United FC':  'rgb(218, 41, 28)',
        'Manchester City FC': 'rgb(108, 171, 221)',
        'Liverpool FC': 'rgb(200, 16, 46)',
        'Leicester City FC': 'rgb(0, 83, 160)',
        'Everton FC': 'rgb(39, 68, 136)',
        'Crystal Palace FC': ' rgb(27, 69, 143)',
        'Chelsea FC': 'rgb(3, 70, 148)',
        'Burnley FC': 'rgb(108, 29, 69)',
        'Brighton and Hove Albion FC': 'rgb(0, 87, 184)',
        'Arsenal FC': 'rgb(239, 1, 7)',
        'Norwich City FC': 'rgb(0, 166, 80)',
        'Cardiff City FC': 'rgb(0, 112, 181)',
        'Watford FC': 'rgb(237, 33, 39)',
        'Swansea City FC': 'rgb(18, 18, 18)',
        'Stoke City FC': 'rgb(224, 58, 62)',
        'Huddersfield FC': 'rgb(14, 99, 173)',
        'Bournemouth FC': 'rgb(218, 41, 28)',
        'Brentford FC': 'rgb(227, 6, 19)'
    }

    def convert_team_name_or_initials(self, team_name: str) -> str:
        if team_name in self.names_and_initials.keys():
            return self.names_and_initials[team_name]
        elif len(team_name) == 3:
            # If no match found and input is initials
            raise KeyError("Team name does not exist")
        else:
            # If no match found and input is team name, shorten team name
            return team_name[:3].upper()

    def extract_int_score(self, score: str) -> tuple[int, int]:
        home, _, away = score.split(' ')
        return int(home), int(away)

    def extract_str_score(self, score: str) -> tuple[str, str]:
        home, _, away = score.split(' ')
        return home, away
    
    def extract_int_score_from_scoreline(self, score: str) -> tuple[int, int]:
        _, home, _, away, _ = score.split(' ')
        return int(home), int(away)
    
    def extract_str_score_from_scoreline(self, score: str) -> tuple[str, str]:
        _, home, _, away, _ = score.split(' ')
        return home, away
    
    def identical_fixtures(self, scoreline1: str, scoreline2: str) -> bool:
        if scoreline1 is not None and scoreline2 is not None:
            home_p, _, _, _, away_p = scoreline1.split(' ')
            home_s, _, _, _, away_s = scoreline2.split(' ')
            return (home_p == home_s) and (away_p == away_s)
        return False

    def identical_result(self, pred_home_goals, pred_away_goals, act_home_goals, act_away_goals):
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