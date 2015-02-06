import logging
from flask import Flask
from flask.ext.assets import Environment
from flask.ext.cache import Cache
from flask_frozen import Freezer

from doubleoffshore import default_settings

logging.basicConfig(level=logging.DEBUG)

# specific loggers
# logging.getLogger('requests').setLevel(logging.WARNING)
# logging.getLogger('urllib3').setLevel(logging.WARNING)

app = Flask(__name__)
app.config.from_object(default_settings)
assets = Environment(app)
cache = Cache(app)
freezer = Freezer(app)


if not app.debug:
    assets.auto_build = False
    assets.manifest = 'file'
