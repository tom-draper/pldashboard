import plotly
import plotly.express as px
import pandas as pd

class GenDataVis:
    def genFixturesGraph(self, df):
        print(df)
        # fig = px.line(df, x="year", y="lifeExp", color='country')
        # plotly.offline.plot(fig, filename='./data/fixtures.html', auto_open=False)