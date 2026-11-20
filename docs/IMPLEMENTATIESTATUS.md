# Implementatiestatus — Richtpunt Bestelplatform

Laatste controle: 20 november 2026. De code staat op `main`. De productieomgeving is bijgewerkt met de Pages API-route, D1-migraties en R2-binding. Dit document maakt onderscheid tussen wat gedeployed is en wat nog functioneel moet worden getest.

## Functionele implementatie in de repository

| Onderdeel | Status in code | Opmerking |
|---|---|---|
| Aanmelden via Cloudflare Access | Aanwezig | Pages Function geeft de Access-identiteit door aan de API-handler; JWT-validatie gebeurt server-side. |
| Rollen en gebruikersbeheer | Aanwezig | Beheer van rol, campus en actief/inactief; accounts ontstaan bij eerste aanmelding. |
| Teams, teamleden en coördinatoren | Gedeeltelijk | Teamleden en coördinatorrol zijn aanwezig; coördinator heeft nog geen afzonderlijke rechten. |
| Aankopersrechten | Gedeeltelijk | Campus- en categoriecontrole is aanwezig; autorisatiematrix en SQL-controles moeten nog met meerdere testaccounts worden gevalideerd. |
| Bestellingen en bestelregels | Aanwezig | Team, campus, motivatie, algemene opmerkingen en verplichte verantwoording. |
| Leveranciersvoorstellen | Aanwezig | Maximaal drie per bestelregel; koppeling aan leveranciersrecords. |
| Bestelworkflow | Gedeeltelijk | Statussen zijn aanwezig; rechten van de gewone aanvrager zijn beperkter dan de oorspronkelijke wens. |
| Informatieverzoeken | Aanwezig | Vraag en antwoord worden bewaard. |
| Chronologisch logboek | Gedeeltelijk | Belangrijke bestel- en aankoopgebeurtenissen worden geregistreerd; nog niet elke wijziging. |
| Aankoopregister | Gedeeltelijk | Leverancier, bestelbon, datum, status en opmerkingen; filters op campus/team ontbreken en hoeveelheden per deellevering zijn niet uitgewerkt. |
| Artikelenbibliotheek | Aanwezig | EAN-13, omschrijving, technische specificaties, eenheid, categorie, afbeelding en gekoppelde leveranciers. |
| Leveranciersbibliotheek | Aanwezig in code | KBO-zoekfunctie en handmatig beheer; echte KBO-verbinding wacht op accountsecrets. |
| Afbeeldingsimport | Aanwezig in code | Zoekt een kandidaat en bewaart via R2. Gebruiksrechten moeten worden gecontroleerd; afbeelding bij elke afzonderlijke bestelregel ontbreekt nog. |
| Centrale instellingen | Gedeeltelijk | Campussen, categorieën en herbestelvoorkeur; dynamische campuswaarden zijn nog niet volledig door de API ondersteund. |
| Microsoft 365- en Smartschool-aanmelding | Ontbreekt | Alleen Cloudflare Access is geïntegreerd. |

## Productieomgeving — bevestigd

- Cloudflare Pages-project: `richtpunt-bestelplatform`.
- Productiedeployment: `f0a38317-ca9a-4469-93fb-e0db657363fa`.
- Gedeployed commit: `ca2c6131696110c760e1c129850db60e4f691dbf`.
- Productie-URL: https://richtpunt-bestelplatform.pages.dev
- Pages build en Functions-bundeling: geslaagd.
- GitHub Actions-build: geslaagd.
- Pages Function-route `functions/api/[[path]].js` roept de gedeelde API-handler in `worker/index.js) aan.
- Pages production bindings: D1 `DB` en R2 `IMAGES` zijn aanwezig.
- R2-bucket `richtpunt-bestelplatform-images` is aangemaakt in regio WEUR (West-Europa), Standard.
- De Worker-/Pages-variabelen voor Cloudflare Access en de KBO-endpoint zijn ingesteld.

## D1-productiedatabase

De remote D1-database `richtpunt-bestelplatform` is gemigreerd. De migraties zijn in deze volgorde uitgevoerd en geregistreerd in `d1_migrations`:

1. `0001_purchase_register.sql`
2. `001_catalog_ean_code.sql`
3. `002_order_item_justification.sql`
4. `003_order_remarks.sql`
5. `004_teams_suppliers_images.sql`
6. `005_image_source_url.sql`

De tabellen en kolommen zijn na uitvoering gecontroleerd. `PRAGMA foreign_key_check` gaf geen afwijkingen. De database bevatte vooraf geen bestellingen, artikelen of leveranciers; na de migraties zijn die aantallen nog steeds nul. Er zijn dus geen bestaande bestelrecords gewijzigd of verwijderd.

## Nog uit te voeren

1. **KBO-secrets:** voeg `KBO_USERNAME` en `KBO_PASSWORD` als secrets toe aan de productieomgeving van het Pages-project. De endpoint-URL is al ingesteld. Zonder deze twee secrets werkt KBO-zoeken niet.
2. **Praktijktest:** aanmelden via Cloudflare Access en testen van `/api/me), bestellen, gebruikersrollen, teams, aankopersrechten en aankoopregistratie met echte accounts.
3. **Afbeeldingstest:** een artikelafbeelding importeren en controleren of het bestand in de R2-bucket wordt bewaard en opnieuw wordt weergegeven.
4. **KBO-test:** na configuratie van de secrets een bedrijfsnaam en ondernemingsnummer opzoeken.
5. **Beveiliging:** volledige autorisatiematrix testen, in het bijzonder gemengde bestellingen met meerdere categorieën.
6. **Functionele afwerking:** Microsoft 365/Smartschool-aanmelding, afbeeldingen bij bestelregels, meerdere deelleveringen met aantallen, extra filters en overige punten uit de functionele blauwdruk.

## Opmerking

De productiecode is gedeployed en de databankstructuur is aanwezig. Dat is nog geen volledige acceptatietest. Gebruik het platform pas voor echte bestellingen nadat de aanmelding, API-routes, rolbeperkingen en R2-afbeeldingsopslag met testaccounts zijn gevalideerd.
