
"""
data structure

site
scrape_id # unique id for the scrape [Q: over multiple sources?]
scrape_date

source_uri # may end up being not-entirely-realistic

cached downloaded pages:
 BASEDIR/site/YYYYMMDD/scrape_nonce/escaped_uri.html

"""

import copy
import dataset
import datetime
import logging
import lxml.html
import random
import string
import urllib.request

from lxml.cssselect import CSSSelector

import settings

if settings.USE_TOR:
    import socks
    import socket
    socks.setdefaultproxy(socks.PROXY_TYPE_SOCKS5, "127.0.0.1", 9050)
    socket.socket = socks.socksocket


db = dataset.connect(settings.DBURI)


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def nonce(chars=8):
    return ''.join(random.choice(string.ascii_uppercase + string.ascii_lowercase) for x in range(chars))

class Scraper:
    table = db['rigs']

    def run(self):
        self.setup()
        for (rigID, data) in self.crawl_indices():
            self.add_item(rigID, data)
            

    def crawl_indices(self):
        # should 
        # yield a tuple (_id, data), where:
        # _id uniquely identifies the item within this site (e.g. ship name)
        #   this allows skipping when we only want to pick up new items
        # data contains everything else that we found and don't want to repeat
        # XXX: need to deal with the possibility of duplicates here, at least in warning
        # unique should be (site, scrape_id, rig_id)
        logger.debug('reading indices')

        for item in []:
            yield ('NA', {})
    
    def add_item(self, rigID, data):
        logger.debug('adding item')
        item = copy.copy(self.basedata)
        item['rig_id'] = rigID
        item.update(data)
        self.table.insert(item)

    def setup(self):
        self.basedata = {
            'site': self.site,
            'scrape_id': nonce(),
            'scrape_date': datetime.datetime.now(),
            }

class FPSO(Scraper):

    site = 'FPSO'
    site_url = 'http://fpso.com'
        
    def unpack_rigrow(self, row, data):
        """Get the data from one row of a FPSO table"""
        cells = row.findall('td')
        for cellno, label in enumerate((
                'name', 'owner', 'operator', 'field_operator',
                'location_field', 'country', 'capacity')):
            data[label] = cells[cellno].text_content()
        data['detail_uri'] = self.site_url + cells[0].find('a').attrib['href']
        logger.debug(data)
        return (data['name'], data)
        
    def crawl_indices(self):
        page_num = 1
        while True:
            url = 'http://fpso.com/fpso/?page=%s' % page_num
            page = urllib.request.urlopen(url)
            tree = lxml.html.parse(page)
            rigrows = CSSSelector('tr.odd,tr.even')(tree)
            if len(rigrows) == 0:
                raise StopIteration
                
            basedata = copy.copy(self.basedata)
            basedata['source_uri'] = url
            
            for row in rigrows:
                yield self.unpack_rigrow(row, basedata)

            page_num += 1             
            if page_num > 30:
                logger.warn("""
                   many more pages than expected on FPSO
                   aborting from fear of infinite loop""")
                raise StopIteration


class RigzoneBasic(Scraper):
    """
    Rigzone -- just getting the rig names, but not going into the detail pages
    """

    site = 'Rigzone -- basic'
    site_url = 'http://www.rigzone.com'

    def unpack_rigrow(self, row, data):
        """Get the data from one row of a FPSO table"""
        cells = row.findall('td')
        for cellno, label in enumerate((
                'name', 'manager', 'rig_type', 'rated_water_depth', 'drilling_depth')):
            data[label] = cells[cellno].text_content().strip()
        data['detail_uri'] = self.site_url + cells[0].find('a').attrib['href']
        logger.debug(data)
        return (data['name'], data)

    
    def crawl_indices(self):
        page_num = 1
        while True:
            url = 'http://www.rigzone.com/data/results.asp?P=%s&Region_ID=10' % page_num
            page = urllib.request.urlopen(url)
            tree = lxml.html.parse(page)
            sel = CSSSelector('tr[style*="height:20px;"]')
            rigrows = sel(tree)
            if len(rigrows) == 0:
                raise StopIteration

            basedata = copy.copy(self.basedata)
            basedata['source_uri'] = url
            
            for row in rigrows:
                yield self.unpack_rigrow(row, basedata)


            page_num += 1
            if page_num > 8:
                logger.warn("""
                   many more pages than expected on Rigdata
                   aborting from fear of infinite loop""")
                raise StopIteration
           
class RigzoneFull(RigzoneBasic):
    
    def find_value(self, tree, label):
        path = './/strong[contains(text(), "%s")]' % label
        label_node = tree.xpath(path)[0]
        value = label_node.getparent().getnext().text_content().strip()
        return value
    
    def scrape_detail_page(self, data):
        logger.debug('making request for %s' % data['detail_uri'])
        page = urllib.request.urlopen(data['detail_uri'])
        logger.debug('opened page')
        tree = lxml.html.parse(page)
        
        # ignore labels we know from the index page:
        # name, manager, rig type, rated water depth, drilling depth
        labels = {
            # overview
            'Rig Owner:': 'owner',
            'Competitive Rig:': 'competitive_rig',            
            ' Type:': 'ship_type', # may be rig type, drillship type,...
            'Rig Design': 'rig_design',
            
            # contract
            'Operating Status:': 'operating_status',
            'Operator:': 'operator',
            
            # location
            'Region:': 'region',
            'Country:': 'country',
            'Current Water Depth:': 'current_water_depth',
        }
        for l in (
                'Classification:', 'Rig Design:', 'Shipyard:', 'Delivery Year:',
                'Flag:', 'Derrick:', 'Drawworks:', 'Mud Pumps:', 'Top Drive:',
                'Rotary Table:'
                ):
            labels[l] = l.strip(':').lower()
        for (searchterm, dbname) in labels.items():
            data[dbname] = self.find_value(tree, searchterm)
        
        logger.debug(data)
        return data

    def add_item(self, rigID, data):
        logger.debug('adding item')
        item = copy.copy(self.basedata)
        item['rig_id'] = rigID
        item.update(data)
        data = self.scrape_detail_page(data)
        self.table.insert(item)

def run_all_scrapers():
    scrapers = [FPSO,RigzoneFull]
    for scraper_cl in scrapers:
        instance = scraper_cl()
        instance.run()
        
if __name__ == '__main__':
    run_all_scrapers()
