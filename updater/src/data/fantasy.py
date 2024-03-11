from .dataframes import Fantasy


class FantasyData:
    def __init__(self):
        self.data = Fantasy()

    def to_dict(self):
        return self.data.df.to_dict()
