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


## Afbeeldingen zonder R2

Afbeeldingen kunnen in de GitHub-repository worden bewaard onder `public/uploads/`. De Worker kan een eerste Google Afbeeldingen-resultaat ophalen, het bestand controleren en via de GitHub Contents API committen. De afbeeldings-URL en opslagmetadata worden daarna in D1 bijgewerkt. Er is dus geen R2-bucket of R2-betaalprofiel nodig.

### Eenmalige configuratie

1. Voer de bestaande basisschema's uit als dat nog niet gebeurd is:
   `npx wrangler d1 execute richtpunt-bestelplatform --remote --file=./db/schema.sql`
2. Voer daarna de afbeeldingenmigratie uit:
   `npx wrangler d1 execute richtpunt-bestelplatform --remote --file=./db/z_image_assets.sql`
3. Maak een GitHub fine-grained personal access token voor uitsluitend deze repository, met **Contents: Read and write**.
4. Stel de volgende Worker-variabelen en secrets in:
   - Variabele `GITHUB_REPOSITORY=arnenys89/richtpunt-bestelplatform`
   - Secret `GITHUB_TOKEN`: het GitHub-token uit stap 3
   - Secret `IMAGE_ADMIN_TOKEN`: een eigen lange, willekeurige toegangssleutel
5. De importroute is `POST /api/images/import` met JSON `{ "kind": "article", "entityId": "...", "query": "..." }` of `kind: "supplier"`. De route vereist `Authorization: Bearer <IMAGE_ADMIN_TOKEN>`.

**Beveiliging en beperkingen:** de importroute is bewust niet publiek toegankelijk. De huidige demo heeft nog geen werkende Entra-aanmelding of rolcontrole. Koppel de importknop pas aan de interface nadat server-side gebruikers- en beheerdersautorisatie is afgewerkt; zet de toegangssleutel nooit in frontendcode. Google kan scraping blokkeren of de HTML wijzigen. Controleer ook of je de gevonden afbeelding volgens de licentievoorwaarden mag gebruiken. GitHub-opslag is geschikt voor een beperkte bibliotheek, niet voor grote aantallen of frequente uploads.
