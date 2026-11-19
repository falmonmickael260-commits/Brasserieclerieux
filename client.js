const $=s=>document.querySelector(s),msg=t=>$('#message').textContent=t;
async function api(url,data){const r=await fetch('/api/'+url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const v=await r.json();if(!r.ok)throw Error(v);return v}
if($('#login'))$('#login').onsubmit=async e=>{e.preventDefault();try{await api('login',{password:e.target.password.value});location.reload()}catch(x){msg(x.message)}};
if($('#logout'))$('#logout').onclick=async()=>{await api('logout',{});location.reload()};
function publicationStatus(delivery){
 if(!delivery)return 'Menu enregistré.';
 if(!delivery.total)return 'Menu publié. Aucun appareil n’est abonné aux notifications.';
 const details=[];
 if(delivery.accepted)details.push(delivery.accepted===1?'1 notification acceptée':delivery.accepted+' notifications acceptées');
 if(delivery.alreadySent)details.push(delivery.alreadySent+' déjà averti(s) pour cet envoi');
 if(delivery.expired)details.push(delivery.expired+' abonnement(s) expiré(s)');
 if(delivery.failed)details.push(delivery.failed+' échec(s) d’envoi. Appuyez à nouveau sur le bouton pour réessayer.');
 return 'Menu publié. '+details.join(' · ')+'.';
}

const menuForm=$('#menuform');
if(menuForm){
 const history=$('#history'),editPublished=$('#edit-published'),publish=$('#publish-menu');
 const today=menuForm.elements.day.value;
 const photo=$('#photo'),preview=$('#preview');
 let menus=[],pending,historyLoaded=false;

 function updateActions(){
  const menu=menus.find(item=>item.day===menuForm.elements.day.value);
  const editing=menu?.day===today&&menu.state==='published';
  publish.textContent=editing?'Mettre à jour et renvoyer':'Publier et envoyer maintenant';
  editPublished.hidden=!menus.some(item=>item.day===today&&item.state==='published');
 }
 function selectMenu(menu){
  pending=null;
  photo.value='';
  for(const name of ['day','starter','main','sweet','price'])menuForm.elements[name].value=menu[name]??'';
  preview.hidden=!menu.hasPhoto||menu.state!=='published';
  if(!preview.hidden)preview.src='/photo-du-jour/'+menu.day+'?v='+encodeURIComponent(menu.notificationKey);
  updateActions();
  menuForm.elements.starter.focus();
 }
 async function refreshHistory(){
  menus=await api('admin');
  historyLoaded=true;
  history.replaceChildren();
  for(const menu of menus){
   const entry=document.createElement('button');
   entry.type='button';
   entry.textContent=menu.day+' · '+({draft:'Brouillon',published:'Publié',scheduled:'Programmé'}[menu.state]);
   entry.onclick=()=>selectMenu(menu);
   history.append(entry,' ');
  }
  updateActions();
 }
 const initialMenus=refreshHistory().catch(error=>msg(error.message));
 editPublished.onclick=()=>selectMenu(menus.find(menu=>menu.day===today&&menu.state==='published'));
 menuForm.addEventListener('input',()=>{pending=null});
 menuForm.elements.day.addEventListener('change',()=>{
  updateActions();
  if(!photo.files.length)preview.hidden=true;
 });
 menuForm.onsubmit=async event=>{
  event.preventDefault();
  const state=event.submitter.value;
  const actions=[...menuForm.querySelectorAll('button')];
  actions.forEach(button=>{button.disabled=true});
  try{
   await initialMenus;
   if(!historyLoaded)await refreshHistory();
   if(!pending||pending.state!==state){
    const values=Object.fromEntries(new FormData(menuForm));
    const previous=menus.find(menu=>menu.day===values.day);
    pending={...values,state,photo:await preparePhoto()};
    if(state==='published')Object.assign(pending,{publicationId:crypto.randomUUID(),expectedKey:previous?.notificationKey??null});
   }
   const submission=pending;
   let {delivery}=await api('admin',submission);
   if(delivery){
    while(Number.isSafeInteger(delivery.next)){
     msg('Menu publié. Envoi des notifications en cours…');
     const {delivery:batch}=await api('menu-delivery',{publicationId:submission.publicationId,cursor:delivery.next});
     delivery={...delivery,next:batch.next,accepted:delivery.accepted+batch.accepted,expired:delivery.expired+batch.expired,failed:delivery.failed+batch.failed};
    }
   }
   if(!delivery?.failed&&pending===submission)pending=null;
   msg(publicationStatus(delivery));
   await refreshHistory();
  }catch(error){msg(error.message)}
  finally{actions.forEach(button=>{button.disabled=false})}
 };
}
const registeredWorker='serviceWorker' in navigator?navigator.serviceWorker.register('/sw.js'):null;
registeredWorker?.catch(()=>{});
if($('#push')){
 const button=$('#push'),test=$('#test-push'),guide=$('#guide');
 const android=/Android/i.test(navigator.userAgent);
 const installed=matchMedia('(display-mode: standalone)').matches;
 const androidHelp=installed
  ? 'Dans les paramètres du Samsung, ouvrez Applications → Herbasse → Notifications et autorisez-les. Vous pouvez aussi ouvrir cette page directement dans Chrome.'
  : 'Dans Chrome, ouvrez les autorisations du site et sélectionnez Notifications → Autoriser. Vérifiez aussi que Chrome est autorisé à notifier dans les paramètres du Samsung.';
 const permissionHelp=android?androidHelp:'Autorisez les notifications de Herbasse dans les réglages de votre appareil, puis rechargez cette page.';
 test.hidden=false;
 test.disabled=true;
 test.setAttribute('aria-describedby','guide');
 guide.textContent='Touchez « Activer les notifications », puis « Autoriser » pour pouvoir tester sur cet appareil.';

 if(!registeredWorker||!('PushManager' in window)||!('Notification' in window)){
  button.disabled=true;
  guide.textContent=android
   ? 'Ouvrez cette page directement dans Chrome pour activer les notifications.'
   : 'Sur iPhone, ajoutez d’abord la Brasserie à votre écran d’accueil, puis ouvrez son icône pour activer les notifications.';
 }else{
  let active=false;
  function showActive(enabled){
   active=enabled;
   button.textContent=enabled?'Désactiver les notifications':'Activer les notifications';
   test.disabled=!enabled;
   guide.textContent=enabled?'':'Touchez « Activer les notifications », puis « Autoriser » pour pouvoir tester sur cet appareil.';
  }
  async function waitForPushWorker(){
   let timeout;
   try{
    return await Promise.race([
     registeredWorker.then(()=>navigator.serviceWorker.ready),
     new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Le service de notifications ne démarre pas. Rechargez cette page.')),8000)}),
    ]);
   }finally{clearTimeout(timeout)}
  }
  function activationError(error){
   const unsupported=error.name==='NotSupportedError'||error.name==='AbortError'
    ||error.message==='Service de notification non pris en charge.';
   msg(android&&unsupported?'Impossible d’activer depuis cet écran. Ouvrez la page directement dans Chrome et réessayez.':error.message);
  }

  if(Notification.permission==='denied')guide.textContent=permissionHelp;
  if(Notification.permission==='granted'){
   button.disabled=true;
   waitForPushWorker().then(async registration=>{
    const subscription=await registration.pushManager.getSubscription();
    if(subscription){
     await api('sub',subscription.toJSON());
     showActive(true);
    }
   }).catch(activationError).finally(()=>{button.disabled=false});
  }
  button.onclick=async()=>{
   button.disabled=true;
   try{
    if(!active&&await Notification.requestPermission()!=='granted')throw Error(permissionHelp);
    const registration=await waitForPushWorker();
    const existing=await registration.pushManager.getSubscription();
    if(active&&existing){
     await api('sub',{endpoint:existing.endpoint,remove:true});
     await existing.unsubscribe();
     showActive(false);
     msg('Notifications désactivées sur cet appareil.');
    }else{
     let subscription=existing;
     if(!subscription){
      const key=await api('key');
      const applicationServerKey=Uint8Array.from(atob(key.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
      subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
     }
     try{await api('sub',subscription.toJSON())}
     catch(error){if(!existing)await subscription.unsubscribe();throw error}
     showActive(true);
     msg('Notifications activées sur cet appareil.');
    }
   }catch(error){activationError(error)}
   finally{button.disabled=false}
  };
  test.onclick=async()=>{
   test.disabled=true;
   try{
    const subscription=await (await waitForPushWorker()).pushManager.getSubscription();
    if(!subscription){
     showActive(false);
     throw Error('Activez les notifications sur cet appareil.');
    }
    await api('sub',subscription.toJSON());
    await api('test-push',subscription.toJSON());
    msg('Test envoyé à cet appareil. Vérifiez le centre de notifications.');
   }catch(error){msg(error.message)}
   finally{test.disabled=!active}
  };
 }
}
async function preparePhoto(){
  const file=$('#photo')?.files[0];if(!file)return null;
  const img=new Image(),url=URL.createObjectURL(file);
  try{img.src=url;await img.decode();const scale=Math.min(1,1000/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.78).split(',')[1]}finally{URL.revokeObjectURL(url)}
}
if($('#photo'))$('#photo').onchange=async()=>{try{const data=await preparePhoto();$('#preview').hidden=!data;if(data)$('#preview').src='data:image/jpeg;base64,'+data}catch{msg('Choisissez une photo JPEG ou PNG lisible.')}};
if($('#mobile')){
 const modal=$('#installbox'),body=$('#instructions'),install=$('#installnow');
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
 const android=/Android/i.test(navigator.userAgent);
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 let invitation;
 function openGuide(){if(!modal.open)modal.showModal()}
 if(ios){
  $('#install-title').textContent='Installer sur iPhone ou iPad';
  $('#install').textContent='Voir le guide iPhone / iPad';
  body.innerHTML=`
   <p class="install-intro">Ouvrez cette page dans <strong>Safari</strong>. Si le lien s’ouvre dans une autre app, copiez-le et collez-le dans la barre d’adresse de Safari.</p>
   <ol class="install-steps">
    <li>
     <h3>Touchez « Partager »</h3>
     <p>Repérez le carré avec la flèche vers le haut dans la barre de Safari. Si vous voyez <strong>⋯</strong>, touchez-le puis choisissez <strong>Partager</strong>.</p>
     <div class="ios-example ios-toolbar" aria-hidden="true">
      <span class="ios-address">Barre d’adresse de Safari</span>
      <span class="ios-control"><i class="ios-share"></i></span>
      <span class="ios-control ios-more">⋯</span>
     </div>
    </li>
    <li>
     <h3>Choisissez « Sur l’écran d’accueil »</h3>
     <p>Dans le menu de partage, faites défiler les actions vers le bas. Si l’option manque, ouvrez <strong>Modifier les actions</strong> tout en bas pour l’ajouter.</p>
     <div class="ios-example ios-row" aria-hidden="true">
      <span>Sur l’écran d’accueil</span><i class="ios-plus"></i>
     </div>
    </li>
    <li>
     <h3>Touchez « Ajouter »</h3>
     <p>Si l’option <strong>Ouvrir comme app web</strong> s’affiche, activez-la. Puis touchez <strong>Ajouter</strong>, en haut à droite.</p>
     <div class="ios-example ios-row" aria-hidden="true">
      <span>Ouvrir comme app web <i class="ios-toggle"></i></span>
      <strong class="ios-add">Ajouter</strong>
     </div>
    </li>
    <li>
     <h3>Activez les notifications</h3>
     <p>Sur l’écran d’accueil, ouvrez l’icône <strong>Herbasse</strong>. Dans l’app, touchez <strong>Activer les notifications</strong>, puis <strong>Autoriser</strong>.</p>
     <div class="ios-example ios-row" aria-hidden="true">
      <img src="/icon192.png" alt="" width="36" height="36"><span>Herbasse</span>
     </div>
    </li>
   </ol>`;
 }else if(android){
  body.innerHTML='<p class="install-intro">Dans le menu ⋮ de Chrome, choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</p>';
 }
 if((ios||android)&&!standalone){
  $('#install').hidden=false;
  $('#install').onclick=openGuide;
  if(!sessionStorage.getItem('install-seen')){
   sessionStorage.setItem('install-seen','1');
   setTimeout(openGuide,5500);
  }
 }
 addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  invitation=e;
  install.hidden=false;
  $('#install').hidden=false;
  $('#install').onclick=openGuide;
  install.onclick=async()=>{
   if(invitation){
    await invitation.prompt();
    await invitation.userChoice;
    invitation=null;
    install.hidden=true;
    modal.close();
   }
  };
 });
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
const announcementForm=$('#announce');
if(announcementForm){
 let pending=null;
 announcementForm.addEventListener('input',()=>{pending=null});
 announcementForm.onsubmit=async event=>{
  event.preventDefault();const status=$('#announce-status'),button=announcementForm.querySelector('button');
  if(button.disabled)return;
  button.disabled=true;
  pending??={id:crypto.randomUUID(),...Object.fromEntries(new FormData(announcementForm))};
  let accepted=0,missed=0,cursor=0;
  try{
   do{status.textContent='Envoi en cours…';const batch=await api('announce',{...pending,cursor});accepted+=batch.accepted;missed+=batch.missed;cursor=batch.next}while(cursor!==null);
   status.textContent=accepted||missed?'Notifications acceptées : '+accepted+'. Non remises : '+missed+'.':'Aucun nouvel envoi pour ce message.';
   if(!missed){pending=null;announcementForm.reset()}
  }catch{status.textContent='Envoi interrompu. Réessayez pour reprendre.'}
  finally{button.disabled=false}
 }
}
