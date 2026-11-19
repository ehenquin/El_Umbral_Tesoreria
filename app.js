'use strict';
const $ = id => document.getElementById(id);
const API = String(window.UMBRAL_CONFIG?.API_URL || '').trim();
let data = null, view = 'inicio', requestNumber = 0;
const currency = amount => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(amount)||0);
const clean = x => String(x??'');
const escapeHTML = s => clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate = v => {if(!v)return '—';const str=clean(v);const m=str.match(/^(\d{4})-(\d\d)-(\d\d)/);return m?`${m[3]}/${m[2]}/${m[1]}`:str.slice(0,16)};
const fullName = p => [p.Nombre,p.Segundo_Nombre,p.Apellido,p.Segundo_Apellido].filter(Boolean).join(' ');
function notify(message){$('alert').textContent=message;$('alert').hidden=!message;}
function loadDashboard(){
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(API)){notify('Falta configurar la URL de Apps Script en config.js');return;}
 const n=++requestNumber, callback='umbralDashboard_'+n+'_'+Date.now(),script=document.createElement('script');
 $('statusDot').style.color='#d9ae60';
 const timer=setTimeout(()=>{delete window[callback];script.remove();notify('No se pudo leer Google Sheets. Revisá que Apps Script esté implementado con acceso público y tenga la versión actualizada.');},18000);
 window[callback]=payload=>{
  clearTimeout(timer);script.remove();delete window[callback];
  if(payload?.error){notify('Error de Google Sheets: '+payload.error);return;}
  data=payload;notify('');$('statusDot').style.color='#82d49e';$('updated').textContent='Actualizado: '+(payload.actualizado||'').replace('T',' ');render();
 };
 script.onerror=()=>{clearTimeout(timer);delete window[callback];script.remove();notify('No se pudo conectar con Apps Script. Revisá la implementación pública.');};
 script.src=API+'?action=dashboard&callback='+encodeURIComponent(callback)+'&_='+Date.now();document.head.appendChild(script);
}
function render(){if(!data)return;const k=data.indicadores||{};
 [['kpiIngresos',k.ingresos],['kpiAportes',k.aportes],['kpiBeneficios',k.beneficios],['kpiGastos',k.gastos],['kpiSaldo',k.saldo],['legendIngresos',k.ingresos],['legendGastos',k.gastos]].forEach(([id,value])=>$(id).textContent=currency(value));
 $('kpiPersonas').textContent=`${k.conAportes||0} de ${k.integrantes||0} integrantes aportaron`;
 const total=(Number(k.ingresos)||0)+(Number(k.gastos)||0);const pct=total?100*(Number(k.ingresos)||0)/total:0;
 $('donut').style.background=`conic-gradient(#d9ae60 0% ${pct}%, #514d47 ${pct}% 100%)`;$('donutLabel').textContent=Math.round(pct)+'%';
 renderTable();renderRecent();
}
function confirmed(){return (data.movimientos||[]).filter(m=>clean(m.Estado).toLowerCase()==='confirmado');}
function nameById(id){const p=(data.integrantes||[]).find(p=>clean(p.ID_Integrante)===clean(id));return p?fullName(p):'—';}
function renderTable(){if(!data)return;
 const labels={inicio:'Aportes de integrantes',aportes:'Aportes de integrantes',integrantes:'Integrantes de la compañía',movimientos:'Libro de movimientos',comprobantes:'Comprobantes registrados',reportes:'Totales por categoría'};
 $('tableTitle').textContent=labels[view];$('pageTitle').textContent=({inicio:'Panel financiero',aportes:'Aportes',integrantes:'Integrantes',movimientos:'Movimientos',comprobantes:'Comprobantes',reportes:'Reportes'})[view];
 let headers=[],rows=[];
 if(['inicio','aportes','integrantes'].includes(view)){
  headers=['Nº','Nombre y apellido','DNI','Fecha último aporte','Total aportado','Aporte'];
  rows=(data.integrantes||[]).map((p,i)=>[i+1,fullName(p),p.DNI,formatDate(p.Ultimo_Aporte),currency(p.Total_Aportado),Number(p.Cantidad_Aportes)?'✓ '+p.Cantidad_Aportes:'—']);
 }else if(view==='movimientos'){
  headers=['Fecha','Tipo','Concepto','Integrante','Monto','Estado'];
  rows=(data.movimientos||[]).slice().reverse().map(m=>[formatDate(m.Fecha_Hora),m.Tipo,m.Concepto,nameById(m.ID_Integrante),currency(m.Monto),m.Estado]);
 }else if(view==='comprobantes'){
  headers=['Fecha','Archivo','Extracción','Movimiento'];
  rows=(data.comprobantes||[]).slice().reverse().map(f=>[formatDate(f.Fecha_Carga),f.Nombre_Archivo,f.Estado_Extraccion,f.ID_Movimiento||'Pendiente']);
 }else{
  headers=['Categoría','Tipo','Total'];
  rows=(data.categorias||[]).map(c=>[c.Categoria,c.Tipo,currency(confirmed().filter(m=>m.ID_Categoria===c.ID_Categoria).reduce((s,m)=>s+Number(m.Monto||0),0))]);
 }
 const q=$('search').value.trim().toLocaleLowerCase('es');if(q)rows=rows.filter(r=>r.some(v=>clean(v).toLocaleLowerCase('es').includes(q)));
 $('countLabel').textContent=rows.length+' registros';$('tableHead').innerHTML='<tr>'+headers.map(s=>'<th>'+escapeHTML(s)+'</th>').join('')+'</tr>';
 $('tableBody').innerHTML=rows.map(r=>'<tr>'+r.map((v,i)=>'<td'+(headers[i]==='Monto'?' class="amount"':'')+'>'+((headers[i]==='Aporte'&&clean(v).startsWith('✓'))?'<span class="check">'+escapeHTML(v)+'</span>':escapeHTML(v))+'</td>').join('')+'</tr>').join('');
 const titleIndex=['inicio','aportes','integrantes'].includes(view)?1:(view==='movimientos'?2:1);
 $('mobileCards').innerHTML=rows.map(r=>'<article class="record-card"><h4 class="record-title">'+escapeHTML(r[titleIndex]||r[0]||'Registro')+'</h4><dl class="record-grid">'+headers.map((header,i)=>'<dt>'+escapeHTML(header)+'</dt><dd'+(header==='Monto'||header==='Total aportado'||header==='Total'?' class="amount"':'')+'>'+escapeHTML(r[i])+'</dd>').join('')+'</dl></article>').join('');
 $('emptyMessage').hidden=rows.length>0;
}
function renderRecent(){const moves=confirmed().slice().reverse().slice(0,5);
 $('recent').innerHTML=moves.length?moves.map(m=>`<div class="recent-row"><div><strong>${escapeHTML(m.Concepto||m.Tipo)}</strong><small>${escapeHTML(nameById(m.ID_Integrante))} · ${escapeHTML(formatDate(m.Fecha_Hora))}</small></div><div class="amount ${m.Tipo==='Egreso'?'negative':'positive'}">${m.Tipo==='Egreso'?'−':'+'} ${escapeHTML(currency(m.Monto))}</div></div>`).join(''):'<p class="muted">Todavía no hay movimientos confirmados.</p>';
}
function openUpload(){if(!API){notify('Configurá la URL del backend.');return;}$('uploadOverlay').hidden=false;$('uploadFrame').src=API+'?action=carga';document.body.style.overflow='hidden';}
function closeUpload(){$('uploadOverlay').hidden=true;$('uploadFrame').src='about:blank';document.body.style.overflow='';}
function setMenu(open){$('sidebar').classList.toggle('open',open);$('menuScrim').hidden=!open;$('menuToggle').setAttribute('aria-expanded',String(open));$('menuToggle').setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');}
window.addEventListener('message',e=>{
 if(!e.origin.startsWith('https://') || !(/(^|\.)googleusercontent\.com$|(^|\.)google\.com$/.test(new URL(e.origin).hostname)))return;
 if(e.data?.event==='UMBRAL_SAVED'){closeUpload();loadDashboard();}
});
$('refreshBtn').addEventListener('click',loadDashboard);$('search').addEventListener('input',renderTable);
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x===b));$('search').value='';renderTable();setMenu(false);}));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{document.querySelector(`.nav-item[data-view="${b.dataset.goto}"]`)?.click();}));
document.querySelectorAll('.open-upload').forEach(b=>b.addEventListener('click',openUpload));
$('closeUpload').addEventListener('click',closeUpload);$('uploadOverlay').addEventListener('click',e=>{if(e.target===$('uploadOverlay'))closeUpload()});
$('menuToggle').addEventListener('click',()=>setMenu(!$('sidebar').classList.contains('open')));$('menuScrim').addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('uploadOverlay').hidden)closeUpload();setMenu(false);}});
loadDashboard();
