
all: clear assets freeze upload

web:
	python doubleoffshore/manage.py runserver

assets:
	bower install
	# python doubleoffshore/manage.py assets --parse-templates clean
	python doubleoffshore/manage.py assets --parse-templates build

clear:
	rm -rf build/*

freeze:
	python doubleoffshore/manage.py freeze

upload:
	aws s3 sync --cache-control 84600 --acl public-read --exclude 'static/.webassets-cache/*' --exclude 'static/vendor/*' --delete build/ s3://doubleoffshore.investigativecenters.org/
