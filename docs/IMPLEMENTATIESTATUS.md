# Implementatiestatus — Richtpunt Bestelplatform

Laatste codecontrole: 21 november 2026. Dit document maakt onderscheid tussen code, productieconfiguratie en praktijktests. Een geslaagde build geldt niet als bewijs van een volledige functionele acceptatietest.

## Functionele implementatie in de repository

| Onderdeel | Status | Opmerking |
|---|---|---|
| Cloudflare Access-authenticatie | Aanwezig | JWT-validatie server-side; accounts worden bij eerste aanmelding aangemaakt. |
| Superadmin Arne Nys | Aanwezig | Exacte geverifieerde identiteit arne.nys@ptiz.be wordt server-side beschermd als actieve admin. |
| Rollen en gebruikersbeheer | Aanwezig | Aanvrager, aankoper, beheerder, campus en actieve status. |
| Teams en teamleden | Aanwezig | Meerdere teams per gebruiker; meerdere leden en coördinatoren per team. |
| Coördinatorrol | Gedeeltelijk | Rol kan toegewezen en bewaard worden; er is nog geen afzonderlijke autorisatiematrix voor coördinatoren. |
| Aankopersrechten | Gedeeltelijk | Campus/team/categorie-toewijzingen en server-side controles; volledige matrix vraagt nog acceptatietests met echte accounts. |
| Bestellingen en bestelregels | Aanwezig | Team, campus, titel, motivatie, algemene opmerkingen, aantal, eenheid en verplichte verantwoording. |
| Leveranciersvoorstellen | Aanwezig | Maximaal drie per bestelregel. |
| Statusworkflow | Gedeeltelijk | Server valideert toegestane overgangen; uitzonderings- en herstelprocessen moeten nog door gebruikers worden geaccepteerd. |
| Annuleren door aanvrager | Aanwezig | Alleen eigen aanvraag en alleen in vroege statussen. |
| Informatieverzoeken | Aanwezig | Vraag en antwoord blijven bewaard en worden in het logboek opgenomen. |
| Bestellogboek | Gedeeltelijk | Bestelling, status, informatieverzoeken, aankoop en leveringen worden geregistreerd; wijzigingen aan alle beheerobjecten worden nog niet allemaal gelogd. |
| Artikelenbibliotheek | Aanwezig | EAN-13-validatie en uniciteit, categorie, omschrijving, specificaties, eenheid, afbeelding en leverancierskoppelingen. |
| Zoeken artikelen | Aanwezig | Zoeken op naam, EAN en categorie (categorie via zoekveld). |
| Historische artikelgegevens | Aanwezig voor nieuwe bestellingen | EAN en afbeeldings-URL worden als snapshot op de bestelregel opgeslagen. Bestaande regels zijn waar mogelijk aangevuld vanuit de huidige artikelfiche. |
| Leveranciersbibliotheek | Aanwezig | Handmatig beheer, unieke Belgische ondernemingsnummers, KBO-zoekresultaten en expliciete toevoeging. |
| KBO-verbinding | Configuratie geblokkeerd | Productiesecrets KBO_USERNAME en KBO_PASSWORD ontbreken nog; KBO-endpoint is ingesteld. |
| Aankoopregister | Aanwezig | Leverancier, bestelbonnummer, besteldatum, status en opmerkingen; geen bedragen of facturen. |
| Filters aankoopregister | Aanwezig | Status, leverancier, campus, team en datumperiode. |
| Meerdere deelleveringen | Aanwezig in code | Afzonderlijke leveringsrecords met aantal, datum en opmerking; server controleert dat totaal niet boven bestelde hoeveelheid uitkomt. |
| Afbeeldingen kiezen | Aanwezig in code | Zoekresultaten worden eerst als voorstellen getoond; gebruiker bevestigt expliciet de gekozen afbeelding. |
| Afbeeldingenopslag | Gedeeltelijk getest | R2-binding is geconfigureerd; volledige productiepraktijktest met echte afbeeldingen moet nog gebeuren. |
| Centrale instellingen | Gedeeltelijk | Campussen, categorieën en herbestelvoorkeur worden in D1 bewaard. Dynamische campuswaarden zijn nog beperkt door vaste campusvalidatie in de API en teamschema. |
| Centrale Google-/Microsoft-/Smartschool-aanmelding | Niet afzonderlijk in de applicatie | De functionele blauwdruk gebruikt Cloudflare Access als identiteitslaag. De gewenste gemeenschappelijke login hangt af van de Identity Provider-configuratie in Cloudflare Access. |

## Productieomgeving

- Cloudflare Pages-project: `richtpunt-bestelplatform`.
- Productie-URL: https://richtpunt-bestelplatform.pages.dev
- GitHub-repository: https://github.com/arnenys89/richtpunt-bestelplatform
- Productiebranch: `main`.
- D1-database: `richtpunt-bestelplatform`.
- R2-bucket: `richtpunt-bestelplatform-images`, regio WEUR.
- Cloudflare Access is geconfigureerd via de bestaande teamdomain en audience.
- Pages Functions routeert de API naar `worker/index.js`.

## D1-migraties

De volgende migraties zijn in productie geregistreerd:
1. `0001_purchase_register.sql`
2. `001_catalog_ean_code.sql`
3. `002_order_item_justification.sql`
4. `003_order_remarks.sql`
5. `004_teams_suppliers_images.sql`
6. `005_image_source_url.sql`
7. `006_deliveries_and_snapshots.sql`

Migratie 006 voegt leveringshistoriek en historische EAN-/afbeeldingssnapshots toe. De migratie is uitgevoerd op de bestaande D1-database en geregistreerd in `d1_migrations`.

## Laatste functionele verbeteringen

- Aankopers krijgen geen gedeeltelijke bestelkoppen meer te zien wanneer niet alle bestelregels binnen hun campus-/team-/categorie-toewijzing vallen.
- Dezelfde volledige-ordercontrole wordt gebruikt bij het openen van bestelcommunicatie en logboek.
- Een aanvrager kan alleen de eigen aanvraag annuleren en alleen in de toegestane vroege statussen.
- Artikel-EAN en afbeelding worden bij indiening als historische bestelregelsnapshot bewaard.
- Meerdere deelleveringen kunnen met afzonderlijke aantallen en datums worden ingevoerd.
- Het totaal van geregistreerde leveringen kan server-side de bestelde hoeveelheid niet overschrijden.
- Afbeeldingen worden eerst als voorstellen getoond en pas na expliciete keuze opgeslagen.
- Aankoopregister bevat filters voor campus en team.

## Nog te doen vóór volledige ingebruikname

1. Voeg de productiegeheimen `KBO_USERNAME` en `KBO_PASSWORD` toe aan het Cloudflare Pages-project.
2. Voer een KBO-zoektest uit met een bedrijfsnaam en een geldig ondernemingsnummer.
3. Test met echte aanvrager-, aankoper-, coördinator- en beheerdersaccounts.
4. Test expliciet een bestelling met meerdere categorieën en controleer dat een aankoper alleen toegang krijgt wanneer alle bestelregels binnen zijn toewijzing vallen.
5. Voer een volledige R2-upload-, lees- en afbeeldingsselectietest uit.
6. Test meerdere opeenvolgende deelleveringen en de automatische status van bestelregel en bestelling.
7. Beslis of coördinatoren extra rechten moeten krijgen bovenop gewone teamleden.
8. Werk dynamische campusvalidatie en het teamschema af als er naast Ninove en Zottegem extra campussen moeten worden ondersteund.
9. Doorloop de volledige acceptatielijst uit `FUNCTIONELE-BLAUWDRUK.md` op productie.

## Belangrijke beperking

Een geslaagde GitHub-build en een geslaagde Cloudflare Pages-deployment bewijzen dat de code compileert en uitgerold is. Ze bewijzen niet dat alle rollen, externe KBO-authenticatie, R2-opslag en alle gebruikersprocessen met echte accounts succesvol zijn getest. Gebruik het platform pas voor echte bestellingen nadat de resterende productie-acceptatietests zijn uitgevoerd.
