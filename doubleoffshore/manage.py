from flask.ext.script import Manager
from flask.ext.assets import ManageAssets

from doubleoffshore.core import assets
from doubleoffshore.views import app

manager = Manager(app)
manager.add_command("assets", ManageAssets(assets))


if __name__ == "__main__":
    manager.run()
