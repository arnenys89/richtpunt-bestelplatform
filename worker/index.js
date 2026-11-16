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
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (u.pathname === "/api/health") return json({
      ok: true, app: env.APP_NAME || "Richtpunt Bestelplatform",
      kboConfigured: !!(env.KBO_USERNAME && env.KBO_PASSWORD && env.KBO_ENDPOINT),
      imageStorageConfigured: !!(env.GITHUB_TOKEN && env.GITHUB_REPOSITORY && env.IMAGE_ADMIN_TOKEN)
    });
    if (u.pathname === "/api/images/import" && req.method === "POST") {
      try { return await importImage(req, env); }
      catch (e) { return json({ error: e.message || "Onverwachte fout bij afbeeldingsimport." }, 500); }
    }
    if (u.pathname === "/api/kbo/search" && req.method === "GET") {
      try {
        const terms = (u.searchParams.get("q") || "").trim().split(/\s+/).filter(Boolean).slice(0, 10);
        if (!terms.length) return json({ results: [] });
        const parts = terms.map(t => "<mes:Phoneme>" + esc(t) + "</mes:Phoneme>").join("");
        const xml = await kbo(env, "<mes:ReadEnterpriseByPhonemeRequest>" + parts + "<mes:TypeOfEnterprise>ELP</mes:TypeOfEnterprise><mes:ActiveFilter>true</mes:ActiveFilter></mes:ReadEnterpriseByPhonemeRequest>");
        return json({ rawResponse: xml, notice: "KBO-response; parsing en tokenvalidatie nog te implementeren" });
      } catch (e) { return json({ error: e.message }, 503); }
    }
    if (u.pathname.startsWith("/api/")) return json({ error: "API nog niet geactiveerd: Entra-tokenvalidatie en overige D1-endpoints ontbreken." }, 501);
    return env.ASSETS ? env.ASSETS.fetch(req) : json({ error: "Frontend niet gebouwd" }, 404);
  }
};