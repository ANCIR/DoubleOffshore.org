import os
from flask import render_template, jsonify, g
# from flask import url_for, redirect
from normality import slugify

from doubleoffshore.core import app
from doubleoffshore.data import country_data


def angular_templates():
    partials_dir = os.path.join(app.static_folder, 'templates')
    for (root, dirs, files) in os.walk(partials_dir):
        for file_name in files:
            file_path = os.path.join(root, file_name)
            with open(file_path, 'rb') as fh:
                file_name = file_path[len(partials_dir) + 1:]
                yield (file_name, fh.read().decode('utf-8'))


@app.before_request
def before_request():
    g.templates = angular_templates()


def render_country(country):
    country_slug = slugify(country)
    return render_template("index.html", country=country,
                           country_slug=country_slug)


@app.route('/')
def index():
    return nigeria()


@app.route('/nigeria/index.html')
def nigeria():
    return render_country("Nigeria")


@app.route('/ghana/index.html')
def ghana():
    return render_country("Ghana")


@app.route('/angola/index.html')
def angola():
    return render_country("Angola")


# @app.route('/about')
# def about():
#     return render_template("about.html")


@app.route('/data/<slug>.json')
def data(slug):
    return jsonify(country_data(slug))
