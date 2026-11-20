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

## Huidige functionele status en belangrijke beperking

De huidige frontend bewaart gegevens in de lokale browseropslag (`localStorage`). Daardoor blijven demo-bestellingen na herladen op hetzelfde toestel en in dezelfde browser beschikbaar. De gegevens worden **niet** gedeeld met andere gebruikers, browsers of toestellen. De gebruikers- en rollenlijst in Instellingen is uitsluitend demonstratief en verleent geen echte toegangsrechten.

De Worker bevat nog geen productieklare D1 CRUD-endpoints of Microsoft Entra ID-tokenvalidatie. De bestaande `/api/*`-fallback geeft voor niet-geïmplementeerde endpoints HTTP 501 terug. De website mag daarom nog niet gebruikt worden voor echte bestellingen of persoonsgegevens en de lokale demo mag niet als beveiligd gebruikersbeheer worden beschouwd.

## D1-databank

De bestaande basisschema's staan in `db/schema.sql`. Het aankoopregister staat in `db/0002_purchase_register.sql`. Voer de migratie pas uit nadat de basisschema's op de D1-database zijn toegepast:

```bash
npx wrangler d1 execute richtpunt-bestelplatform --remote --file=./db/schema.sql
npx wrangler d1 execute richtpunt-bestelplatform --remote --file=./db/0002_purchase_register.sql
```

De oudere afbeeldingsmigratie staat in `db/z_image_assets.sql` en moet alleen worden uitgevoerd wanneer de afbeeldingsfunctionaliteit wordt gebruikt en de kolommen nog niet bestaan.

## Nog vereist voor productie

1. Microsoft Entra ID-aanmelding configureren en access tokens server-side valideren.
2. Autorisatie afdwingen op de server: aanvrager, aankoper en beheerder, met campus- en categoriegebonden rechten.
3. D1 CRUD-endpoints bouwen voor bestellingen, orderregels, leveranciers, aankopen, gebruikers en instellingen.
4. De frontend koppelen aan die API in plaats van browseropslag; foutafhandeling, laadstatussen en gelijktijdige wijzigingen toevoegen.
5. Migraties uitvoeren op de juiste D1-database.
6. KBO Public Search SOAP-response correct parsen en valideren; de huidige KBO-route is nog niet volledig.
7. Geautomatiseerde tests, beveiligingscontrole en acceptatietest uitvoeren vóór publicatie.

## Bestaande afbeeldingsopslag

De bestaande image-import gebruikt GitHub-opslag onder `public/uploads/`. De Worker-route vereist de secrets `GITHUB_TOKEN` en `IMAGE_ADMIN_TOKEN`. Zet deze nooit in frontendcode. Controleer bij gebruik de licentievoorwaarden van afbeeldingen.


## API-backend (nieuw)

De Worker bevat nu beveiligde D1-routes voor:
- `GET /api/me`: valideert het Microsoft Entra v2-toegangstoken en maakt een onbekende gebruiker standaard aan als `staff`.
- `GET/POST /api/orders` en `PATCH /api/orders/:id`: aanvragen lezen, indienen en status wijzigen.
- `GET/POST /api/purchases` en `PATCH /api/purchases/:id`: aankopen registreren met bestelbonnummer, leverancier, besteldatum en status.
- `GET/POST /api/catalog` en `PATCH /api/catalog/:id`: artikelbeheer.
- `GET /api/users`, `PATCH /api/users/:id` en `GET/PUT /api/settings`: beheerderfuncties.

### Entra-configuratie voor de Worker

Configureer vóór gebruik:
- Worker-variabele `MICROSOFT_TENANT_ID`: de tenant-GUID van de schoolorganisatie (niet `common`).
- Worker-variabele `ENTRA_CLIENT_ID`: de Application (client) ID van de Entra-appregistratie.
- Worker-variabele `APP_ORIGIN`: de exacte publieke oorsprong van de website, bijvoorbeeld `https://bestellen.jouwdomein.be`.

De client moet een Microsoft Entra **v2 access token** aanvragen voor deze API met audience gelijk aan `ENTRA_CLIENT_ID`. De Worker controleert handtekening via de tenant-JWKS, issuer, audience, tenant, vervaldatum en object-ID. Nieuwe gebruikers krijgen standaard de rol `staff`; een beheerder moet hun rol daarna toekennen in D1 of via een beveiligde beheerdersinterface.

Voer de migratie uit na het basisschema:
```bash
npx wrangler d1 migrations apply richtpunt-bestelplatform --remote
```
Controleer vooraf met `npx wrangler d1 migrations list richtpunt-bestelplatform --remote` welke migraties Cloudflare ziet.

### Nog niet productie-klaar

De API-laag is toegevoegd, maar de huidige React-schermen gebruiken nog browseropslag en melden zich nog niet aan via MSAL/Entra. Ze roepen de nieuwe D1-endpoints dus nog niet aan. Campus-/categoriegebonden buyer assignments, KBO-responsparsing, CSRF-/originbeleid finaal afstemmen, API-integratietests en end-to-end tests moeten nog worden afgewerkt. De API controleert rollen, maar de fijnmazige campus- en categoriebeperkingen moeten nog worden toegevoegd voordat echte gebruikersgegevens of bestellingen verwerkt worden. Voer de D1-migratie en Worker-deployment niet uit zonder de Entra-configuratie en tests.
