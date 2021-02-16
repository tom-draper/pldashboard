from data import Data
from graph_data import GraphData

class DataRefresh:
    
    def __init__(self, season):
        self.data = Data(season)
        self.graph = GraphData()

    def updateAll(self, no_seasons, team_name=None, display_tables=False, display_graphs=False, request_new=True):
        """Update all graph files at once.

        Args:
            no_seasons (int): number of seasons of data to include.
        """
        self.data.updateAll(no_seasons, 
                            display_tables=display_tables, 
                            request_new=request_new)
        
        # If new data has been requested, build new graph files using dataframes
        if request_new:
            self.graph.updateAll(self.data.fixtures, 
                                 self.data.team_ratings, 
                                 self.data.home_advantages, 
                                 self.data.form, 
                                 self.data.position_over_time, 
                                 display_graphs=display_graphs, team_name=team_name)

if __name__ == "__main__":
    r = DataRefresh(2020)
    r.updateAll(3, team_name='Liverpool FC', display_tables=True, display_graphs=False, request_new=False)

