# Richtpunt UI-layout

Dit document is de gedeelde visuele standaard voor:
- Bestelplatform (referentie-implementatie)
- Examenmaker
- Professionalisering
- Activiteitenplatform

## Ontwerpuitgangspunt

Het Bestelplatform is de bron voor de gedeelde applicatieschil. De drie andere toepassingen nemen dezelfde navigatie, header, contentbreedte, componentstijl en responsive regels over. De functionele inhoud en navigatie-items blijven applicatiespecifiek.

## Visuele tokens

```css
:root {
  --rp-yellow: #d7ad01;
  --rp-grey: #555555;
  --rp-white: #ffffff;
  --rp-black: #000000;
  --rp-page: #f7f7f4;
  --rp-line: #e8e8e4;
  --rp-muted: #888888;
  --rp-soft-yellow: #fbf5dc;
  --rp-radius: 9px;
  --rp-sidebar-width: 245px;
  --rp-header-height: 65px;
  font-family: "Meta Pro Light", Arial, sans-serif;
}
```

## Applicatieschil

1. Vaste witte zijbalk van 245 px met Richtpunt-beeldmerk, applicatienaam, primaire navigatie en campusvermelding.
2. Navigatie-items gebruiken dezelfde iconen, tussenruimte, typografie en actieve status. Actief/hover: zachte gele achtergrond en donkere tekst.
3. Witte bovenbalk van 65 px met breadcrumb (Richtpunt / huidige pagina) en rechts een status- of gebruikerslabel.
4. Hoofdinhoud gecentreerd met maximaal 1250 px breedte en 36 px desktop-padding.
5. Pagina-intro met kleine uppercase eyebrow, duidelijke paginatitel en korte omschrijving.
6. Kaarten, formulieren, tabellen, meldingen en knoppen volgen de componentregels hieronder.
7. Onderaan een sobere footer met Richtpunt en de applicatienaam.

## Componentregels

- Achtergrond pagina: #f7f7f4; kaarten en panelen: wit met 1 px lijn #e8e8e4 en radius 9 px.
- Primaire knop: geel #d7ad01 met donkere tekst; secundaire knop: wit met grijze rand.
- Formuliervelden: volle breedte, witte achtergrond, grijze rand, radius 5–6 px, consistente padding.
- Sectietitels: 17 px; paginatitel: 30 px; gewone interface-tekst compact en helder.
- Statistiekkaarten: dezelfde padding, rand en typografische hiërarchie als het Bestelplatform.
- Meldingen: zachte gele achtergrond #fbf5dc met donkere oker tekst.
- Geen nieuwe merkkleuren introduceren. Gebruik uitsluitend #d7ad01, #555555, #ffffff en #000000 als merkkleuren; neutrale tinten zijn enkel voor lijnen, pagina-achtergrond en secundaire tekst.
- Typografie: "Meta Pro Light", met Arial als fallback.

## Responsive en toegankelijkheid

- Mobile-first; bruikbaar vanaf 320 px.
- Desktop: zijbalk 245 px en content naast de zijbalk.
- Tablet/mobiel: compacte navigatie zonder horizontale overflow; behoud duidelijke actieve status en labels waar ruimte dit toelaat.
- Formulieren worden één kolom op smalle schermen.
- Interactieve aanraakdoelen minimaal 44 × 44 px.
- Tabellen worden op mobiel horizontaal scrollbaar of omgezet naar kaarten.
- Dialoogvensters nemen op mobiel de beschikbare schermbreedte en -hoogte in.
- Focusstijlen blijven zichtbaar; labels zijn programmatisch aan invoervelden gekoppeld.
- Respecteer semantische HTML, toetsenbordbediening en voldoende contrast.

## Implementatieafspraak

De gedeelde layout wordt als afzonderlijke applicatieschil en gedeelde CSS-tokens/componenten geïmplementeerd. Wijzigingen aan de functionele workflows, gegevensmodellen, API's, authenticatie of opslag vallen buiten een zuivere layoutmigratie en mogen niet stilzwijgend mee wijzigen.
