
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


DBURI = 'sqlite:///doubleoffshore.sqlite'
USE_TOR = False
if USE_TOR:
    import socks
    import socket
    socks.setdefaultproxy(socks.PROXY_TYPE_SOCKS5, "127.0.0.1", 9050)
    socket.socket = socks.socksocket


db = dataset.connect(DBURI)


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
        cells = row.findall('td')
        for cellno, label in enumerate((
                'name', 'owner', 'operator', 'field_operator',
                'location_field', 'country', 'capacity')):
            data[label] = cells[cellno].text_content()
        data['detail_uri'] = self.site_url + cells[0].find('a').attrib['href']
        logging.debug(data)
        return (data['name'], data)
    
    def crawl_indices(self):
        page_num = 1
        while True:
            page_num += 1
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
            raise StopIteration # XXX debug

    

        
