import plotly
import plotly.express as px
import pandas as pd

class GenDataVis:
    def genFixturesGraph(self, fixtures, team_ratings):
        print(fixtures)
        print(team_ratings)
        # fig = px.line(df, x="year", y="lifeExp", color='country')
        # plotly.offline.plot(fig, filename='./data/fixtures.html', auto_open=False)