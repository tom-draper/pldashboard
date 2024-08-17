from .dataframes import Fantasy


class FantasyData:
    def __init__(self):
        self.data = Fantasy()
    
    def is_empty(self):
        return self.data.df is None or self.data.df.empty

    def to_dict(self):
        if self.is_empty():
            raise ValueError(
                "Cannot convert FantasyData instance to dictionary: A DataFrame is empty."
            )
        return self.data.df.to_dict(orient="index")
