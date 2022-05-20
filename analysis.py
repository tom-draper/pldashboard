from updater import Updater
from utilities import Utilities

util = Utilities()


class Analysis:
    def __init__(self, season=2021):
        self.updater = Updater(season)
        self.updater.update_all(
            request_new=False,
            team_name=None, 
            display_tables=False, 
            display_graphs=False,
            update_db=False
        )
        
    def _result(self, match):
        at_home = match['AtHome']
        h, a = util.extract_int_score(match['Score'])
        if at_home:
            if h > a:
                return 1
            elif h < a:
                return -1
            else:
                return 0
        else:
            if h > a:
                return -1
            elif h < a:
                return 1
            else:
                return 0

    def _last_played_match(self, row, i):
        j = i-1
        while j > 1 and row[j]['Score'] == None:
            j -= 1
        if j == 0:
            return None, -1
        return row[j], j
    
    def last_5_games(self, row, i):
        try:
            result1 = self._result(row[i-1])
            result2 = self._result(row[i-2])
            result3 = self._result(row[i-3])
            result4 = self._result(row[i-4])
            result5 = self._result(row[i-5])
            return round((result4))
        except:
            return None
            

    def form_predictions(self):
        total = 0
        correct = 0
        for _, row in self.updater.data.fixtures.df.iterrows():
            for i in range(2, 39):
                match = row[i]
                if match['Score']:
                    result = self._result(match)
                
                prev_results = self.last_5_games(row, i)
                if prev_results is not None:
                    if result == prev_results:
                        correct += 1
                    total += 1
        
        print(correct/total)


if __name__ == "__main__":
    # Update all dataframes
    a = Analysis()
    a.form_predictions()