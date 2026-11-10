"""Verify vendored browser artifacts; optionally query npm's advisory API."""
import argparse,hashlib,json,pathlib,urllib.request
p=argparse.ArgumentParser();p.add_argument('--advisories',action='store_true');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]/'public_html/assets/vendor';manifest=json.loads((root/'versions.json').read_text())
for item in manifest:
 actual=hashlib.sha256((root/item['file']).read_bytes()).hexdigest()
 if actual!=item['sha256']:raise SystemExit('Hash mismatch: '+item['file'])
 print('PASS: hash '+item['package']+' '+item['version'])
if args.advisories:
 payload={i['package']:[i['version']] for i in manifest}
 req=urllib.request.Request('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=30) as response:alerts=json.load(response)
 if alerts:
  for package,rows in alerts.items():
   for row in rows:print(package,row.get('severity'),row.get('title'),row.get('url'))
  raise SystemExit(1)
 print('PASS: no published npm advisories returned for declared versions at query time')
