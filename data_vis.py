import plotly
import plotly.express as px

df = px.data.gapminder().query("continent=='Oceania'")
fig = px.line(df, x="year", y="lifeExp", color='country')
plotly.offline.plot(fig, filename='./data/lifeExp.html', auto_open=False)