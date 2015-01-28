import platform

if platform.node() == 'sw': # dan's laptop
    DBURI = 'postgresql://dan:offshore@localhost/doubleoffshore'
else:
    DBURI = 'postgresql://doubleoffshore:Ezeech2o@localhost/doubleoffshore'

USE_TOR = False 

OPENCORPORATES_API_KEY = 'Pt1BcqtBxOelxgxxx96x'
