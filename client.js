const $=s=>document.querySelector(s),msg=t=>$('#message').textContent=t;
async function api(url,data){const r=await fetch('/api/'+url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const v=await r.json();if(!r.ok)throw Error(v);return v}
if($('#login'))$('#login').onsubmit=async e=>{e.preventDefault();try{await api('login',{password:e.target.password.value});location.reload()}catch(x){msg(x.message)}};
if($('#logout'))$('#logout').onclick=async()=>{await api('logout',{});location.reload()};
async function historyList(){const h=$('#history'),f=$('#menuform');h.replaceChildren();for(const m of await api('admin')){const b=document.createElement('button');b.textContent=m.day+' · '+({draft:'Brouillon',published:'Publié',scheduled:'Programmé'}[m.state]);b.onclick=()=>{if($('#photo')){$('#photo').value='';$('#preview').hidden=true}for(const [k,v] of Object.entries(m))if(f.elements[k])f.elements[k].value=v;f.scrollIntoView()};h.append(b,' ')}}
if($('#menuform')){historyList().catch(x=>msg(x.message));$('#menuform').onsubmit=async e=>{e.preventDefault();try{await api('admin',{...Object.fromEntries(new FormData(e.target)),state:e.submitter.value,photo:await preparePhoto()});msg('Menu enregistré.');await historyList()}catch(x){msg(x.message)}}}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
if($('#push')){const b=$('#push');if(!('PushManager' in window)){b.disabled=true;$('#guide').textContent='Sur iPhone, utilisez Partager puis Sur l’écran d’accueil et ouvrez le site depuis son icône. Sinon, ouvrez cette page dans un navigateur compatible.'}else{navigator.serviceWorker.ready.then(async r=>{if(await r.pushManager.getSubscription())b.textContent='Désactiver les notifications'});b.onclick=async()=>{try{const perm=await Notification.requestPermission();if(perm!=='granted')throw Error('Autorisez les notifications dans les réglages du navigateur.');const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await api('sub',{endpoint:sub.endpoint,remove:true});await sub.unsubscribe();b.textContent='Activer les notifications'}else{const key=await api('key'),s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(key.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))});try{await api('sub',{endpoint:s.endpoint})}catch(e){await s.unsubscribe();throw e}b.textContent='Désactiver les notifications';msg('Les notifications du menu sont activées.')}}catch(x){msg(x.message)}}}}
async function preparePhoto(){
  const file=$('#photo')?.files[0];if(!file)return null;
  const img=new Image(),url=URL.createObjectURL(file);
  try{img.src=url;await img.decode();const scale=Math.min(1,1000/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.78).split(',')[1]}finally{URL.revokeObjectURL(url)}
}
if($('#photo'))$('#photo').onchange=async()=>{try{const data=await preparePhoto();$('#preview').hidden=!data;if(data)$('#preview').src='data:image/jpeg;base64,'+data}catch{msg('Choisissez une photo JPEG ou PNG lisible.')}};
if($('#mobile')){
 const modal=$('#installbox'),body=$('#instructions'),install=$('#installnow');
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent),android=/Android/i.test(navigator.userAgent);
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 let invitation;
 function openGuide(){if(!modal.open)modal.showModal()}
 function step(icon,title,detail){return '<div class="step"><em aria-hidden="true">'+icon+'</em><div><b>'+title+'</b><small>'+detail+'</small></div></div>'}
 if(ios||android){body.innerHTML=ios?step('⇧','1. Ouvrez Partager','Dans Safari, touchez le carré avec la flèche vers le haut. Selon la barre affichée, ouvrez d’abord le menu ⋯.')+step('⊞','2. Sur l’écran d’accueil','Faites défiler les actions, puis choisissez Sur l’écran d’accueil.')+step('＋','3. Ajouter','Confirmez en haut à droite, puis ouvrez la brasserie depuis sa nouvelle icône.'):'<p>Dans le menu ⋮ de Chrome, choisissez Installer l’application ou Ajouter à l’écran d’accueil.</p>';
 install.hidden=true;if(!standalone){$('#install').hidden=false;$('#install').onclick=openGuide;if(!sessionStorage.getItem('install-seen')){sessionStorage.setItem('install-seen','1');setTimeout(openGuide,5500)}}}
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();invitation=e;install.hidden=false;$('#install').hidden=false;$('#install').onclick=openGuide;install.onclick=async()=>{if(invitation){await invitation.prompt();await invitation.userChoice;invitation=null;install.hidden=true;modal.close()}}});
 $('#dismiss').onclick=()=>modal.close();if(location.pathname==='/alertes'||standalone)$('#mobile').open=true;
}

const folio=document.querySelector('.folio');
if(folio){
 const replay=document.querySelector('.reopen');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 function syncMotion(){replay.hidden=motion.matches}
 syncMotion();
 motion.addEventListener('change',syncMotion);
 replay.addEventListener('click',()=>{
   folio.classList.remove('opening');
   void folio.offsetWidth;
   folio.classList.add('opening');
 });
}
