"""Read public Pleos documentation/artifacts; no credentials or uploads."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
from datetime import datetime, timezone
import hashlib, json
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parent
BASE = 'https://nexus-playground.pleos.ai/repository/maven-releases/ai/pleos/playground/NaviHelper/'
DOC = 'https://document.pleos.ai/en/docs/pleos-only/'
URLS = {
 'maven-metadata.xml': BASE + 'maven-metadata.xml',
 'NaviHelper-3.0.5.pom': BASE + '3.0.5/NaviHelper-3.0.5.pom',
 'NaviHelper-3.0.5.aar': BASE + '3.0.5/NaviHelper-3.0.5.aar',
 'access.html': DOC + 'create-my-project',
 'importing.html': DOC + 'connect-sdk-pleos/NaviHelper/importing-sdk',
 'permissions.html': DOC + 'connect-sdk-pleos/NaviHelper/declaring-permissions',
 'driving-state.html': DOC + 'connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.data/driving-state/entry',
 'listener.html': DOC + 'connect-sdk-pleos/NaviHelper/navi-helper/ai.pleos.playground.navi.helper.listener/navi-helper-event-listener/entry',
 'audio-guide.html': DOC + 'vehicle-app-developer-guide/music-audio-app-developement-guide',
}

class Text(HTMLParser):
 def __init__(self): super().__init__(); self.out=[]; self.skip=0
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'): self.skip+=1
 def handle_endtag(self,tag):
  if tag in ('script','style'): self.skip=max(0,self.skip-1)
 def handle_data(self,data):
  if not self.skip and data.strip(): self.out.append(data.strip())

def fetch(item):
 name,url=item
 result={'name':name,'url':url,'checked_at':datetime.now(timezone.utc).isoformat(),'authentication':'none'}
 try:
  with urlopen(Request(url,headers={'User-Agent':'Pleos-API-Feasibility-Check/1.0'}),timeout=35) as response:
   data=response.read(); result.update(status=response.status,final_url=response.url,bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
  (ROOT/name).write_bytes(data)
  if name.endswith('.html'):
   parser=Text();parser.feed(data.decode('utf-8'));text='\n'.join(parser.out)
   (ROOT/(name+'.txt')).write_text(text,encoding='utf-8');result['text_chars']=len(text)
 except Exception as e: result['error']=str(e)
 return result

if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=5) as pool: results=list(pool.map(fetch,URLS.items()))
 (ROOT/'download-results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf-8')
 print(json.dumps(results,ensure_ascii=True,indent=2))
