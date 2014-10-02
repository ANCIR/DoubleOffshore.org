

search_terms = (
    # match vessel type
    "tanker for oil",
    "oil products",
    "tanker for chemicals",
    "production",
    "storage",
    "lng",
    
    #flags
    "nigeria",
    "guinea",
    "ivoire",
    "ivory",
    "senegal",
    "guinea",
    "sierra leone",
    "liberia",
    "togo",
 
    "benin",
    "cameroon",
    "gabon",
)

import scrapekit
import copy
import dataset
import datetime
import base

scraper = scrapekit.Scraper('dnv')


@scraper.task
def vessel_details(vesselid, vesseldetails={}):
    url = "https://exchange.dnv.com/Exchange/Main.aspx?EXTool=Vessel&VesselID=%s" % vesselid
    html = scraper.get(url).html()
    # XXX writeme
    return html



@scraper.task
def scrape_index(search_term):

    table = base.db['rigs']

    basic_data = {
        # copypasta for base.Scraper.setup()

        'site': 'DNV',
        'scrape_id': base.nonce(),
        'scrape_date': datetime.datetime.now(),
        }
    # fill in form
    url = 'http://vesselregister.dnvgl.com/vesselregister/api/vessel?term=%s&includeHistoricalNames=true&includeNonClass=true&chunkSize=20' % search_term

    # this is returned in the browser as xml, but to the scraper as json (?)
    # unpack the json
    js = scraper.get(url).json()
    for vessel in js['Vessels']:
        entry = copy.copy(basic_data)
        # The search method means we will get lots of duplicates
        # so use (Site,Name, ImoNo)
        for (k,v) in vessel.items():
            entry[k.lower()] = str(v)
        print('adding one item')
        table.upsert(entry, ['site', 'name', 'imono'])
    return


    
