# Implementatiestatus — Richtpunt Bestelplatform

Laatste codecontrole: 20 november 2026. De codewijzigingen staan in de hoofdbranch `main`. Dit document onderscheidt implementatie in de repository van bewezen werking in de productieomgeving.

## Functionele implementatie

| Onderdeel | Status in code | Opmerking |
|---|---|---|
| Aanmelden via Cloudflare Access | Aanwezig | Worker valideert Access JWT en koppelt gebruikers aan D1. |
| Rollen en gebruikersbeheer | Aanwezig | Beheer van rol, campus en actief/inactief; accounts ontstaan bij eerste aanmelding. |
| Teams, teamleden en coördinatoren | Aanwezig | Eén team per bestelling; teamleden krijgen toegang tot de teamaanvragen. |
| Aankopersrechten | Aanwezig | Toewijzing op campus en categorie; server-side controles in de API. |
| Bestellingen en bestelregels | Aanwezig | Team, campus, motivatie, algemene opmerkingen en verplichte verantwoording. |
| Leveranciersvoorstellen | Aanwezig | Maximaal drie per bestelregel; koppeling aan leveranciersrecords. |
| Bestelworkflow | Aanwezig | Ingediend, in behandeling, informatie gevraagd/ontvangen, goedgekeurd, afgekeurd, besteld, gedeeltelijk geleverd, geleverd en geannuleerd. |
| Informatieverzoeken | Aanwezig | Vraag en antwoord worden bewaard en in de historiek opgenomen. |
| Chronologisch logboek | Aanwezig | Bestel- en aankoopgebeurtenissen via `order_events`. |
| Aankoopregister | Aanwezig in code | Leverancier, bestelbon, datum, status en opmerkingen; geen bedragen of facturen. |
| Artikelenbibliotheek | Aanwezig | EAN-13, omschrijving, technische specificaties, eenheid, categorie, afbeelding en gekoppelde leveranciers. |
| Leveranciersbibliotheek | Aanwezig | KBO-zoekfunctie, handmatig beheer, ondernemingsnummer, adres en contactgegevens. |
| Afbeeldingsimport | Aanwezig in code | Zoekt een kandidaat en bewaart via R2; GitHub-opslag blijft fallback. Bron- en gebruiksrechten moeten worden gecontroleerd. |
| Centrale instellingen | Aanwezig | Campussen, categorieën en herbestelvoorkeur in D1. |

## Vastgestelde productieomgeving

De remote D1-database `richtpunt-bestelplatform` is read-only gecontroleerd. De bestaande basistabellen zijn aanwezig. De tabellen `purchases` en `app_settings` ontbreken nog. De bestaande database bevat al `image_url` op artikelen en leveranciers en een `image_assets`-tabel. De volgende nieuwe kolommen en tabellen ontbreken nog en worden door de migraties toegevoegd: EAN-code, verantwoording, algemene opmerkingen, teams, teamkoppelingen, technische specificaties, contactpersoon, leveranciersvoorstellen en artikel-leverancierskoppelingen.

Er is nog geen `d1_migrations`-registratie aangetroffen. De migraties zijn daarom geordend als:
- `0001_purchase_register.sql`
- `001_catalog_ean_code.sql`
- `002_order_item_justification.sql`
- `003_order_remarks.sql`
- `004_teams_suppliers_images.sql`
- `005_image_source_url.sql`

De migraties zijn **niet uitgevoerd**. Bestaande bestelgegevens worden niet overschreven.

## Externe blokkeringen en niet-uitgevoerde tests

1. **Cloudflare R2 staat nog niet aan voor het account.** De Cloudflare API gaf aan dat R2 eerst via het Cloudflare-dashboard moet worden ingeschakeld. De bucket `richtpunt-bestelplatform-images` bestaat dus nog niet.
2. KBO-accountgegevens en requestbalans zijn niet geverifieerd. Stel `KBO_USERNAME`, `KBO_PASSWORD` en `KBO_ENDPOINT` als Worker secrets in.
3. Er is geen geslaagde frontendbuild of end-to-endtest aangetoond. De buildworkflow staat in de repository, maar leverde nog geen workflowresultaat op.
4. De applicatie is niet gedeployed. Er zijn geen D1-migraties uitgevoerd.
5. Gedeeltelijke leveringen kunnen als status worden opgevolgd, maar er is nog geen hoeveelheid per deellevering.
6. De volledige autorisatiematrix moet nog met meerdere echte testaccounts worden geverifieerd, zeker bij bestellingen met artikelen uit verschillende categorieën.

## Vrijgavevolgorde

1. Schakel R2 in via Cloudflare en maak de bucket `richtpunt-bestelplatform-images` aan.
2. Stel de KBO Worker secrets in.
3. Controleer de D1-migratiestatus en voer daarna de migraties in volgorde uit.
4. Voer `npm install` en `npm run build` uit.
5. Test met aparte accounts voor aanvrager, aankoper en beheerder, op beide campussen en met verschillende team-/categoriecombinaties.
6. Controleer de bestelworkflow, de informatievragen, de aankoopregistratie, de historiek, EAN-validatie, KBO-resultaten en afbeeldingsopslag.
7. Publiceer pas na een geslaagde acceptatietest.
