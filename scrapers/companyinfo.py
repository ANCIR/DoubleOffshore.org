import json
import logging
import urllib.parse, urllib.request
import dataset

import settings
import copy

OCVERSION = 'v0.2'

DB = dataset.connect(settings.DBURI)
TABLE = DB['companies']

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def url2json(url):
    raw = urllib.request.urlopen(url).readall()
    return json.loads(raw.decode('utf-8'))
    
def reconcile_matches(corp):
    url = 'http://opencorporates.com/reconcile?query=%s&api_token=%s' % (
        urllib.parse.quote(corp), settings.OPENCORPORATES_API_KEY)
    return(url2json(url)['result'])

def details_for_corp(corpid):
    url = 'http://api.opencorporates.com/%s%s' % (OCVERSION, corpid)
    fulldata = url2json(url)['results']['company']
    key_data = {
      'country' : fulldata.get('jurisdiction_code', ''),
      'name' : fulldata.get('name', '').title(),
      'source': (fulldata.get('source', {}) or {}).get('url', ''),
      'officers': [x['officer'].get('name', '').title() for x in fulldata.get('officers', [])],
      #'address': fulldata.get('registered_address_in_full', u'') or u'',
      'url': fulldata['opencorporates_url'],
        }
    return(key_data)


def add_corp(searchterm, basedata, maxresults=5):
    """
    Search opencorporates for company named ``searchterm``
    insert each one into company_names table
    """
    matches = reconcile_matches(searchterm)
    logging.info('%s matches for %s' % (len(matches), searchterm))
    DB['company_names'].upsert(
        {'company': searchterm, 'opencorp_matches': len(matches)},
        ['company'])
    for match in matches[:maxresults]:
        details = copy.copy(basedata)
        details.update(details_for_corp(match['id']))
        TABLE.insert(details)

def collate_company_names():
    """Get a set of all unique company names from the Rigs table,
    regardless of what field they appear in)"""
    skippable = ('--', '\xa0', None)
    names = set()
    for rig in DB['rigs'].all():
       for name in ('owner', 'manager', 'operator', 'field_operator'):
            if rig[name] not in skippable:
                names.add(rig[name])
    return names

def collect_all_corpinfo(skip_existing=True):
    for company in sorted(collate_company_names()):
        if skip_existing and DB['company_names'].find_one(company=company):
            logger.debug('skipping %s' % company)
            continue
        add_corp(company, {'search_term': company})
