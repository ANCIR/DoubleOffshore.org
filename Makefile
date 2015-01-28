
web:
	python doubleoffshore/manage.py runserver

assets:
	bower install
	# python doubleoffshore/manage.py assets --parse-templates clean
	python doubleoffshore/manage.py assets --parse-templates build

