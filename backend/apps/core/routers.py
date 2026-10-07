from rest_framework.routers import SimpleRouter


class Router(SimpleRouter):
    """SimpleRouter whose routes accept an optional trailing slash."""

    def __init__(self):
        super().__init__()
        # DRF coerces any truthy trailing_slash to "/"; set the optional-slash regex explicitly.
        self.trailing_slash = "/?"
