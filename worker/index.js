const cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-headers':'content-type,authorization'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...cors}});
const esc=s=>String(s).replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
const val=(x,t)=>{const m=x.match(new RegExp('<(?:[\\w]+:)?'+t+'[^>]*>([\\s\\S]*?)<\\/(?:[\\w]+:)?'+t+'>','i'));return m?m[1].replace(/<[^>]+>/g,'').trim():''};
async function kbo(env,body){
 if(!env.KBO_USERNAME||!env.KBO_PASSWORD||!env.KBO_ENDPOINT)throw Error('KBO niet geconfigureerd');
 const created=new Date().toISOString(),nonce=crypto.getRandomValues(new Uint8Array(16)),enc=new TextEncoder();
 const pass=enc.encode(created+env.KBO_PASSWORD),input=new Uint8Array(nonce.length+pass.length);input.set(nonce);input.set(pass,nonce.length);
 const digest=await crypto.subtle.digest('SHA-1',input),b64=btoa(String.fromCharCode(...new Uint8Array(digest))),n64=btoa(String.fromCharCode(...nonce));
 const xml=`<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" xmlns:mes="http://economie.fgov.be/kbopub/webservices/v1/messages"><soap:Header><wsse:Security><wsu:Timestamp><wsu:Created>${created}</wsu:Created></wsu:Timestamp><wsse:UsernameToken><wsse:Username>${esc(env.KBO_USERNAME)}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${b64}</wsse:Password><wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${n64}</wsse:Nonce><wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security><mes:RequestContext><mes:Id>${crypto.randomUUID()}</mes:Id><mes:Language>nl</mes:Language></mes:RequestContext></soap:Header><soap:Body>${body}</soap:Body></soap:Envelope>`;
 const r=await fetch(env.KBO_ENDPOINT,{method:'POST',headers:{'content-type':'text/xml; charset=utf-8'},body:xml}),txt=await r.text();if(!r.ok||txt.includes(':Fault'))throw Error(val(txt,'faultstring')||'KBO HTTP '+r.status);return txt;
}
export default {async fetch(req,env){
 const u=new URL(req.url);if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(u.pathname==='/api/health')return json({ok:true,app:env.APP_NAME||'Richtpunt Bestelplatform',kboConfigured:!!(env.KBO_USERNAME&&env.KBO_PASSWORD&&env.KBO_ENDPOINT)});
 if(u.pathname==='/api/kbo/search'&&req.method==='GET'){try{const terms=(u.searchParams.get('q')||'').trim().split(/\\s+/).filter(Boolean).slice(0,10);if(!terms.length)return json({results:[]});const parts=terms.map(t=>'<mes:Phoneme>'+esc(t)+'</mes:Phoneme>').join('');const xml=await kbo(env,'<mes:ReadEnterpriseByPhonemeRequest>'+parts+'<mes:TypeOfEnterprise>ELP</mes:TypeOfEnterprise><mes:ActiveFilter>true</mes:ActiveFilter></mes:ReadEnterpriseByPhonemeRequest>');return json({rawResponse:xml,notice:'KBO-response; parsing en tokenvalidatie nog te implementeren'});}catch(e){return json({error:e.message},503)}}
 if(u.pathname.startsWith('/api/'))return json({error:'API nog niet geactiveerd: Entra-tokenvalidatie en D1-endpoints ontbreken.'},501);
 return env.ASSETS?env.ASSETS.fetch(req):json({error:'Frontend niet gebouwd'},404);
}};