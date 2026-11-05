import {mkdir,rm,cp,readFile,writeFile,readdir} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const f of ['index.html','style.css','src','icons','manifest.webmanifest','sw.js'])await cp(f,'dist/'+f,{recursive:true});
// Version the entire module graph: an already installed service worker must
// never combine fresh HTML with scripts cached by an earlier release.
const {version}=JSON.parse(await readFile('package.json','utf8'));
const versionURLs=s=>s.replace(/(['"])((?:\/|\.\/)[^'"?\s]+\.(?:js|css))\1/g,(match,quote,url)=>url==='/sw.js'?match:`${quote}${url}?v=${version}${quote}`);
for(const file of ['index.html','sw.js',...(await readdir('dist/src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f)]){
 const content=await readFile('dist/'+file,'utf8');
 await writeFile('dist/'+file,versionURLs(content));
}
JSON.parse(await readFile('manifest.webmanifest','utf8'));console.log('Static PWA built in dist/');
