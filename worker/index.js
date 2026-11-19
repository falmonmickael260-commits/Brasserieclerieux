const name='La Brasserie de l’Herbasse', phone='<a href="tel:+33951378515">09 51 37 85 15</a>', map='https://www.google.com/maps/dir/?api=1&destination=145+chemin+des+Auberges%2C+26260+Cl%C3%A9rieux';
const pages={'/':'Accueil','/menu':'Menu du jour','/carte':'La carte','/maison':'La brasserie','/acces':'Accès','/admin':'Admin'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
const hour=()=>Number(new Intl.DateTimeFormat('fr',{timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'}).format(new Date()).slice(0,2));
const menuFields='day,starter,main,sweet,price,state,photo IS NOT NULL AS hasPhoto,COALESCE(notification_key,day) AS notificationKey';
const publishedMenu=(env,date)=>env.DB.prepare("SELECT "+menuFields+" FROM menus WHERE day=? AND state='published'").bind(date).first();
const todayMenu=env=>publishedMenu(env,day());
const photoPath=menu=>'/photo-du-jour/'+menu.day+'?v='+encodeURIComponent(menu.notificationKey);
function shortDish(value){
  const dish=value?.trim().replace(/\s+/g,' ')??'';
  const name=dish.split(/[,;]|\s[–—]\s/,1)[0].trim()||dish;
  const letters=Array.from(name);
  if(letters.length<=22)return name;
  const clipped=letters.slice(0,21).join('');
  const words=clipped.replace(/\s+\S*$/,'');
  return (words.length>=11?words:clipped.trimEnd())+'…';
}
function menuNotification(menu){
  const dishes=[['Entrée',menu.starter],['Plat',menu.main],['Dessert',menu.sweet]]
    .map(([label,dish])=>[label,shortDish(dish)])
    .filter(([,dish])=>dish)
    .map(([label,dish])=>label+' · '+dish);
  return {
    id:menu.notificationKey,
    tag:'menu-du-jour-'+menu.day,
    title:'Menu du jour · '+String(menu.price).replace('.',',')+' €',
    body:dishes.join('\n'),
    ...(menu.hasPhoto?{image:photoPath(menu)}:{}),
  };
}
const title=(label,heading)=>'<small>'+label+'</small><h1>'+heading+'</h1>';
async function page(path,env,admin){
let body='';
if(path==='/admin')body=title('Espace du restaurateur','Le <i>panneau admin.</i>')+(admin?'<section class="sheet"><form id="menuform"><button id="edit-published" type="button" hidden>Modifier le menu du jour publié</button><label>Photo du jour<input type="file" id="photo" accept="image/*"></label><img hidden id="preview" width="150" alt="Aperçu de la photo du menu"><label>Date du menu<input type="date" name="day" required value="'+day()+'"></label>'+[['starter','Entrée'],['main','Plat'],['sweet','Dessert'],['price','Prix en euros']].map(([k,l])=>'<label>'+l+'<input name="'+k+'" maxlength="150" '+(k==='main'||k==='price'?'required':'')+' value="'+(k==='price'?'19':'')+'"></label>').join('')+'<div class="actions"><button value="scheduled">Programmer pour 10 h</button><button value="draft">Garder en brouillon</button><button id="publish-menu" value="published">Publier et envoyer maintenant</button></div></form><p id="message" role="status"></p><h2>Notification libre</h2><form id="announce"><label>Titre<input name="title" required maxlength="75"></label><label>Message<textarea name="body" rows="3" required maxlength="240"></textarea></label><button>Envoyer la notification maintenant</button><p role="status" id="announce-status"></p></form><h2>Menus enregistrés</h2><div id="history"></div><p><a href="/alertes">Lien d’activation à partager aux habitués</a></p><button id="logout">Déconnexion</button></section>':'<section class="sheet"><form id="login"><label>Mot de passe du restaurant<input type="password" name="password" autocomplete="current-password" required></label><button>Accéder au panneau</button></form><p id="message" role="status"></p></section>');

if(path!=='/admin'){
const m=await todayMenu(env);
const date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'Europe/Paris'}).format(new Date());
body=`<main class="daily"><header class="identity"><img src="/logo.webp" alt="La Brasserie de l’Herbasse"><div>La Brasserie <i>de l’Herbasse</i></div><small>Clérieux · Drôme</small></header><div class="folio opening"><div class="binding" aria-hidden="true"><div class="coverleaf left"><div class="leather"><img src="/logo.webp" alt=""></div></div><div class="coverleaf right"><div class="leather"><img src="/logo.webp" alt=""></div></div></div><div class="spread"><section class="dailytext"><small>${esc(date)}</small><h1>Menu <em>du jour</em></h1>${m?'<strong>'+esc(m.price)+' €</strong>'+[['Entrée',m.starter],['Plat',m.main],['Dessert',m.sweet]].filter(([,v])=>v).map(([k,v])=>'<div class="course"><small>'+k+'</small><h2>'+esc(v)+'</h2></div>').join(''):'<p>Le menu du jour n’a pas encore été annoncé. Retrouvez ici l’entrée, le plat et le dessert dès leur publication.</p>'}</section><figure class="dailyphoto"><img src="${m?.hasPhoto?photoPath(m):'/photos/brandade-editorial.jpg'}" alt="${m?.hasPhoto?'Photo du menu du jour':'Illustration de brandade de morue'}"><figcaption>${m?.hasPhoto?'À la table de la brasserie':'Brandade de morue · Illustration'}</figcaption></figure></div></div><button hidden class="reopen" type="button">↻ Revoir l’ouverture</button><details id="mobile"><summary>Recevoir le menu sur mon téléphone</summary><p id="guide"></p><button id="install" hidden>Installer l’application</button> <button id="push">Activer les notifications</button> <button id="test-push" type="button" hidden>Tester sur cet appareil</button><div id="push-chrome-help" hidden><p>Pour activer les alertes, ouvrez cette page dans Chrome.</p><a id="open-push-chrome">Ouvrir dans Chrome</a> <button id="copy-push-link" type="button">Copier le lien</button><input type="url" id="push-link-to-copy" aria-label="Lien des alertes à copier dans Chrome" readonly hidden></div><p id="message" role="status"></p></details><dialog id="installbox" aria-labelledby="install-title">
<header class="install-header">
<img src="/icon192.png" alt="" width="48" height="48">
<h2 id="install-title">Installer la Brasserie</h2>
<button id="dismiss" type="button" aria-label="Fermer le guide" autofocus>×</button>
</header>
<div id="instructions"></div>
<button id="installnow" type="button" hidden>Installer l’application</button>
</dialog></main><footer class="dock"><a href="tel:+33951378515"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 3 3-1 3 6-2 2c1 2 3 4 5 5l2-2 6 3-1 3c-.5 2-2 3-4 2C10 19 5 14 3 7c-.5-2 0-3 2-4Z"/></svg><b>Appeler pour réserver</b><span>09 51 37 85 15</span></a><a href="${map}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><b>S’y rendre</b><span>145 chemin des Auberges · Clérieux</span></a></footer>`;
}else body='<main>'+body+'</main>';
return '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="apple-touch-icon" href="/icon192.png"><link rel="manifest" href="/manifest.json"><link rel="stylesheet" href="/style.css"><title>'+name+'</title>'+body+'<script defer src="/client.js"></script></html>'}
const enc=new TextEncoder(), b64=x=>btoa(String.fromCharCode(...new Uint8Array(x))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function session(env,date){return b64(await crypto.subtle.digest('SHA-256',enc.encode(env.ADMIN_SECRET+'|session|'+date)))}
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
function validEndpoint(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(u.hostname==='fcm.googleapis.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com'))}catch{return false}}
async function sendPush(env,key,endpoint,payload){
const unsigned=b64(enc.encode('{"typ":"JWT","alg":"ES256"}'))+'.'+b64(enc.encode(JSON.stringify({
  aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:'mailto:brasseriedelherbasse@hotmail.com'
})));
const token=unsigned+'.'+b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(unsigned)));
return fetch(endpoint,{
  method:'POST',redirect:'error',body:payload,
  headers:{
    ...(payload?{'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream'}:{}),
    TTL:'3600',Urgency:'high',Authorization:'vapid t='+token+', k='+env.VAPID_PUBLIC
  }
});
}
const decode64=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
function joinBytes(...arrays){const size=arrays.reduce((n,a)=>n+a.length,0),out=new Uint8Array(size);let pos=0;for(const a of arrays){out.set(a,pos);pos+=a.length}return out}
async function deriveBytes(input,salt,info,bits){
const key=await crypto.subtle.importKey('raw',input,'HKDF',false,['deriveBits']);
return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,bits))
}
async function encryptPush(sub,message){
const user=decode64(sub.p256dh),peer=await crypto.subtle.importKey('raw',user,{name:'ECDH',namedCurve:'P-256'},false,[]);
const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const server=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
const shared=await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256);
const zero=new Uint8Array([0]),salt=crypto.getRandomValues(new Uint8Array(16));
const secret=await deriveBytes(shared,decode64(sub.auth),joinBytes(enc.encode('WebPush: info'),zero,user,server),256);
const keyBytes=await deriveBytes(secret,salt,joinBytes(enc.encode('Content-Encoding: aes128gcm'),zero),128);
const iv=await deriveBytes(secret,salt,joinBytes(enc.encode('Content-Encoding: nonce'),zero),96);
const key=await crypto.subtle.importKey('raw',keyBytes,'AES-GCM',false,['encrypt']);
const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,joinBytes(enc.encode(JSON.stringify(message)),new Uint8Array([2])));
return joinBytes(salt,new Uint8Array([0,0,16,0,65]),server,new Uint8Array(cipher))
}
async function broadcast(env,input){
const {id,title,body,cursor=0}=input;
if(typeof id!=='string'||!/^[-a-f0-9]{36}$/.test(id)||typeof title!=='string'||!title.trim()||title.length>75||typeof body!=='string'||!body.trim()||body.length>240||!Number.isSafeInteger(cursor)||cursor<0)return json('Titre ou message invalide.',400);
await env.DB.prepare('INSERT OR IGNORE INTO announcements SELECT ?,?,?,coalesce(max(rowid),0) FROM subs').bind(id,title,body).run();
const a=await env.DB.prepare('SELECT * FROM announcements WHERE id=?').bind(id).first();
if(a.title!==title||a.body!==body)return json('Ce message a déjà été modifié.',409);
const list=(await env.DB.prepare('SELECT rowid AS idx,* FROM subs WHERE rowid>? AND rowid<=? ORDER BY rowid LIMIT 20').bind(cursor,a.last_row).all()).results;
let accepted=0,missed=0;
if(list.length){
const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
for(const sub of list){
if(!sub.auth||!sub.p256dh){missed++;continue}
const claim=await env.DB.prepare('INSERT OR IGNORE INTO deliveries VALUES (?,?)').bind(id,sub.endpoint).run();
if(!claim.meta.changes)continue;
try{const payload=await encryptPush(sub,{id,title,body});const response=await sendPush(env,key,sub.endpoint,payload);if(response.ok)accepted++;else if([404,410].includes(response.status)){await env.DB.prepare('DELETE FROM subs WHERE endpoint=?').bind(sub.endpoint).run();missed++}else throw Error('push')}catch{missed++;await env.DB.prepare('DELETE FROM deliveries WHERE day=? AND endpoint=?').bind(id,sub.endpoint).run()}
}}
return json({accepted,missed,next:list.length===20?list[list.length-1].idx:null})
}
async function deliver(env,menu,cursor=0,batchSize=20){
const keyId=menu.notificationKey;
const {total,alreadySent}=await env.DB.prepare(
  'SELECT count(*) AS total,count(d.endpoint) AS alreadySent FROM subs s LEFT JOIN deliveries d ON d.endpoint=s.endpoint AND d.day=?'
).bind(keyId).first();
const candidates=(await env.DB.prepare(
  'SELECT s.rowid AS idx,s.endpoint,s.p256dh,s.auth FROM subs s WHERE s.rowid>? AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.day=? AND d.endpoint=s.endpoint) ORDER BY s.rowid LIMIT ?'
).bind(cursor,keyId,batchSize+1).all()).results;
const pending=candidates.slice(0,batchSize);
const next=candidates.length>batchSize?pending.at(-1).idx:null;
const result={total,alreadySent,accepted:0,expired:0,failed:0,next};
if(!pending.length)return result;
let key;
try{
  key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
}catch{
  result.failed=pending.length;
  console.error('Menu push signing key is unavailable');
  return result;
}
const note=menuNotification(menu);
for(const sub of pending){
  const claim=await env.DB.prepare(
    "INSERT OR IGNORE INTO deliveries SELECT ?,? FROM menus WHERE day=? AND state='published' AND COALESCE(notification_key,day)=?"
  ).bind(keyId,sub.endpoint,menu.day,keyId).run();
  if(!claim.meta.changes){result.alreadySent++;continue}
  try{
    const payload=sub.p256dh&&sub.auth?await encryptPush(sub,note):undefined;
    const response=await sendPush(env,key,sub.endpoint,payload);
    if(response.ok){result.accepted++;continue}
    if(response.status===404||response.status===410){
      await env.DB.prepare('DELETE FROM subs WHERE endpoint=?').bind(sub.endpoint).run();
      result.expired++;
    }else{
      result.failed++;
      console.warn('Menu push rejected',response.status);
    }
  }catch{
    result.failed++;
    console.warn('Menu push request failed');
  }
  await env.DB.prepare('DELETE FROM deliveries WHERE day=? AND endpoint=?').bind(keyId,sub.endpoint).run();
}
return result;
}
async function tick(env){
if(hour()<10)return 0;
await env.DB.prepare("UPDATE menus SET state='published' WHERE day=? AND state='scheduled'").bind(day()).run();
const menu=await todayMenu(env);
return menu?(await deliver(env,menu,0,40)).accepted:0;
}
async function testDevice(env,{endpoint,keys}){
if(!validEndpoint(endpoint)||typeof keys?.p256dh!=='string'||typeof keys?.auth!=='string')return json('Abonnement introuvable sur cet appareil.',400);
const sub=await env.DB.prepare('SELECT endpoint,p256dh,auth FROM subs WHERE endpoint=? AND p256dh=? AND auth=?')
  .bind(endpoint,keys.p256dh,keys.auth).first();
if(!sub)return json('Réactivez les notifications sur cet appareil.',404);
const id='test-'+Math.floor(Date.now()/60000);
const claim=await env.DB.prepare('INSERT OR IGNORE INTO deliveries VALUES (?,?)').bind(id,endpoint).run();
if(!claim.meta.changes)return json('Un test a déjà été demandé. Réessayez dans une minute.',429);
try{
  const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const payload=await encryptPush(sub,{id,title:'La Brasserie de l’Herbasse',body:'Les notifications de la brasserie fonctionnent sur cet appareil.'});
  const response=await sendPush(env,key,endpoint,payload);
  if(response.ok)return json(true);
  if(response.status===404||response.status===410){
    await env.DB.prepare('DELETE FROM subs WHERE endpoint=?').bind(endpoint).run();
    return json('Cet abonnement a expiré. Désactivez puis réactivez les notifications.',410);
  }
  console.warn('Device test push rejected',response.status);
}catch{
  console.warn('Device test push request failed');
}
return json('Le service de notifications a refusé le test. Réessayez dans une minute.',502);
}
const publicationIdPattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const menuChanged=()=>json('Le menu a été modifié entre-temps. Rechargez l’administration avant de renvoyer.',409);
async function saveMenu(env,m){
  if(!m||!/^\d{4}-\d\d-\d\d$/.test(m.day)||m.day<day()||!['scheduled','published','draft'].includes(m.state)
    ||[m.starter,m.main,m.sweet].some(value=>typeof value!=='string'||value.length>150)
    ||!m.main.trim()||!/^\d{1,3}([.,]\d{1,2})?$/.test(m.price)||(m.state==='published'&&m.day!==day())){
    return json('Vérifiez la date, les plats et le prix. L’envoi immédiat concerne le menu d’aujourd’hui.',400);
  }
  if(m.photo!=null&&(typeof m.photo!=='string'||m.photo.length>800000||!/^\/9j\/[A-Za-z0-9+/]+=*$/.test(m.photo))){
    return json('Photo invalide.',400);
  }

  const manual=m.state==='published'&&m.publicationId!=null;
  if(manual&&(!publicationIdPattern.test(m.publicationId)||(m.expectedKey!==null&&typeof m.expectedKey!=='string'))){
    return json('Publication invalide. Rechargez l’administration.',400);
  }
  const publicationKey=manual?'menu-'+m.publicationId:null;
  await env.DB.prepare(`
    INSERT INTO menus(day,starter,main,sweet,price,state,photo,notification_key) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(day) DO UPDATE SET starter=excluded.starter,main=excluded.main,sweet=excluded.sweet,
      price=excluded.price,state=excluded.state,photo=COALESCE(excluded.photo,menus.photo),
      notification_key=COALESCE(excluded.notification_key,menus.notification_key)
    WHERE excluded.notification_key IS NULL OR
      (COALESCE(menus.notification_key,menus.day) IS ? AND COALESCE(menus.notification_key,menus.day)<>excluded.notification_key)
  `).bind(m.day,m.starter,m.main,m.sweet,m.price,m.state,m.photo??null,publicationKey,manual?m.expectedKey:null).run();
  if(m.state!=='published')return json({delivery:null});
  const menu=await todayMenu(env);
  if(!menu||(manual&&menu.notificationKey!==publicationKey))return menuChanged();
  return json({delivery:await deliver(env,menu,0,manual?20:40)});
}
async function continueMenuDelivery(env,{publicationId,cursor}){
  if(!publicationIdPattern.test(publicationId)||!Number.isSafeInteger(cursor)||cursor<1)return json('Envoi invalide.',400);
  const menu=await todayMenu(env);
  if(!menu||menu.notificationKey!=='menu-'+publicationId)return menuChanged();
  return json({delivery:await deliver(env,menu,cursor)});
}
export default {async scheduled(_,env){await tick(env)},async fetch(req,env){const u=new URL(req.url),p=u.pathname,method=req.method;const send=(v,type)=>new Response(v,{headers:{'Content-Type':type,'Cache-Control':'no-store'}});try{
if(p.startsWith('/photos/') && Object.hasOwn(PHOTOS,p.slice(8)))return send(Uint8Array.from(atob(PHOTOS[p.slice(8)]),c=>c.charCodeAt(0)),'image/jpeg');
if(p==='/icon192.png'||p==='/icon512.png')return send(Uint8Array.from(atob(ICONS[p.slice(1)]),c=>c.charCodeAt(0)),'image/png');
if(/^\/photo-du-jour\/\d{4}-\d{2}-\d{2}$/.test(p)){
  const date=p.split('/').pop(),version=u.searchParams.get('v');
  const row=await env.DB.prepare(`
    SELECT photo FROM menus WHERE day=? AND state='published'
      AND (? IS NULL OR COALESCE(notification_key,day)=?)
    UNION ALL
    SELECT previous.photo FROM menu_notification_photos previous
      JOIN menus ON menus.day=previous.day AND menus.state='published'
      WHERE previous.day=? AND previous.notification_key=?
    LIMIT 1
  `).bind(date,version,version,date,version).first();
  return row?.photo?send(Uint8Array.from(atob(row.photo),c=>c.charCodeAt(0)),'image/jpeg'):new Response('',{status:404});
}
if(p==='/logo.webp')return send(Uint8Array.from(atob(LOGO),c=>c.charCodeAt(0)),'image/webp');
if(p==='/style.css')return send(CSS,'text/css');if(p==='/client.js'||p==='/sw.js')return send(p==='/sw.js'?SW:CLIENT,'text/javascript');
if(p==='/manifest.json')return json({name,short_name:'Herbasse',id:'/',start_url:'/',display:'standalone',theme_color:'#151515',icons:[192,512].map(n=>({src:'/icon'+n+'.png',sizes:n+'x'+n,type:'image/png'}))});
if(p==='/api/menu'){
  const menu=await todayMenu(env);
  if(!menu)return json(null);
  const notification=menuNotification(menu);
  return json({...menu,photoPath:notification.image??null,notification});
}
if(p==='/api/key')return json(env.VAPID_PUBLIC);
if(method==='POST'&&req.headers.get('origin')!==u.origin&&p!=='/api/tick')return json('Origine refusée',403);
if(method==='POST'&&p==='/api/tick')return json(await tick(env));
const token=env.ADMIN_SECRET?await session(env,day()):null;const admin=!!token&&(req.headers.get('cookie')||'').split(';').some(v=>v.trim()==='brasserie='+token);
if(method==='POST'&&p==='/api/login'){const {password}=await req.json();if(!token||password!==env.ADMIN_SECRET)return json('Mot de passe incorrect.',403);return new Response('{}',{headers:{'Set-Cookie':'brasserie='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400'}})}
if(method==='POST'&&p==='/api/logout')return new Response('{}',{headers:{'Set-Cookie':'brasserie=; Path=/; Max-Age=0; Secure; HttpOnly'}});
if(method==='POST'&&p==='/api/test-push')return await testDevice(env,await req.json());
if(method==='POST'&&p==='/api/sub'){let {endpoint,remove,keys}=await req.json();if(!validEndpoint(endpoint))return json('Service de notification non pris en charge.',400);if(remove)await env.DB.prepare('DELETE FROM subs WHERE endpoint=?').bind(endpoint).run();else if(keys&&/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(keys.auth))await env.DB.prepare('INSERT INTO subs(endpoint,p256dh,auth) VALUES (?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth').bind(endpoint,keys.p256dh,keys.auth).run();else await env.DB.prepare('INSERT OR IGNORE INTO subs(endpoint) VALUES (?)').bind(endpoint).run();return json(true)}
if(p==='/api/announce'&&method==='POST'){if(!admin)return json('Connexion requise',403);return broadcast(env,await req.json())}
if(p==='/api/admin'||p==='/api/menu-delivery'){
  if(!admin)return json('Connexion requise',403);
  if(p==='/api/admin'&&method==='GET')return json((await env.DB.prepare('SELECT '+menuFields+' FROM menus ORDER BY day DESC LIMIT 120').all()).results);
  if(method!=='POST')return json('Méthode non autorisée.',405);
  return p==='/api/admin'?await saveMenu(env,await req.json()):await continueMenuDelivery(env,await req.json());
}
if(p in pages||p==='/alertes')return send(await page(p,env,admin),'text/html;charset=UTF-8');return new Response('Page introuvable',{status:404})}catch{return json('Service temporairement indisponible.',503)}}}
