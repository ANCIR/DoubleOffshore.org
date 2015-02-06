from doubleoffshore.core import freezer

COUNTRIES = ['nigeria', 'ghana', 'angola']


@freezer.register_generator
def data():
    for country in COUNTRIES:
        yield {'slug': country}
