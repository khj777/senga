"""Inspect public JVM signatures in downloaded SDK archives without executing code."""
from pathlib import Path
import zipfile, io, struct, json

ROOT=Path(__file__).resolve().parent

class Reader:
 def __init__(self,data): self.data=data;self.pos=0
 def take(self,n): out=self.data[self.pos:self.pos+n];self.pos+=n;return out
 def u1(self): return int.from_bytes(self.take(1),'big')
 def u2(self): return int.from_bytes(self.take(2),'big')
 def u4(self): return int.from_bytes(self.take(4),'big')

def inspect_class(data):
 r=Reader(data)
 assert r.u4()==0xcafebabe
 minor,major=r.u2(),r.u2();cp=[None]*r.u2();i=1
 while i<len(cp):
  tag=r.u1()
  if tag==1: cp[i]=r.take(r.u2()).decode('utf-8',errors='replace')
  elif tag in (3,4): cp[i]=r.u4()
  elif tag in (5,6): r.take(8);i+=1
  elif tag in (7,8,16,19,20): cp[i]=(tag,r.u2())
  elif tag in (9,10,11,12,17,18): cp[i]=(tag,r.u2(),r.u2())
  elif tag==15: cp[i]=(tag,r.u1(),r.u2())
  else: raise ValueError(tag)
  i+=1
 def resolve(index):
  value=cp[index]
  return resolve(value[1]) if isinstance(value,tuple) and value[0] in (7,8,16) else value
 def annotation(reader):
  name=resolve(reader.u2());pairs={}
  for _ in range(reader.u2()):
   key=resolve(reader.u2());pairs[key]=element(reader)
  return {'type':name,'values':pairs}
 def element(reader):
  tag=chr(reader.u1())
  if tag in 'BCDFIJSZsc': return resolve(reader.u2())
  if tag=='e': return [resolve(reader.u2()),resolve(reader.u2())]
  if tag=='@': return annotation(reader)
  if tag=='[': return [element(reader) for _ in range(reader.u2())]
  raise ValueError(tag)
 def attrs():
  out={}
  for _ in range(r.u2()):
   name=resolve(r.u2());data=r.take(r.u4())
   if name in ('RuntimeVisibleAnnotations','RuntimeInvisibleAnnotations'):
    ar=Reader(data);out[name]=[annotation(ar) for _ in range(ar.u2())]
  return out
 flags=r.u2();name=resolve(r.u2());superclass=resolve(r.u2())
 interfaces=[resolve(r.u2()) for _ in range(r.u2())]
 def members():
  out=[]
  for _ in range(r.u2()):
   access,name,desc=r.u2(),resolve(r.u2()),resolve(r.u2());annotations=attrs()
   if access&1: out.append({'name':name,'descriptor':desc,'flags':access,**annotations})
  return out
 fields=members();methods=members()
 return {'class':name,'java_major':major,'super':superclass,'interfaces':interfaces,'fields':fields,'methods':methods,'relevant_strings':[s for s in cp if isinstance(s,str) and ('permission.' in s or 'intent.action' in s)]}

def main():
 output=[]
 wanted={'NaviHelper.class','NaviHelperEventListener.class','DrivingInfo.class','DrivingState.class','DestinationArrivedInfo.class'}
 for archive in sorted(ROOT.glob('*.aar')):
  with zipfile.ZipFile(archive) as aar:
   (ROOT/(archive.stem+'-manifest.xml')).write_bytes(aar.read('AndroidManifest.xml'))
   if 'META-INF/com/android/build/gradle/aar-metadata.properties' in aar.namelist():
    (ROOT/(archive.stem+'-aar-metadata.txt')).write_bytes(aar.read('META-INF/com/android/build/gradle/aar-metadata.properties'))
   with zipfile.ZipFile(io.BytesIO(aar.read('classes.jar'))) as jar:
    for name in jar.namelist():
     if name.rsplit('/',1)[-1] in wanted:
      result=inspect_class(jar.read(name));result['artifact']=archive.name;output.append(result)
 (ROOT/'sdk-public-api.json').write_text(json.dumps(output,ensure_ascii=True,indent=2),encoding='utf-8')
 for cls in output:
  print(cls['class'])
  for method in cls['methods']:
   if method['name'] in ('<init>','getInstance','initialize','release','setNaviHelperEventListener','addNaviHelperEventListener','removeNaviHelperEventListener','getDrivingInfo','onDrivingInfo','getDestination','getDuration','onDestinationArrived','onReRouteEnded','onRouteCancelled','onConnected','onDisconnected'):
    print(json.dumps(method,ensure_ascii=True))
  print('PUBLIC_METHODS',', '.join(x['name'] for x in cls['methods']))

if __name__=='__main__': main()
