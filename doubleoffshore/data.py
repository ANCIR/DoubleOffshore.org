import requests
import unicodecsv
from StringIO import StringIO
from pprint import pprint

from normality import slugify

from doubleoffshore.core import app

URL = 'https://docs.google.com/spreadsheets/d/%s/export?format=csv&id=%s&gid=%s' # noqa


def cleanup(row):
    data = {}
    for k, v in row.items():
        k = slugify(k, sep='_')
        if isinstance(v, basestring):
            v = v.strip()
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
        self.entities = {}
        self.rigs_data = get_sheet(app.config.get('RIGS_SHEET'))
        self.companies_data = get_sheet(app.config.get('COMPANIES_SHEET'))

    def make_entity(self, name, type_, raw={}):
        entity = {'name': name, 'slug': slugify(name), 'type': type_}
        for k, v in raw.items():
            entity['raw_%s' % k] = v
        self.entities[(type_, entity['slug'])] = entity
        return entity

    def get_company(self, name):
        slug = slugify(name)
        if not slug:
            return None
        k = ('company', slug)
        if k not in self.entities:
            self.make_entity(name, 'company')
            # TODO process company flags
        return self.entities[k]

    def by_country(self, country):
        for rig_data in self.rigs_data:
            rig = self.make_entity(rig_data['name'], 'rig', raw=rig_data)
            
            for role in ['owner', 'operator', 'manager']:
                rig[role] = self.get_company(rig_data.get(role))

        return {
            #'rigs': rigs,
            'entities': self.entities
        }

if __name__ == '__main__':
    data = DataConverter().by_country('Nigeria')
    pprint(data)
