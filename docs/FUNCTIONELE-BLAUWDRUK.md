# Functionele blauwdruk — Richtpunt Bestelplatform

Deze blauwdruk is de acceptatiebasis voor de volledige afwerking. De applicatie blijft werken voor campus Ninove en campus Zottegem, met Cloudflare Access als identiteitslaag en Cloudflare D1 als centrale databank.

## 1. Rollen en toegangsmodel

- **Aanvrager (staff):** eigen aanvragen indienen, eigen aanvragen en de aanvragen van de eigen teams raadplegen, reageren op informatievragen en een aanvraag annuleren zolang die nog niet besteld is.
- **Aankoper (buyer):** aanvragen bekijken die binnen de toegewezen campus, teams en/of categorieën vallen; informatie opvragen; status en leveringen opvolgen; aankopen registreren.
- **Beheerder (admin):** alle gegevens, gebruikers, teams, rechten, bibliotheken, instellingen en logboeken beheren.
- Rechten worden server-side afgedwongen. Verbergen van knoppen in de frontend geldt nooit als beveiliging.
- Een teamlid ziet teamaanvragen; een aanvrager buiten het team ziet die niet. Een aankoper ziet uitsluitend de aan hem/haar toegewezen campus-/categorie-/teamcontext, tenzij die ook beheerder is.

## 2. Teams

- Teams zijn beheerbare entiteiten met naam, campus, omschrijving en actieve status.
- Gebruikers kunnen lid zijn van meerdere teams; een team kan meerdere leden hebben.
- Een team kan één of meer coördinatoren hebben.
- Elke bestelling wordt aan precies één team gekoppeld.
- Teamleden kunnen de volledige historiek van hun team raadplegen.
- De indiener blijft als afzonderlijke gebruiker aan de bestelling gekoppeld.

## 3. Bestelworkflow

De statussen zijn:
1. Ingediend
2. In behandeling
3. Meer informatie gevraagd
4. Meer informatie ontvangen
5. Goedgekeurd
6. Afgekeurd
7. Besteld
8. Gedeeltelijk geleverd
9. Geleverd
10. Geannuleerd

Regels:
- Een aanvrager dient een aanvraag in met team, campus, titel, motivatie, algemene opmerkingen en één of meer bestelregels.
- Iedere bestelregel bevat artikel, hoeveelheid, eenheid en verplichte verantwoording.
- Per bestelregel kunnen maximaal drie leveranciersvoorstellen worden gekoppeld.
- Een aankoper kan informatie vragen. De aanvraag krijgt de status 'Meer informatie gevraagd'. De aanvrager kan antwoorden; vraag en antwoord blijven bewaard.
- Een aankoper kan goedkeuren, afkeuren of als besteld registreren. Afkeuren vereist een reden.
- Leverstatus wordt per bestelregel opgevolgd. De bestelstatus wordt afgeleid van de status van alle regels waar mogelijk.
- Statusovergangen worden gevalideerd op de server; iedere overgang krijgt een logboekgebeurtenis.

## 4. Historiek en communicatie

- Iedere bestelling heeft een chronologisch logboek met datum/tijd, gebruiker, gebeurtenistype en toelichting.
- Logboek bevat minstens indiening, statuswijzigingen, informatievragen en antwoorden, leveranciersvoorstellen, aankoopregistratie en leveringsupdates.
- Informatievragen en antwoorden zijn afzonderlijke records en blijven raadpleegbaar.
- Logboekrecords zijn append-only voor gewone gebruikers; beheerder kan ze niet stilzwijgend herschrijven.

## 5. Artikelenbibliotheek

- Artikelvelden: naam, EAN-13, categorie, omschrijving, technische specificaties, eenheid, afbeelding, actieve status en gekoppelde leveranciers.
- EAN-13 is optioneel, maar bij invulling moet het controlecijfer geldig zijn en moet de code uniek zijn.
- Zoeken gebeurt minstens op naam, EAN en categorie.
- Artikelen kunnen worden geactiveerd/gedeactiveerd; bestaande bestellingen behouden hun oorspronkelijke artikelnaam en EAN-snapshot.

## 6. Bedrijven- en leveranciersbibliotheek

- Bedrijfsvelden: officiële naam, ondernemingsnummer, btw-nummer, adres, contactpersoon, telefoon, e-mail, website, bron, KBO-controledatum en afbeelding.
- Ondernemingsnummer is uniek wanneer ingevuld.
- KBO-zoekresultaten worden eerst getoond ter controle; gegevens worden pas na expliciete keuze opgeslagen.
- Leveranciers kunnen aan meerdere artikelen gekoppeld zijn.
- Leveranciers worden hergebruikt bij voorstellen en aankopen; geen duplicaten op basis van hetzelfde ondernemingsnummer.

## 7. Aankoopregister

- Per bestelregel: leverancier, bestelbonnummer, besteldatum, leverstatus en interne opmerkingen.
- Geen bedragen of facturen opslaan.
- Filters: status, leverancier, campus, team en datumperiode.
- Gedeeltelijke levering en meerdere leveringen per bestelregel moeten ondersteund worden.

## 8. Afbeeldingen

- Artikel- en bedrijfsfiches kunnen een afbeelding bevatten.
- Afbeeldingsimport is een voorstel, nooit automatisch een definitieve keuze.
- Beheerder/aankoper bevestigt de afbeelding en bron/licentie.
- Bestanden worden buiten de frontendcode opgeslagen; D1 bewaart de verwijzing en metadata.
- Toegestane formaten: JPEG, PNG en WebP; maximale grootte en veilige URL-validatie worden server-side afgedwongen.

## 9. Gebruikers en instellingen

- Cloudflare Access blijft de aanmeldprovider; de eerste aanmelding maakt een account met standaardrol aanvrager.
- Beheerder kan rol, actieve status, campus, teamlidmaatschap en aankoperstoewijzingen beheren.
- Instellingen worden centraal in D1 bewaard: campussen, categorieën, verplichte verantwoording, herbestellen en workflowvoorkeuren.
- Lokale demo-opslag mag nooit als productiebron worden gebruikt en mag geen D1-gegevens overschrijven.

## 10. Acceptatie- en beveiligingstests

- Aanvrager A kan aanvragen van aanvrager B buiten het eigen team niet lezen.
- Teamleden kunnen elkaars teamaanvragen lezen, maar niet de aanvragen van andere teams.
- Aankoper kan uitsluitend toegewezen aanvragen verwerken.
- Alleen bevoegde rollen kunnen artikelen, leveranciers, gebruikers, teams en instellingen wijzigen.
- Alle statusovergangen en informatie-uitwisselingen verschijnen in de historiek.
- Herladen of aanmelden op een ander toestel toont dezelfde centrale gegevens.
- Onbevoegde requests worden door de API met HTTP 403 geweigerd.
- Alle databasewijzigingen worden via gecontroleerde, geordende migraties uitgevoerd.
