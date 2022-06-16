
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

    # def __init__(self):
    #     self.team_colours = self._read_team_colours()
    
    # def _read_team_colours(self):
    #     team_colours = {}
    #     with open('./static/style.css', 'r') as f:
    #         match = re.search(r':root\s*{[^\}]*}', f.read()).group(0)
    #         css_vars = re.findall(r'\-\-[^;]*;', match)
    #         for css_var in css_vars:
    #             # Get team name from css variable
    #             team = re.search(r'\-\-([^:]*):', css_var).group(1)
    #             team = team.replace('-', ' ').title() + ' FC'
    #             # Get team colour from css variable
    #             colour = re.search(r':\s*([^;]*);', css_var).group(1)
    #             # Insert commas if missing
    #             if ',' not in colour:
    #                 colour = colour.replace(' ', ', ')
    #             team_colours[team] = colour
    #     return team_colours

    def convert_team_name_or_initials(self, team_name: str) -> str:
        if team_name in self.names_and_initials.keys():
            return self.names_and_initials[team_name]
        elif len(team_name) == 3:
            # If no match found and input is initials
            raise KeyError("Team name does not exist")
        else:
            # If no match found and input is team name, shorten team name
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

    @staticmethod
    def snake_case(s: str) -> str:
        if len(s) == 0 or s.islower():
            return s
        
        if s.isupper():
            return s.lower()

        if s[0].isupper():
            s = s[0].lower() + s[1:]
        
        s = s.replace(' ', '_')
        
        # Convert capitals to underscore prefix + lowercase  
        s = list(s)
        for i in range(len(s)-1, 0, -1):
            if (s[i].isupper() and s[i] != '_' and i != 0 and s[i-1].islower() and not s[i-1].isdigit()) or (i != 0 and s[i-1] != '_' and not s[i-1].isdigit() and s[i].isdigit()):
                s[i] = '_' + s[i].lower()
        s = ''.join(s).lower()
            
        return s

    @staticmethod
    def camel_case(s: str) -> str:
        if ' FC' in s:
            return s
        return s[0].lower() + s[1:]
