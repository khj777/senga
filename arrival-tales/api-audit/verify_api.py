"""Verify the exact public signatures required by Arrival Tales."""
import json
from pathlib import Path

root=Path(__file__).resolve().parent
classes=json.loads((root/'sdk-public-api.json').read_text(encoding='utf-8'))
api={c['class'].split('/')[-1]:{m['name']:m for m in c['methods']} for c in classes}
checks=[]
def check(name,passed):
 checks.append({'check':name,'passed':bool(passed)})
 if not passed: raise AssertionError(name)

check('onDrivingInfo receives DrivingInfo',api['NaviHelperEventListener']['onDrivingInfo']['descriptor']=='(Lai/pleos/playground/navi/data/DrivingInfo;)V')
check('destination returns DrivingState',api['DrivingInfo']['getDestination']['descriptor']=='()Lai/pleos/playground/navi/data/DrivingState;')
check('duration is JVM int',api['DrivingState']['getDuration']['descriptor']=='()I')
for name in ['onDestinationArrived','onReRouteEnded','onRouteCancelled']:
 check(name+' exists',name in api['NaviHelperEventListener'])
check('listener add/remove available',all(x in api['NaviHelper'] for x in ['addListener','removeListener']))
check('getDrivingInfo absent from public helper','getDrivingInfo' not in api['NaviHelper'])
annotations=api['NaviHelper']['getDestinationInfo']['RuntimeInvisibleAnnotations']
check('destination query annotated NAVI_ROUTE',any(a['values'].get('value')=='pleos.car.permission.NAVI_ROUTE' for a in annotations))
text=(root/'driving-state-rendered.txt').read_text(encoding='utf-8')
check('rendered docs define duration as remaining seconds','estimated travel time in seconds from the current location' in text)
(root/'verification-results.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
print(json.dumps(checks,indent=2))
