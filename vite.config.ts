import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { branding } from './src/config/branding';

export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:8787'}},preview:{proxy:{'/api':'http://127.0.0.1:8787'}}, plugins: [react(), tailwindcss(),{
 name:'local-offline-app',
 transformIndexHtml(html,context){return html.replace(/<title>.*?<\/title>/,`<title>${branding.name.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!))}</title>`).replace('</head>',(context.server?'':'<link rel="manifest" href="/manifest.webmanifest">')+'<meta name="theme-color" content="#7562c3"></head>');},
 generateBundle(_options,bundle){
 const assets=['/','/index.html','/manifest.webmanifest','/icon-192.png','/icon-512.png',...Object.keys(bundle).filter(x=>/\.(?:js|css|woff2?|png|svg)$/.test(x)).map(x=>'/'+x)];
 const version=JSON.stringify(assets).split('').reduce((hash,char)=>(Math.imul(hash,31)+char.charCodeAt(0))>>>0,2166136261).toString(16);
 this.emitFile({type:'asset',fileName:'manifest.webmanifest',source:JSON.stringify({id:'/',name:branding.name,short_name:branding.name,description:branding.description,start_url:'/',scope:'/',display:'standalone',background_color:'#f7f8fa',theme_color:'#7562c3',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]})});
 this.emitFile({type:'asset',fileName:'sw.js',source:`const CACHE='personal-os-shell-${version}';const ASSETS=${JSON.stringify(assets)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('personal-os-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match('/index.html'))));return;}if(ASSETS.includes(url.pathname))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(url.pathname))||fetch(e.request)));});`});
 }
 }] });


