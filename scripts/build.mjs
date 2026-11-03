import {mkdir,rm,cp,readFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const f of ['index.html','style.css','src','icons','manifest.webmanifest','sw.js'])await cp(f,'dist/'+f,{recursive:true});
JSON.parse(await readFile('manifest.webmanifest','utf8'));console.log('Static PWA built in dist/');
