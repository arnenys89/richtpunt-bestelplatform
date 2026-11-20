const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
  "access-control-allow-headers": "content-type,authorization"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", ...cors }
});
const esc = s => String(s).replace(/[<>&'"]/g, c => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
}[c]));
const val = (x, t) => {
  const m = x.match(new RegExp("<(?:[\\\\w]+:)?" + t + "[^>]*>([\\\\s\\\\S]*?)<\\\\/(?:[\\\\w]+:)?" + t + ">", "i"));
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
};
async function kbo(env, body) {
  if (!env.KBO_USERNAME || !env.KBO_PASSWORD || !env.KBO_ENDPOINT) throw Error("KBO niet geconfigureerd");
  const created = new Date().toISOString(), nonce = crypto.getRandomValues(new Uint8Array(16)), enc = new TextEncoder();
  const pass = enc.encode(created + env.KBO_PASSWORD), input = new Uint8Array(nonce.length + pass.length);
  input.set(nonce); input.set(pass, nonce.length);
  const digest = await crypto.subtle.digest("SHA-1", input);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest))), n64 = btoa(String.fromCharCode(...nonce));
  const xml = '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" xmlns:mes="http://economie.fgov.be/kbopub/webservices/v1/messages"><soap:Header><wsse:Security><wsu:Timestamp><wsu:Created>' + created + '</wsu:Created></wsu:Timestamp><wsse:UsernameToken><wsse:Username>' + esc(env.KBO_USERNAME) + '</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">' + b64 + '</wsse:Password><wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' + n64 + '</wsse:Nonce><wsu:Created>' + created + '</wsu:Created></wsse:UsernameToken></wsse:Security><mes:RequestContext><mes:Id>' + crypto.randomUUID() + '</mes:Id><mes:Language>nl</mes:Language></mes:RequestContext></soap:Header><soap:Body>' + body + '</soap:Body></soap:Envelope>';
  const r = await fetch(env.KBO_ENDPOINT, { method: "POST", headers: { "content-type": "text/xml; charset=utf-8" }, body: xml });
  const txt = await r.text();
  if (!r.ok || txt.includes(":Fault")) throw Error(val(txt, "faultstring") || "KBO HTTP " + r.status);
  return txt;
}
function imageCandidates(html) {
  const found = [];
  for (const m of html.matchAll(/imgurl=([^&"\\\s]+)/g)) {
    try {
      const u = decodeURIComponent(m[1].replace(/&amp;/g, "&"));
      if (/^https?:\/\//i.test(u) && !found.includes(u)) found.push(u);
    } catch {}
  }
  return found.slice(0, 8);
}
function b64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
async function importImage(req, env) {
  if (!env.IMAGE_ADMIN_TOKEN || req.headers.get("authorization") !== "Bearer " + env.IMAGE_ADMIN_TOKEN) {
    return json({ error: "Niet gemachtigd." }, 401);
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY || !env.DB) {
    return json({ error: "Afbeeldingenopslag is nog niet volledig geconfigureerd." }, 503);
  }
  const body = await req.json();
  const kind = body.kind, entityId = String(body.entityId || "").trim(), query = String(body.query || "").trim();
  if (!["article", "supplier"].includes(kind) || !entityId || !query || query.length > 180) {
    return json({ error: "Geef een geldig type, record-ID en zoekterm op." }, 400);
  }
  const [owner, repo] = env.GITHUB_REPOSITORY.split("/");
  if (!owner || !repo) return json({ error: "GITHUB_REPOSITORY moet owner/repository bevatten." }, 503);

  const searchUrl = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(query);
  const search = await fetch(searchUrl, { headers: { "user-agent": "Mozilla/5.0 (compatible; RichtpuntBestelplatform/1.0)" } });
  if (!search.ok) return json({ error: "Google Afbeeldingen gaf HTTP " + search.status + "." }, 502);
  const candidates = imageCandidates(await search.text());
  if (!candidates.length) return json({ error: "Geen bruikbare afbeeldingsresultaten gevonden. Google kan scraping blokkeren of zijn paginaformaat wijzigen." }, 404);

  let imageResponse = null;
  for (const candidate of candidates) {
    try {
      const u = new URL(candidate);
      if (!["http:", "https:"].includes(u.protocol) || !u.hostname || u.hostname === "localhost") continue;
      const r = await fetch(u.toString(), { headers: { "user-agent": "Mozilla/5.0 (compatible; RichtpuntBestelplatform/1.0)" }, redirect: "follow" });
      const type = (r.headers.get("content-type") || "").split(";")[0].toLowerCase();
      const length = Number(r.headers.get("content-length") || 0);
      if (!r.ok || !type.startsWith("image/") || type === "image/svg+xml" || length > 4 * 1024 * 1024) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (!bytes.length || bytes.length > 4 * 1024 * 1024) continue;
      imageResponse = { bytes, type };
      break;
    } catch {}
  }
  if (!imageResponse) return json({ error: "De gevonden afbeeldingen konden niet veilig als afbeeldingsbestand worden opgehaald." }, 502);

  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[imageResponse.type];
  if (!ext) return json({ error: "Alleen JPEG, PNG, WebP en GIF worden ondersteund." }, 415);
  const safeId = entityId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  if (!safeId) return json({ error: "Ongeldig record-ID." }, 400);
  const path = "public/uploads/" + (kind === "article" ? "articles" : "suppliers") + "/" + safeId + "." + ext;
  const api = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;
  const existing = await fetch(api, { headers: { authorization: "Bearer " + env.GITHUB_TOKEN, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } });
  let sha;
  if (existing.ok) sha = (await existing.json()).sha;
  else if (existing.status !== 404) return json({ error: "GitHub kon de opslaglocatie niet controleren (HTTP " + existing.status + ")." }, 502);
  const payload = { message: "Store image for " + kind + " " + safeId, content: b64(imageResponse.bytes) };
  if (sha) payload.sha = sha;
  const saved = await fetch(api, {
    method: "PUT",
    headers: { authorization: "Bearer " + env.GITHUB_TOKEN, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28" },
    body: JSON.stringify(payload)
  });
  if (!saved.ok) return json({ error: "GitHub kon de afbeelding niet bewaren (HTTP " + saved.status + "). Controleer de tokenrechten." }, 502);
  const imageUrl = "https://raw.githubusercontent.com/" + owner + "/" + repo + "/main/" + path;
  const table = kind === "article" ? "catalog_items" : "suppliers";
  const result = await env.DB.prepare("UPDATE " + table + " SET image_url = ? WHERE id = ?").bind(imageUrl, safeId).run();
  if (!result.meta || result.meta.changes === 0) {
    return json({ error: "Afbeelding is op GitHub opgeslagen, maar het bijbehorende record werd niet gevonden in D1.", imageUrl, path }, 409);
  }
  await env.DB.prepare("INSERT INTO image_assets (entity_type, entity_id, repository_path, image_url, content_type) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entity_type, entity_id) DO UPDATE SET repository_path=excluded.repository_path, image_url=excluded.image_url, content_type=excluded.content_type, updated_at=CURRENT_TIMESTAMP")
    .bind(kind, safeId, path, imageUrl, imageResponse.type).run();
  return json({ ok: true, imageUrl, path, storage: "GitHub repository" });
}

function b64url(s){return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0))}
function decodePart(s){return JSON.parse(new TextDecoder().decode(b64url(s)))}
async function authenticate(req,env){
 const token=req.headers.get("Cf-Access-Jwt-Assertion");
 if(!token)throw Object.assign(new Error("Geen Cloudflare Access-identiteit gevonden. Meld je aan via de beveiligde website."),{status:401});
 const parts=token.split(".");if(parts.length!==3)throw Object.assign(new Error("Ongeldig Cloudflare Access-token."),{status:401});
 let head,claims;try{head=decodePart(parts[0]);claims=decodePart(parts[1])}catch{throw Object.assign(new Error("Ongeldig Cloudflare Access-token."),{status:401})}
 const team=(env.CF_ACCESS_TEAM_DOMAIN||"").replace(/^https?:\/\//,"").replace(/\/$/,"");
 const expectedAud=env.CF_ACCESS_AUD;
 if(!team||!expectedAud)throw Object.assign(new Error("Cloudflare Access is nog niet geconfigureerd. Stel CF_ACCESS_TEAM_DOMAIN en CF_ACCESS_AUD in als Worker-variabelen."),{status:503});
 const issuer="https://"+team;
 const now=Math.floor(Date.now()/1000);
 const aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
 if(claims.iss!==issuer||!aud.includes(expectedAud)||!claims.sub||!claims.exp||claims.exp<now-60||claims.nbf>now+60)
  throw Object.assign(new Error("Cloudflare Access-token is ongeldig, verlopen of voor een andere toepassing bestemd."),{status:401});
 const certs=await fetch(issuer+"/cdn-cgi/access/certs",{cf:{cacheTtl:3600,cacheEverything:true}}).then(r=>{if(!r.ok)throw Error("Cloudflare Access-certificaten niet beschikbaar.");return r.json()});
 const jwk=certs.keys.find(k=>k.kid===head.kid);
 if(!jwk||head.alg!=="RS256")throw Object.assign(new Error("Cloudflare Access-tokenondertekening niet herkend."),{status:401});
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64url(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
 if(!ok)throw Object.assign(new Error("Cloudflare Access-tokenhandtekening ongeldig."),{status:401});
 const email=String(claims.email||"").toLowerCase(),name=claims.name||email||"Gebruiker";
 if(!email)throw Object.assign(new Error("Cloudflare Access heeft geen e-mailadres meegestuurd."),{status:403});
 const identity="cloudflare:"+claims.sub;
 let user=await env.DB.prepare("SELECT id,entra_oid,email,display_name,role,campus,active FROM users WHERE entra_oid=?").bind(identity).first();
 if(!user){
  const byEmail=await env.DB.prepare("SELECT id,entra_oid,email,display_name,role,campus,active FROM users WHERE lower(email)=lower(?)").bind(email).first();
  if(byEmail)throw Object.assign(new Error("Dit e-mailadres bestaat al met een andere identiteitskoppeling. Laat een beheerder de accountkoppeling controleren."),{status:409});
  const uid=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id,entra_oid,email,display_name,role,campus,active) VALUES (?,?,?,?, 'staff',NULL,1)").bind(uid,identity,email,name).run();
  user={id:uid,entra_oid:identity,email,display_name:name,role:"staff",campus:null,active:1};
 }
 if(!user.active)throw Object.assign(new Error("Je account is gedeactiveerd. Contacteer de beheerder."),{status:403});
 return user;
}
const requireRole=(user,...roles)=>{if(!roles.includes(user.role))throw Object.assign(new Error("Je hebt onvoldoende rechten voor deze actie."),{status:403})};
const bodyJson=async req=>{try{return await req.json()}catch{throw Object.assign(new Error("Ongeldige JSON-inhoud."),{status:400})}};
const clean=(v,max=500)=>String(v??"").trim().slice(0,max);
function validEan13(value){const s=String(value??"").trim();if(!/^\d{13}$/.test(s))return false;let sum=0;for(let i=0;i<12;i++)sum+=Number(s[i])*(i%2===0?1:3);return (10-(sum%10))%10===Number(s[12])}
async function api(req,env,user,url){
 const path=url.pathname,method=req.method;
 if(path==="/api/me"&&method==="GET")return json({user});
 if(path==="/api/catalog"&&method==="GET"){
  const rows=await env.DB.prepare("SELECT id,name,ean_code,category,description,unit,active FROM catalog_items WHERE active=1 ORDER BY category,name").all();return json({items:rows.results||[]});
 }
 if(path==="/api/catalog"&&method==="POST"){
  requireRole(user,"buyer","admin");const b=await bodyJson(req);if(!clean(b.name,180))return json({error:"Artikelnaam ontbreekt."},400);
  const ean=clean(b.eanCode,13);if(ean&&!validEan13(ean))return json({error:"Vul een geldige EAN-13-code van 13 cijfers in."},400);
  const id=crypto.randomUUID();try{await env.DB.prepare("INSERT INTO catalog_items (id,name,ean_code,category,description,unit,active,created_by) VALUES (?,?,?,?,?,?,1,?)").bind(id,clean(b.name,180),ean||null,clean(b.category,100),clean(b.description,1000),clean(b.unit,40)||"stuk",user.id).run()}catch(e){if(/unique/i.test(e.message))return json({error:"Deze EAN-code is al aan een ander artikel gekoppeld."},409);throw e}return json({id},201);
 }
 let m=path.match(/^\\/api\\/catalog\\/([^/]+)$/);
 if(m&&method==="PATCH"){requireRole(user,"buyer","admin");const b=await bodyJson(req);const hasEan=Object.prototype.hasOwnProperty.call(b,"eanCode"),ean=clean(b.eanCode,13);if(hasEan&&ean&&!validEan13(ean))return json({error:"Vul een geldige EAN-13-code van 13 cijfers in."},400);try{await env.DB.prepare("UPDATE catalog_items SET name=COALESCE(?,name),ean_code=CASE WHEN ?=1 THEN ? ELSE ean_code END,category=COALESCE(?,category),unit=COALESCE(?,unit),active=COALESCE(?,active) WHERE id=?").bind(b.name?clean(b.name,180):null,hasEan?1:0,ean||null,b.category?clean(b.category,100):null,b.unit?clean(b.unit,40):null,typeof b.active==="boolean"?(b.active?1:0):null,m[1]).run()}catch(e){if(/unique/i.test(e.message))return json({error:"Deze EAN-code is al aan een ander artikel gekoppeld."},409);throw e}return json({ok:true})}
 if(path==="/api/orders"&&method==="GET"){
  const rows=user.role==="admin"||user.role==="buyer"
   ?await env.DB.prepare("SELECT o.*,u.display_name requester_name FROM orders o JOIN users u ON u.id=o.requester_id ORDER BY o.created_at DESC").all()
   :await env.DB.prepare("SELECT o.*,u.display_name requester_name FROM orders o JOIN users u ON u.id=o.requester_id WHERE o.requester_id=? ORDER BY o.created_at DESC").bind(user.id).all();
  const orders=await Promise.all((rows.results||[]).map(async o=>{const items=await env.DB.prepare("SELECT oi.id,oi.catalog_item_id,oi.item_name,oi.quantity,oi.unit,oi.status,oi.buyer_note,ci.ean_code FROM order_items oi LEFT JOIN catalog_items ci ON ci.id=oi.catalog_item_id WHERE oi.order_id=? ORDER BY oi.created_at").bind(o.id).all();return{...o,items:items.results||[]}}));
  return json({orders});
 }
 if(path==="/api/orders"&&method==="POST"){
  const b=await bodyJson(req);const title=clean(b.title,180),items=Array.isArray(b.items)?b.items:[];
  if(!title||!["Ninove","Zottegem","Beide campussen"].includes(b.campus)||!items.length||items.length>100)return json({error:"Controleer titel, campus en bestelregels."},400);
  const orderId=crypto.randomUUID(),statements=[env.DB.prepare("INSERT INTO orders (id,requester_id,title,campus,motivation,status) VALUES (?,?,?,?,?,'submitted')").bind(orderId,user.id,title,b.campus,clean(b.motivation,3000))];
  for(const item of items){if(!clean(item.name,180)||!Number.isFinite(Number(item.quantity))||Number(item.quantity)<=0)return json({error:"Elke bestelregel moet een naam en positief aantal bevatten."},400);
   statements.push(env.DB.prepare("INSERT INTO order_items (id,order_id,catalog_item_id,item_name,quantity,unit,status) VALUES (?,?,?,?,?,?,'pending')").bind(crypto.randomUUID(),orderId,item.catalogItemId||null,clean(item.name,180),Number(item.quantity),clean(item.unit,40)||"stuk"));
  }
  statements.push(env.DB.prepare("INSERT INTO order_events (id,order_id,actor_id,event_type,message) VALUES (?,?,?,'submitted',?)").bind(crypto.randomUUID(),orderId,user.id,"Bestelling ingediend"));
  await env.DB.batch(statements);return json({id:orderId},201);
 }
 m=path.match(/^\/api\/orders\/([^/]+)$/);
 if(m&&method==="PATCH"){
  const b=await bodyJson(req);const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(m[1]).first();if(!order)return json({error:"Bestelling niet gevonden."},404);
  if(user.role==="staff"&&order.requester_id!==user.id)requireRole(user,"admin");
  const allowed=["submitted","in_review","approved","ordered","partially_delivered","delivered","cancelled"];
  if(!allowed.includes(b.status))return json({error:"Ongeldige bestelstatus."},400);
  if(user.role==="staff"&&b.status!=="cancelled")requireRole(user,"admin");
  await env.DB.batch([env.DB.prepare("UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.status,m[1]),env.DB.prepare("INSERT INTO order_events (id,order_id,actor_id,event_type,message) VALUES (?,?,?,'status_changed',?)").bind(crypto.randomUUID(),m[1],user.id,"Status gewijzigd naar "+b.status)]);
  return json({ok:true});
 }
 if(path==="/api/purchases"&&method==="GET"){
  requireRole(user,"buyer","admin");
  const rows=await env.DB.prepare("SELECT p.*,s.name supplier_name,oi.item_name,o.title order_title,o.campus FROM purchases p JOIN suppliers s ON s.id=p.supplier_id JOIN order_items oi ON oi.id=p.order_item_id JOIN orders o ON o.id=oi.order_id ORDER BY p.purchase_date DESC").all();return json({purchases:rows.results||[]});
 }
 if(path==="/api/purchases"&&method==="POST"){
  requireRole(user,"buyer","admin");const b=await bodyJson(req);
  if(!b.orderItemId||!clean(b.supplier,180)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(b.date)||!["besteld","gedeeltelijk_geleverd","geleverd","geannuleerd"].includes(b.status))return json({error:"Controleer bestelregel, leverancier, datum en status."},400);
  const item=await env.DB.prepare("SELECT oi.id,oi.order_id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.id=?").bind(b.orderItemId).first();if(!item)return json({error:"Bestelregel niet gevonden."},404);
  let supplier=await env.DB.prepare("SELECT id FROM suppliers WHERE lower(name)=lower(?) LIMIT 1").bind(clean(b.supplier,180)).first();
  if(!supplier){const sid=crypto.randomUUID();await env.DB.prepare("INSERT INTO suppliers (id,name,source) VALUES (?,?,'manual')").bind(sid,clean(b.supplier,180)).run();supplier={id:sid}}
  const pid=crypto.randomUUID();
  await env.DB.batch([env.DB.prepare("INSERT INTO purchases (id,order_item_id,supplier_id,purchase_order_number,purchase_date,status,note,created_by) VALUES (?,?,?,?,?,?,?,?)").bind(pid,item.id,supplier.id,clean(b.number,100)||null,b.date,b.status,clean(b.note,2000),user.id),env.DB.prepare("UPDATE order_items SET status=?,buyer_id=?,buyer_note=? WHERE id=?").bind(b.status,item.id,user.id,clean(b.note,2000),item.id),env.DB.prepare("INSERT INTO order_events (id,order_id,order_item_id,actor_id,event_type,message) VALUES (?,?,?,?,'purchase_registered',?)").bind(crypto.randomUUID(),item.order_id,item.id,user.id,"Aankoop geregistreerd; bestelbon "+clean(b.number,100))]);
  return json({id:pid},201);
 }
 m=path.match(/^\/api\/purchases\/([^/]+)$/);
 if(m&&method==="PATCH"){requireRole(user,"buyer","admin");const b=await bodyJson(req);if(!["besteld","gedeeltelijk_geleverd","geleverd","geannuleerd"].includes(b.status))return json({error:"Ongeldige aankoopstatus."},400);await env.DB.prepare("UPDATE purchases SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.status,m[1]).run();return json({ok:true})}
 if(path==="/api/users"&&method==="GET"){requireRole(user,"admin");const rows=await env.DB.prepare("SELECT id,email,display_name,role,campus,active FROM users ORDER BY display_name").all();return json({users:rows.results||[]})}
 if(path.startsWith("/api/users/")&&method==="PATCH"){requireRole(user,"admin");const uid=path.split("/").pop(),b=await bodyJson(req);if(!["staff","buyer","admin"].includes(b.role))return json({error:"Ongeldige rol."},400);await env.DB.prepare("UPDATE users SET role=?,campus=?,active=? WHERE id=?").bind(b.role,clean(b.campus,100)||null,b.active===false?0:1,uid).run();return json({ok:true})}
 if(path==="/api/settings"&&method==="GET"){requireRole(user,"admin");const rows=await env.DB.prepare("SELECT setting_key,setting_value FROM app_settings ORDER BY setting_key").all();return json({settings:rows.results||[]})}
 if(path==="/api/settings"&&method==="PUT"){requireRole(user,"admin");const b=await bodyJson(req);if(!b.key||typeof b.value!=="string")return json({error:"Ongeldige instelling."},400);await env.DB.prepare("INSERT INTO app_settings(setting_key,setting_value,updated_by) VALUES(?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(clean(b.key,100),b.value.slice(0,4000),user.id).run();return json({ok:true})}
 return json({error:"API-route niet gevonden."},404);
}
export default {
 async fetch(req,env){
  const u=new URL(req.url);
  const origin=env.APP_ORIGIN||"*";
  const headers={"access-control-allow-origin":origin,"access-control-allow-methods":"GET,POST,PATCH,PUT,OPTIONS","access-control-allow-headers":"content-type,authorization","vary":"Origin"};
  if(req.method==="OPTIONS")return new Response(null,{headers});
  if(u.pathname==="/api/health")return json({ok:true,app:env.APP_NAME||"Richtpunt Bestelplatform",cloudflareAccessConfigured:!!(env.CF_ACCESS_TEAM_DOMAIN&&env.CF_ACCESS_AUD),databaseConfigured:!!env.DB,kboConfigured:!!(env.KBO_USERNAME&&env.KBO_PASSWORD&&env.KBO_ENDPOINT)});
  if(u.pathname==="/api/images/import"&&req.method==="POST"){try{return await importImage(req,env)}catch(e){return json({error:e.message||"Afbeeldingsimport mislukt."},500)}}
  if(u.pathname==="/api/kbo/search"&&req.method==="GET"){try{const terms=(u.searchParams.get("q")||"").trim().split(/\s+/).filter(Boolean).slice(0,10);if(!terms.length)return json({results:[]});const parts=terms.map(t=>"<mes:Phoneme>"+esc(t)+"</mes:Phoneme>").join("");const xml=await kbo(env,"<mes:ReadEnterpriseByPhonemeRequest>"+parts+"<mes:TypeOfEnterprise>ELP</mes:TypeOfEnterprise><mes:ActiveFilter>true</mes:ActiveFilter></mes:ReadEnterpriseByPhonemeRequest>");return json({rawResponse:xml,notice:"KBO SOAP-resultaat; bedrijfsgegevens moeten nog verder worden uitgelezen."})}catch(e){return json({error:e.message},503)}}
  if(u.pathname.startsWith("/api/")){if(!env.DB)return json({error:"D1-databasebinding ontbreekt."},503);try{const user=await authenticate(req,env);const response=await api(req,env,user,u);const safeHeaders=new Headers(response.headers);safeHeaders.set("access-control-allow-origin",env.APP_ORIGIN||"null");safeHeaders.set("vary","Origin");return new Response(response.body,{status:response.status,statusText:response.statusText,headers:safeHeaders})}catch(e){const response=json({error:e.message||"Interne API-fout."},e.status||500);const safeHeaders=new Headers(response.headers);safeHeaders.set("access-control-allow-origin",env.APP_ORIGIN||"null");safeHeaders.set("vary","Origin");return new Response(response.body,{status:response.status,statusText:response.statusText,headers:safeHeaders})}}
  return env.ASSETS?env.ASSETS.fetch(req):json({error:"Frontend niet gebouwd."},404);
 }
};
