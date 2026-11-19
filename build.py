import base64,json,pathlib
p=pathlib.Path
p('dist/server').mkdir(parents=True,exist_ok=True)
constants=dict(ICONS={f.name:base64.b64encode(f.read_bytes()).decode() for f in p(".").glob("icon*.png")},PHOTOS={f.name:base64.b64encode(f.read_bytes()).decode() for f in p('photos').glob('*.jpg')},CSS=p('style.css').read_text(),LOGO=base64.b64encode(p('logo.webp').read_bytes()).decode(),CLIENT=p('client.js').read_text(),SW=p('sw.js').read_text(),OPENING_SOUND=base64.b64encode(p('son-ouverture.mp3').read_bytes()).decode())
p('dist/server/index.js').write_text(''.join('const '+k+'='+json.dumps(v)+';\n' for k,v in constants.items())+p('worker/index.js').read_text())
