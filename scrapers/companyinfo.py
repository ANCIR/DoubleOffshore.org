import json
import urllib.parse, urllib.request

OCVERSION = 'v0.2'
API_KEY = 'Pt1BcqtBxOelxgxxx96x'

def url2json(url):
    raw = urllib.request.urlopen(url).readall()
    return json.loads(raw.decode('utf-8'))
    
def reconcile_matches(corp):
    url = 'http://opencorporates.com/reconcile?query=%s' % (
        urllib.parse.quote(corp))
    return(url2json(url)['results'])

def details_for_corp(corpid):
    url = 'http://api.opencorporates.com/%s%s' % (OCVERSION, corpid)
    return url2json(url)['results']['company']

def corp_keydata(fulldata):
    kd = {
      'country' : fulldata.get('jurisdiction_code', ''),
      'name' : fulldata.get('name', '').title(),
      'source': (fulldata.get('source', {}) or {}).get('url', ''),
      'officers': [x['officer'].get('name', '').title() for x in fulldata.get('officers', [])],
      'address': fulldata.get('registered_address_in_full', u'') or u'',
      'url': fulldata['opencorporates_url'],
            }
    return(kd)

"""
    def search(self, query, offset=0, limit=10):
        matches = reconcile_matches(query)
        results = []
        for match in matches[offset:offset+limit]:
            corp = match['id']
            details = details_for_corp(corp)
            keydata = corp_keydata(details)
            results.append(keydata)
        return metasearch.SearchResult(
            query, results, resultcount=len(matches))




"""

