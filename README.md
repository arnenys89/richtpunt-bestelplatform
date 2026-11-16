# Richtpunt Bestelplatform
Eerste prototype voor interne bestellingen binnen Richtpunt (Ninove en Zottegem).

## Stack
- React + Vite
- Cloudflare Workers + D1
- KBO Public Search SOAP R018.08 (backend-integratie in opstartfase)
- Microsoft Entra ID: nog te configureren en server-side te valideren

## Lokaal
`npm install` en `npm run dev`.

## Cloudflare
1. Maak D1-database `richtpunt-bestelplatform`.
2. Vul de echte database-ID in `wrangler.toml`.
3. Voer `npx wrangler d1 execute richtpunt-bestelplatform --remote --file=./db/schema.sql` uit.
4. Configureer Worker Secrets: `KBO_USERNAME`, `KBO_PASSWORD`, `KBO_ENDPOINT`.
5. Configureer Entra ID en implementeer tokenvalidatie vóór productie.
6. `npm run build && npx wrangler deploy`.

## Status
Prototype, niet geschikt voor echte bestellingen of persoonsgegevens. De huidige UI gebruikt demo-informatie. Entra-authenticatie, autorisatie, persistente CRUD, e-mail, volledige KBO SOAP/XML-validatie en securitytests moeten nog worden afgewerkt.
