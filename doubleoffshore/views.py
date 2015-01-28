from flask import render_template, jsonify, request

from doubleoffshore.core import app
from doubleoffshore.data import DataConverter


@app.route('/')
def index():
    return render_template("index.html")


@app.route('/data')
def get_data():
    country = request.args.get('country', 'Nigeria')
    data = DataConverter().by_country(country)
    return jsonify(data)
