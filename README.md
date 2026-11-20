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

## D1-databank en migraties

Voor een volledig nieuwe D1-database voer je eerst het basisschema één keer uit:

```bash
npx wrangler d1 execute richtpunt-bestelplatform --remote --file=./db/schema.sql
```

Voer daarna de geordende migraties uit vanuit `db/migrations/`:

1. `0001_purchase_register.sql` — aankoopregister en centrale instellingen.
2. `001_catalog_ean_code.sql` — EAN-13.
3. `002_order_item_justification.sql` — verantwoording per bestelregel.
4. `003_order_remarks.sql` — algemene opmerkingen.
5. `004_teams_suppliers_images.sql` — teams, rechten, leverancierskoppelingen, afbeeldingen en technische specificaties.
6. `005_image_source_url.sql` — bronverwijzing van geïmporteerde afbeeldingen.

Controleer vóór uitvoering de bestaande status:

```bash
npx wrangler d1 migrations list richtpunt-bestelplatform --remote
npx wrangler d1 migrations apply richtpunt-bestelplatform --remote
```

De bestaande D1-database bevat het basisschema en de oude afbeeldingskolommen al. De aankoopregistertabellen en verschillende nieuwe velden ontbreken nog. Voer het basisschema niet opnieuw uit op een bestaande database. De rootbestanden `db/0002_purchase_register.sql`, `db/0003_catalog_dan_code.sql`, `db/0004_catalog_ean_code.sql` en `db/z_image_assets.sql` zijn historische bestanden; voer die niet afzonderlijk uit.

## Bestaande afbeeldingsopslag

Afbeeldingen worden bij voorkeur in Cloudflare R2 bewaard via de binding `IMAGES`. Maak de bucket aan met `npx wrangler r2 bucket create richtpunt-bestelplatform-images`. De Worker kan terugvallen op GitHub-opslag wanneer R2 niet is gekoppeld. Afbeeldingsimport vereist een aangemelde aankoper of beheerder. Controleer altijd de gebruiksrechten en bron van een afbeelding; zoekresultaten vormen geen licentiebewijs.


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

### KBO Public Search

Stel de volgende Worker secrets in via Cloudflare:
- `KBO_USERNAME`
- `KBO_PASSWORD`
- `KBO_ENDPOINT`: `https://kbopub.economie.fgov.be/kbopubws180000/services/wsKBOPub`

De KBO-zoekfunctie ondersteunt bedrijfsnaam en ondernemingsnummer. De API verwerkt de SOAP-respons tot een controleerbare lijst met naam, ondernemingsnummer, status en beschikbare adres-/contactvelden. De gebruiker bevestigt zelf welke onderneming aan de leveranciersbibliotheek wordt toegevoegd. Een geldige KBO-account- en requestbalans zijn vereist.

### EAN-codes voor artikelen

Elk artikel kan optioneel een EAN-13-code krijgen. De artikelfiche controleert het formaat en het controlecijfer. De API weigert ongeldige EAN-codes en dubbele codes. De artikellijst en artikelzoekfunctie ondersteunen zoeken op EAN-code; bestelregels tonen de gekoppelde EAN-code.

De migratie `0004_catalog_ean_code.sql` zet de eerdere tijdelijke DAN-kolom om naar `ean_code` en legt een unieke index aan. Voer alle openstaande D1-migraties in volgorde uit voordat de nieuwe Worker-versie wordt gepubliceerd.

### API-routes

- `GET /api/me`: identiteit en rol van de aangemelde gebruiker.
- `GET/POST /api/orders` en `PATCH /api/orders/:id`: bestellingen ophalen, indienen en status wijzigen.
- `GET/POST /api/purchases` en `PATCH /api/purchases/:id`: aankopen met bestelbonnummer, leverancier, besteldatum en status.
- `GET/POST /api/catalog` en `PATCH /api/catalog/:id`: artikelen.
- `GET/PUT /api/catalog/:id/suppliers`: artikel-leverancierskoppelingen.
- `GET/POST /api/teams`, `PATCH /api/teams/:id` en `GET/PUT /api/teams/:id/members`: teams en teamleden.
- `GET/POST /api/suppliers` en `PATCH /api/suppliers/:id`: leveranciers.
- `GET/PUT /api/users/:id/assignments`: aankopersrechten.
- `GET /api/orders/:id/events`, informatieverzoeken en antwoorden: historiek en communicatie.
- `POST /api/images/import` en `GET /api/images/:key`: beveiligde afbeeldingsimport en R2-opslag.
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

### Huidige grenzen en resterende validatie

De code bevat nu centrale instellingen, teambeheer, teamlid/coördinatorbeheer, aankopers-toewijzingen, artikel- en leveranciersfiches, EAN-13, leverancierskoppelingen, KBO-zoekresultaatparsing, informatieverzoeken en een chronologisch bestel-logboek.

De volgende zaken zijn nog niet bewezen of volledig afgewerkt:
- De R2-bucket moet in Cloudflare worden aangemaakt en de binding moet bij deployment worden gevalideerd.
- KBO-verbinding moet met de echte accountgegevens en het productie-endpoint worden getest; zoekresultaten moeten door een gebruiker worden gecontroleerd.
- De volledige autorisatiematrix (met name gecombineerde categorieën op één bestelling) vraagt nog een security review.
- Deelleveringen kunnen als aparte aankooprecords worden opgevolgd, maar er is nog geen afzonderlijke hoeveelheid-per-deelleveringregistratie.
- De afbeeldingsimport selecteert een kandidaat uit zoekresultaten; controleer altijd bron en gebruiksrechten.
- Er is nog geen geslaagde build-, integratie- of end-to-endtest aangetoond.

Voer geen echte productiegegevens in en publiceer niet voordat migraties, R2, Cloudflare Access, rechtenmatrix en acceptatietests zijn gecontroleerd.


## Functionele uitwerking

De volledige functionele blauwdruk en acceptatiecriteria staan in [docs/FUNCTIONELE-BLAUWDRUK.md](docs/FUNCTIONELE-BLAUWDRUK.md). De gecontroleerde code-/productiestatus en resterende blokkeringen staan in [docs/IMPLEMENTATIESTATUS.md](docs/IMPLEMENTATIESTATUS.md). De huidige implementatie is een ontwikkelversie. Niet alle acceptatietests zijn uitgevoerd; voer geen productiegegevens in en publiceer niet voordat de D1-migraties, R2-bucket, rechtenmatrix en end-to-endtests zijn gecontroleerd.
