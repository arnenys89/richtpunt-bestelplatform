# Richtpunt Bestelplatform

React + Vite frontend voor interne bestellingen binnen Richtpunt (campussen Ninove en Zottegem), met Cloudflare Workers en D1 als beoogde productiebackend.

## Uitgewerkte schermen

- **Overzicht:** aantallen, openstaande aanvragen, recente bestellingen en statusverdeling.
- **Nieuwe bestelling:** campus, motivatie, artikelregels, hoeveelheden, verantwoording en maximaal drie leveranciersvoorstellen.
- **Mijn bestellingen:** lijst, detailweergave, status, gekoppelde aankopen en herbestellen.
- **Artikelenbibliotheek:** artikelen toevoegen, wijzigen en activeren/deactiveren.
- **Aankopers:** aankoop aan een bestelregel koppelen, leverancier en besteldatum vastleggen, bestelbonnummer registreren, leverstatus opvolgen, opmerkingen bewaren en filteren op status/leverancier/periode.
- **Instellingen:** demo-gebruikers en rollen, campuslijst, artikelcategorieën en bestelvoorkeuren.

Er worden in het aankoopregister bewust geen bedragen of facturen bijgehouden.

## Lokaal ontwikkelen

```bash
npm install
npm run dev
npm run build
```

## Huidige functionele status

De frontend haalt de identiteit, bestellingen en artikellijst op via de Cloudflare Access-beveiligde API. Nieuwe bestellingen en aankopen worden centraal in Cloudflare D1 bewaard. De lokale browseropslag wordt alleen nog gebruikt wanneer de API-identiteit niet beschikbaar is; die lokale demonstratiegegevens worden niet automatisch met D1 samengevoegd. Instellingen en volledig artikelbeheer zijn nog niet volledig aangesloten op D1.

## D1-databank

De bestaande basisschema's staan in `db/schema.sql`. Het aankoopregister staat in `db/0002_purchase_register.sql`. Voer de migratie pas uit nadat de basisschema's op de D1-database zijn toegepast:

```bash
npx wrangler d1 execute richtpunt-bestelplatform --remote --file=./db/schema.sql
npx wrangler d1 execute richtpunt-bestelplatform --remote --file=./db/0002_purchase_register.sql
```

De oudere afbeeldingsmigratie staat in `db/z_image_assets.sql` en moet alleen worden uitgevoerd wanneer de afbeeldingsfunctionaliteit wordt gebruikt en de kolommen nog niet bestaan.

## Nog vereist voor productie

1. Cloudflare Access-teamdomein, Access AUD en publieke origin instellen als Worker-variabelen.
2. De Access-app en policy instellen zodat alleen de juiste schoolgebruikers toegang krijgen.
3. De D1-migraties uitvoeren en de eerste beheerderrol toekennen.
4. Campus- en categoriegebonden autorisatie afdwingen via `buyer_assignments`.
5. Instellingen en artikelbeheer volledig aan de API koppelen.
6. KBO Public Search SOAP-response correct parsen en valideren.
7. Geautomatiseerde tests, beveiligingscontrole en acceptatietest uitvoeren vóór publicatie.

## Bestaande afbeeldingsopslag

De bestaande image-import gebruikt GitHub-opslag onder `public/uploads/`. De Worker-route vereist de secrets `GITHUB_TOKEN` en `IMAGE_ADMIN_TOKEN`. Zet deze nooit in frontendcode. Controleer bij gebruik de licentievoorwaarden van afbeeldingen.


## API-backend met Cloudflare Access

De Worker gebruikt Cloudflare Access als identiteitsprovider. Microsoft Entra ID/MSAL is voor deze versie niet nodig.

### Identiteitscontrole

- Cloudflare Access beschermt de volledige applicatiehostnaam, inclusief `/api/*`.
- Cloudflare Access voegt na een geslaagde aanmelding de header `Cf-Access-Jwt-Assertion` toe.
- De Worker controleert de JWT-handtekening met de publieke sleutels van de Cloudflare Access-teamomgeving en controleert issuer, audience, vervaltijd en subject.
- Het e-mailadres en de subject-ID uit het gevalideerde Access-token worden gekoppeld aan een gebruiker in D1. Nieuwe accounts krijgen standaard de rol `staff`.
- Een bestaande account met hetzelfde e-mailadres maar een andere identiteitskoppeling wordt niet automatisch samengevoegd.

### Cloudflare-configuratie

Configureer in Cloudflare Workers (Settings → Variables and Secrets) de volgende variabelen met de waarden uit Cloudflare Zero Trust. Je kunt ze ook toevoegen aan een lokale, niet-gecommitte `wrangler`-omgeving:

De bestaande instellingen uit jouw Cloudflare-dashboard zijn in `wrangler.toml` overgenomen:

- `CF_ACCESS_TEAM_DOMAIN`: `sapoov.cloudflareaccess.com`.
- `CF_ACCESS_AUD`: de AUD-tag van de bestaande Access-app **Bestelplatform**.
- `APP_ORIGIN`: `https://richtpunt-bestelplatform.pages.dev`.

De bestaande Access-app **Bestelplatform** beschermt `richtpunt-bestelplatform.pages.dev`. De huidige Allow-policy laat e-mailadressen met domein `ptiz.be` toe. De Worker en frontend moeten nog samen op deze hostnaam worden aangesloten en daarna getest.

### API-routes

- `GET /api/me`: identiteit en rol van de aangemelde gebruiker.
- `GET/POST /api/orders` en `PATCH /api/orders/:id`: bestellingen ophalen, indienen en status wijzigen.
- `GET/POST /api/purchases` en `PATCH /api/purchases/:id`: aankopen met bestelbonnummer, leverancier, besteldatum en status.
- `GET/POST /api/catalog` en `PATCH /api/catalog/:id`: artikelen.
- `GET /api/users`, `PATCH /api/users/:id` en `GET/PUT /api/settings`: beheerderroutes.

### Database en eerste beheerder

Voer de D1-migraties uit nadat je gecontroleerd hebt welke al toegepast zijn:

```bash
npx wrangler d1 migrations list richtpunt-bestelplatform --remote
npx wrangler d1 migrations apply richtpunt-bestelplatform --remote
```

De eerste gebruiker wordt automatisch als aanvrager aangemaakt. Ken de eerste beheerderrol handmatig toe nadat die gebruiker zich minstens één keer via Cloudflare Access heeft aangemeld. Zoek het e-mailadres op in D1 en voer daarna een gecontroleerde SQL-update uit:

```sql
UPDATE users SET role='admin', campus='Beide campussen' WHERE lower(email)=lower('beheerder@school.be');
```

### Huidige grenzen

De frontend haalt bij het laden de identiteit, bestellingen en artikellijst via de API op. Nieuwe bestellingen en aankopen worden via D1 opgeslagen. Niet alle bestaande instellingen- en artikelbeheerschermen zijn al volledig gekoppeld aan de API. Fijnmazige campus-/categorie-autorisatie via `buyer_assignments`, KBO-responsparsing, integratietests en volledige end-to-endtests moeten nog worden afgewerkt. Voer geen echte productiegegevens in vooraleer die controles zijn uitgevoerd.
