import requests
import unicodecsv
from StringIO import StringIO
from pprint import pprint

from normality import slugify

from doubleoffshore.core import app, cache

URL = 'https://docs.google.com/spreadsheets/d/%s/export?format=csv&id=%s&gid=%s' # noqa


def cleanup(row):
    data = {}
    for k, v in row.items():
        k = slugify(k, sep='_')
        if isinstance(v, basestring):
            v = v.strip()
            if not len(v):
                continue
        if v is None:
            continue
        data[k] = v
    return data


def get_sheet(sheet):
    url = URL % (app.config.get('DOC_ID'), app.config.get('DOC_ID'), sheet)
    res = requests.get(url)
    data = []
    for row in unicodecsv.DictReader(StringIO(res.content)):
        data.append(cleanup(row))
    return data


class DataConverter(object):

    def __init__(self):
        self.entities = dict()

        self.countries_data = get_sheet(app.config.get('COUNTRIES_SHEET'))
        for country in self.countries_data:
            self.make_entity(country.get('country'), 'rflag', raw=country)
            self.make_entity(country.get('country'), 'cflag', raw=country)

        self.companies_data = get_sheet(app.config.get('COMPANIES_SHEET'))
        for company in self.companies_data:
            flag = company.get('ultimate_owner_jurisdiction') or \
                company.get('based')
            company['flag'] = self.make_entity(flag, 'cflag')
            self.make_entity(company.get('company'), 'company', raw=company)

        self.rigs_data = get_sheet(app.config.get('RIGS_SHEET'))

    def make_entity(self, name, type_, raw={}):
        slug = slugify(name)
        if not slug:
            return
        entity = {'name': name, 'slug': slug, 'type': type_}

        for k, v in raw.items():
            entity['raw_%s' % k] = v
        key = (type_, slug)
        if key in self.entities:
            self.entities[key].update(entity)
        else:
            self.entities[key] = entity
        return slug

    def by_country(self, country):
        country_slug = slugify(country)
        for rig_data in self.rigs_data:
            if slugify(rig_data.get('country')) != country_slug:
                continue
            rig_slug = self.make_entity(rig_data['name'], 'rig', raw=rig_data)
            rig = self.entities[('rig', rig_slug)]

            for role in ['owner', 'operator', 'manager']:
                rig[role] = self.make_entity(rig_data.get(role), 'company')

            rig['flag'] = self.make_entity(rig_data.get('flag'), 'rflag')
            rig['location'] = self.make_entity(rig_data.get('country'),
                                               'location')

        return {'entities': self.entities.values()}


@cache.memoize(84600)
def country_data(country):
    return DataConverter().by_country(country)


if __name__ == '__main__':
    pprint(country_data('Nigeria'))
