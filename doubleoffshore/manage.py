from flask.ext.script import Manager
from flask.ext.assets import ManageAssets

from doubleoffshore.core import assets
from doubleoffshore.views import app
from doubleoffshore.freeze import freezer

manager = Manager(app)
manager.add_command("assets", ManageAssets(assets))


@manager.command
def freeze():
    """ Freeze the entire site to static HTML. """
    app.config['DEBUG'] = False
    app.config['ASSETS_DEBUG'] = False
    freezer.freeze()


if __name__ == "__main__":
    manager.run()
