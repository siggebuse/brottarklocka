BROTTARKLOCKA MED RINGERDB

NYTT:
- VÄLJ TÄVLING hämtar svenska 2026-tävlingar från RingerDB.
- Vald tävlings matchlistor läses in.
- När matchnumret ändras visas namn och klubb för röd och blå brottare.
- Namn och klubb visas även på PUBLIKSKÄRM.
- Senast valda tävling sparas lokalt på iPaden.

Denna version använder en liten Netlify Function eftersom Safari normalt inte får läsa RingerDB direkt
från en annan domän på grund av webbläsarens säkerhetsregler.

Publicera hela paketet som en Netlify-site med Functions aktiverade.


V13 ändringar:
- Äkta gul seven-segment-klocka på kontrollskärm och publikskärm.
- Större klocksiffror på publikskärmen.
- Bekräftelsefråga innan NOLLSTÄLL.
- Förfluten tid visas automatiskt nere till vänster när klockan stannar.


V15 ändringar:
- HJÄLP-knapp uppe till höger med instruktioner om tidtagning, TR-matchlistor och publikskärm.
- Större poängsiffror på publikskärmen.
- Tidtagningen i V14 är oförändrad.

V16:
- Hjälpknappen ligger bredvid VÄLJ MATCH.
- Uppdaterad hjälptext med Välj match, Nollställ, Publikskärm och S-tangent.
- Större poängsiffror på publikskärmen.
- Större varningssiffror på publikskärmen.

V17:
- Korrigerad visning av Förfluten tid så att stopp på hel sekund inte visas en sekund för lite.
- Tjockare röda/blå ramar runt namn och poäng på publikskärmen.

V18: Publikskärmens varningar visas som röda/blå siffror 1–3 ovanför namnrutan, utan ram. Ingen 0 visas.

V19: S-tangenten fungerar även efter byte 4/6 min. Publikskärm öppnas med popup-fönsterspecifikation och separat fönsternavigering för starkast möjliga popup-beteende.

V20:
- Publikskärm: vid dubbla efternamn visas bara det första efternamnet.
- Publikskärm: namntexten är större; klubbtexten är oförändrad.
- Hjälptext uppdaterad med "browserfönster eller flik".


V21:
- PUBLIKSKÄRM flyttad mellan VÄLJ TÄVLING och HJÄLP.
- VÄLJ MATCH ändrat till VÄLJ TÄVLING.
- Publikskärm: ordet MATCH och ramen kring matchnumret borttagna.
- Matchnummer större och luftigare.
- Namn- och klubbtext större.
- All text på publikskärmen använder Arial Rounded-liknande typsnitt, utom seven-segment-klockan.
