# MeTrack – Arbeitsregeln für Coding-Agents

Diese Datei ist vor jeder Änderung vollständig zu lesen. Sie dokumentiert bewusst
nicht nur den Veröffentlichungsweg, sondern auch Produktentscheidungen, die nicht
versehentlich „vereinfacht“ oder zurückgebaut werden dürfen.

## Verbindlicher Codex-Ablauf

1. Diese Datei vollständig lesen, danach `git status --short --branch` und den
   relevanten Diff bzw. die betroffenen Quellen prüfen. Bestehende Änderungen
   anderer Bearbeiter nicht überschreiben.
2. Vor dem Editieren einordnen, ob Laufzeitdateien betroffen sind. Dazu zählen
   `index.html`, `manifest.webmanifest`, `service-worker.js` und alles unter
   `assets/`. Reine Änderungen an Dokumentation, Tests, Skripten oder Workflows
   sind kein App-Release.
3. Bei jeder Laufzeitänderung die neue, höhere Semver-Version synchron setzen in
   `package.json`, `package-lock.json`, `APP_VERSION` in `assets/app.js` und
   `CACHE_NAME` in `service-worker.js`. Neue Laufzeit-Assets zusätzlich in
   `APP_SHELL` und `scripts/check-static.mjs` registrieren.
4. Vor Veröffentlichung `npm ci` und `npm run verify` ausführen. Fehler in
   Implementierung oder Invarianten beheben, nicht Checks umgehen oder entfernen.
5. Den tatsächlich zu mergenden PR-Head und dessen Quality-Check prüfen. Nach dem
   Merge `main` und bei Laufzeitänderungen die ausgelieferte Pages-Version
   kontrollieren.

## Produkt und Zielplattform

- MeTrack ist eine lokale, installierbare Trainings-Web-App. Die primäre
  Zielplattform ist die zum Home-Bildschirm hinzugefügte PWA auf einem iPhone;
  die normale Browseransicht muss ebenfalls funktionieren.
- Hosting bleibt GitHub Pages unter dem Repository-Unterpfad. Es gibt aktuell
  kein Backend, Konto, Login, Cloud-Sync, Analytics oder HealthKit.
- Der vorhandene Trackingumfang soll erhalten bleiben. Neue Metriken oder große
  Produktänderungen nur auf ausdrücklichen Wunsch ergänzen.
- Die Oberfläche ist deutsch. In der UI heißen die Inhalte „Übungen“ bzw.
  „Übungen & Dehnungen“, niemals „Eigene Übungen“.
- Die vom Nutzer ausdrücklich gewünschte Viewport-Konfiguration verhindert das
  Zoomen auf dem Handy (`maximum-scale=1`, `user-scalable=no`). Nicht ohne
  Rücksprache ändern.
- `package.json` ist die Quelle für die aktuelle App-Version; Versionsnummern
  nicht in dieser Dokumentation festschreiben.

## Unveränderliche Produktregeln

- Jede gemessene Übung besitzt immer genau drei Satz-Slots.
- Übungstyp `reps`: drei ganzzahlige Wiederholungswerte.
- Übungstyp `seconds`: drei ganzzahlige Sekundenwerte und eine Stoppuhr je Satz.
- Übungstyp `stretch`: ein expliziter täglicher Erledigt-Status; Wiederholungen
  und Zeit sind hierfür irrelevant. Eine Dehnung darf einen optionalen Infotext
  zur Durchführung besitzen.
- `0` ist ein gültiger Messwert. `null` bedeutet „nicht eingetragen“.
- Plank, Liegestütze und Kniebeugen gehören zum selben Übungskatalog wie später
  hinzugefügte Übungen; sie sind kein separates, fest verdrahtetes UI-System.
- Übungen und Dehnungen lassen sich aktivieren und deaktivieren. Vollständiges
  Löschen ist möglich, muss aber klar vor dem Verlust historischer Werte warnen.
- Für gemessene Übungen verwendet das Dashboard als Tageswert den besten der
  drei Sätze. Dehnungen werden ausschließlich nach der Anzahl ihrer
  Durchführungen ausgewertet. Nicht erledigte Dehnungen bleiben für die
  Tagesbearbeitung gespeichert, werden aber weder im Verlauf angezeigt noch als
  Auswertungswert berücksichtigt.
- Körperwerte Gewicht und Bauchumfang bleiben optional und tagesbezogen.
- Kalenderdaten werden als lokale `YYYY-MM-DD`-Werte behandelt. Keine UTC-
  Konvertierung einführen, die den Tag in europäischen Zeitzonen verschiebt.

## Repository und Veröffentlichung

- GitHub-Repository: `pfejan-gif/MeTrack`
- Standardbranch: `main`
- GitHub Pages: `https://pfejan-gif.github.io/MeTrack/`
- GitHub Pages veröffentlicht den Inhalt von `main` aus dem Repository-Stamm.
- In ChatGPT Work/Codex ist das Repository über die verbundene GitHub-App
  erreichbar. Dafür die Connector-Werkzeuge `mcp__codex_apps__github_*` mit
  `repository_full_name: "pfejan-gif/MeTrack"` verwenden.
- Wenn die lokale GitHub-CLI `gh` fehlt, aber die verbundene GitHub-App die
  benötigte Operation abdeckt, den Connector verwenden und nicht allein wegen
  der fehlenden CLI abbrechen.
- Die lokale Arbeitskopie kann ohne `.git` bereitgestellt sein. In diesem Fall
  keine neue Repository-Historie initialisieren, sondern Dateien prüfen und die
  Änderung über die verbundene GitHub-App veröffentlichen.

## Architektur und Quellen der Wahrheit

- `index.html`: semantische Grundstruktur, Dialoge, PWA-Metadaten und CSP.
- `assets/app.js`: schlanker Orchestrator, gemeinsamer UI-Zustand, zentrale
  Fehlerbehandlung und Event-Verdrahtung.
- `assets/app/storage-controller.js`: Lesen, Validieren, Migrieren, Sichern und
  Persistieren der lokalen Daten sowie kontrollierte Datenrettung bei Fehlern.
- `assets/app/`: fachliche UI-Controller für Dashboard/History, Eintragsformular,
  Übungen, Timer, Datentransfer und PWA. Zustand und Seiteneffekte über explizite
  Factory-Parameter übergeben; Module importieren den Orchestrator nicht zurück.
- `assets/core.js`: stabile öffentliche Re-Export-Fassade. App und Tests
  importieren standardmäßig hierüber, damit interne Splits kompatibel bleiben.
- `assets/core/`: kanonisches Datenmodell, Katalog, Einträge, Statistiken,
  Migrationen, Import/Export und Basisfunktionen. Abhängigkeiten verlaufen von
  Konstanten über Modell/Einträge zu Statistik, Migration und Transfer – niemals
  zurück über `assets/core.js`.
- `assets/exercise-icons.js`: erlaubte persistente Übungs-/Dehnungs-Icon-IDs
  und lokaler WebP-Bild-Renderer.
- `assets/body-metric-icons.js`: Zuordnung der nicht persistenten Körperwert-
  IDs zu ihren lokalen WebP-Assets.
- `assets/icons/exercises/` und `assets/icons/metrics/`: transparente,
  optimierte Produktions-Icons im gemeinsamen MeTrack-Bildstil.
- `assets/styles.css`: geordneter CSS-Einstieg mit `@import`-Anweisungen.
- `assets/styles/`: Basis, Dashboard, Training, Charts/History, Dialoge und
  responsive Regeln. Die Importreihenfolge ist Teil des visuellen Verhaltens.
- `service-worker.js`: App-Shell, Offline-Cache und Update-Aktivierung.
- `manifest.webmanifest` und `assets/icons/`: installierbare PWA und App-Logo.
- `tests/*.test.mjs`: fachlich getrennte Unit- und Regressionstests;
  wiederverwendbare Fixtures liegen unter `tests/helpers/`.
- `scripts/check-static.mjs`: statische Release-Invarianten. Eine bewusst
  geänderte Invariante muss hier zusammen mit der Implementierung aktualisiert
  werden; Checks nicht nur entfernen, um CI grün zu bekommen.
- `scripts/check-release-diff.mjs`: PR-Diff-Sicherung. Sobald eine Laufzeitdatei
  geändert wird, muss `package.json` gegenüber dem Basis-Commit eine höhere
  Semver-Version enthalten; die statischen Checks prüfen anschließend die
  Synchronität aller vier Versionsstellen.
- Es gibt keinen Build-Schritt und keine Runtime-Abhängigkeiten. Zusätzliche
  Bibliotheken nur bei klarem Nutzen und als größere Änderung einführen.

## Dateigröße und Modularität

- Dateien klein, fachlich fokussiert und leicht prüfbar halten. Neue Funktionen
  nicht automatisch an die bereits größte Datei anhängen.
- Ab ungefähr 500 Zeilen bei jeder Änderung prüfen, ob klar abgegrenzte
  Verantwortlichkeiten in eigene Module gehören. Ab ungefähr 800 Zeilen ist ein
  fachlicher Split grundsätzlich einzuplanen; eine begründete Ausnahme darf nicht
  bloß mit Bequemlichkeit oder Zeitdruck erklärt werden.
- Nach Aufgabengebiet schneiden, nicht willkürlich nach Zeilenzahl. Sinnvolle
  Grenzen sind beispielsweise UI/Rendering, Storage/Migration, Import/Export,
  Timer, Statistiken/Diagramme, Übungskatalog/Symbole und PWA-Updatefluss.
- Module besitzen eine kleine, explizite Schnittstelle. Reine Logik bleibt vom
  DOM getrennt, zyklische Imports und ein globaler Sammelzustand sind zu vermeiden.
- Tests entsprechend den Fachmodulen aufteilen; Testdateien sollen dieselbe
  Zuständigkeit widerspiegeln wie der Produktionscode.
- `scripts/check-static.mjs` erzwingt für produktive JS-/CSS-Module und Tests die
  Obergrenze von 800 Zeilen. Neue Zuständigkeiten frühzeitig auslagern, statt die
  Grenze nur durch komprimierte Formatierung zu umgehen.

## Kanonisches Datenmodell

Das aktuelle Schema ist v6. Die Konstanten in `assets/core/constants.js` sind
maßgeblich und werden öffentlich über `assets/core.js` re-exportiert.
Vereinfacht sieht ein gespeichertes Dokument so aus:

```js
{
  schemaVersion: 6,
  exercises: [
    {
      id: "exercise-plank",
      name: "Plank",
      kind: "seconds", // "reps" | "seconds" | "stretch"
      icon: "plank",
      active: true,
      instructions: "..." // nur optional bei stretch
    }
  ],
  entries: [
    {
      date: "2026-08-08",
      exerciseSets: [
        { exerciseId: "exercise-plank", values: [60, 55, null] }
      ],
      exerciseChecks: [
        { exerciseId: "stretch-hamstrings", completed: true }
      ],
      weight: 80.4,
      waist: null
    }
  ]
}
```

- Übungs-IDs bleiben stabil; gespeicherte Tageswerte referenzieren sie.
- Icon-IDs sind ebenfalls persistente Daten. Vorhandene IDs niemals löschen,
  umbenennen oder einer völlig anderen Bedeutung zuweisen, ohne eine getestete
  Migration bereitzustellen.
- Arrays der gemessenen Übungen werden immer auf exakt drei Werte normalisiert.
- Bei Merge oder Bearbeitung eines Tages dürfen nicht mitgelieferte Werte nicht
  durch `null` überschrieben werden. Konfliktverhalten muss deterministisch sein.
- Ein Verschieben eines bearbeiteten Eintrags auf ein bereits belegtes Datum darf
  nicht unbemerkt den Zieldatensatz zerstören.

## Speicherung, Migration und Sicherungen

- Aktueller Schlüssel: `metrack_data_v6`. Historische Schlüssel in
  `assets/core/constants.js` bleiben für Migration und Datenrettung lesbar.
- Schema-Version und App-/Cache-Version sind voneinander unabhängig.
- Migrationen schrittweise, deterministisch und idempotent implementieren.
- Vor einer Migration Rohdaten sichern, vollständig parsen und validieren, erst
  danach das neue Dokument in einem Schreibvorgang persistieren. Alte Daten bei
  Fehlern niemals still löschen oder durch Defaults überschreiben.
- `localStorage` kann durch Privatmodus, Quota oder Browserzustand fehlschlagen.
  Nur nach erfolgreichem Schreib- und Readback-Vorgang „gespeichert“ anzeigen.
  Lesbare Bestandsdaten trotz fehlgeschlagenem Schreibtest nicht verwerfen.
- Beschädigte, teilweise ungültige und zukünftig unbekannte Versionen explizit
  behandeln. Keine stillen Teilverluste.
- JSON ist die verlustfreie Sicherung. Import zuerst Größen-, Format-, Schema-
  und Typprüfung unterziehen; ältere Versionen migrieren, zukünftige ablehnen.
  Vor Anwenden Vorschau sowie Merge/Ersetzen anbieten und automatisch sichern.
- CSV ist ein lesbarer Export, aber keine vollständige Wiederherstellung des
  Katalogs. Drei Rohsatz-Spalten und nachvollziehbare Tageswerte erhalten.
- Änderungen an Storage, Migration, Import/Export oder Löschsemantik gelten als
  größere Änderung und benötigen Fixtures sowie Roundtrip-/Fehlertests.

## Timer

- Nur Übungen vom Typ `seconds` zeigen eine Stoppuhr.
- Die Stoppuhr sitzt als kompaktes Symbol rechts neben „Satz 1/2/3“ und darf die
  vertikalen Abstände gegenüber Wiederholungsfeldern nicht vergrößern. Keine
  zusätzlichen breiten „Timer“-Buttons unter den Eingaben einführen.
- Zeitmessung basiert auf Zeitstempeln, nicht auf dem Zählen von Intervallen. Sie
  muss nach kurzem App-Wechsel und Reload korrekt weiterlaufen.
- Der aktive Timer wird über `metrack_active_timer_v1` wiederhergestellt.
- Screen Wake Lock nur per Feature Detection und als progressive Verbesserung
  verwenden. Pausieren, Fortsetzen, Übernehmen und Abbrechen testen.

## Symbole und visuelle Assets

- Die App lädt zur Laufzeit keine Icon-Fonts, CDN-Bibliotheken oder externen
  Bilder. Produktions-Icons bleiben lokale, gebündelte PWA-Assets.
- Die aktuelle Bildsprache ist ein freundlicher, abgerundeter 3D-Clay-Stil:
  dunkelblaues Hauptmotiv, Mint-/Türkis-Akzente, weiche Studiobeleuchtung,
  transparenter Hintergrund, kein Text, Logo, Rahmen oder Wasserzeichen. Neue
  Motive müssen ohne Beschriftung bei 22–24 px eindeutig erkennbar sein und sich
  semantisch klar von vorhandenen Motiven unterscheiden.
- Produktions-Icons als transparente 256×256-WebPs ablegen. Die sichtbare Form
  erhält gleichmäßige sichere Innenabstände, eine zum Katalog passende optische
  Größe und einen alpha-gewichteten visuellen Schwerpunkt in der Bildmitte.
  Nicht nur die geometrische Bounding-Box zentrieren. Einzeldateien bleiben
  unter 64 KB und sollen nach Möglichkeit deutlich kleiner sein.
- Bei generierten Motiven einen vollkommen einfarbigen Chroma-Key-Hintergrund
  verwenden, ihn lokal sauber entfernen und Kanten auf Farbsäume prüfen. Danach
  das freigestellte Motiv auf 256×256 normalisieren, als WebP optimieren und auf
  hellem sowie dunklem Untergrund kontrollieren. Keine externen Bild-URLs oder
  zur Laufzeit erzeugten Varianten einführen.
- Persistente Übungs-/Dehnungs-IDs stehen in `assets/exercise-icons.js` und
  dürfen ohne getestete Migration nicht umbenannt oder neu belegt werden.
  Körperwert-Icons stehen in `assets/body-metric-icons.js`; ihre IDs müssen den
  kanonischen `BODY_METRIC_KEYS` entsprechen. Neue Icons nach Typ filtern und mit
  sinnvollen deutschen Labels versehen.
- Jedes neue Laufzeit-Asset sowohl dem `APP_SHELL` in `service-worker.js` als
  auch `scripts/check-static.mjs` hinzufügen. Der statische Check validiert
  WebP-Header und Dateigröße; Zuordnung und Eindeutigkeit erhalten Unit-Tests.
- Neue Icons in der Auswahlpalette, im Tagesformular, in Übersicht/Auswertung
  und Historie dort prüfen, wo ihr Typ vorkommt: mindestens bei 320 px und 375 px,
  in Hell-/Dunkelmodus sowie nach warmer Offline-Neuladung. Persistente
  Übungs-/Dehnungs-Icons zusätzlich in Daten-, Backup- und Import-Roundtrips
  testen.
- App-Icon und Wortmarke nur als zusammengehöriges Set ändern. Apple-Touch- und
  Manifest-PNGs müssen vollflächig, opak und in den geprüften Größen bleiben.

## UI, iPhone und Barrierefreiheit

- Änderungen mindestens bei 320 px und 375 px Breite prüfen, zusätzlich Desktop
  sowie Hell-/Dunkelmodus. Safe-Area-Inset und die installierte iPhone-PWA
  berücksichtigen.
- Interaktive Touch-Ziele mindestens 44×44 px groß halten.
- Feldgruppen besitzen auf iOS eine sichtbare, durchgehende Rahmenlinie. Legenden
  bleiben innerhalb des Rahmens; Untertitel wie „3 Sätze · Wiederholungen“ haben
  klaren Abstand zu Linie und Inhalt.
- Zeit- und Wiederholungsfelder besitzen dieselben kompakten vertikalen Abstände.
- Der feste Speicherbutton darf keine Eingaben verdecken.
- Snackbar/Toast kompakt halten, `aria-live` verwenden und bei „Rückgängig“ echte
  Touch-Eingaben akzeptieren. Undo stellt exakt den gelöschten Datensatz wieder her.
- PWA-Updates als kompaktes Banner anzeigen, nicht als große schwebende Blase über
  Formular oder Speicherbutton.
- Alle Controls brauchen verständliche Labels/ARIA-Namen; Icon-Buttons dürfen
  nicht ausschließlich visuell beschrieben sein. Diagramme benötigen eine
  Textalternative.
- Nutzereingaben nur über `textContent`, DOM-Eigenschaften oder sichere
  Elementerzeugung rendern. Kein dynamisches `innerHTML` oder
  `insertAdjacentHTML` für Nutzerdaten.
- Frühere Produktentscheidung: In der sichtbaren App keine Werbehinweise mit
  „privat“, „offline-fähig“ oder den entfernten Block „Privat auf deinem iPhone“
  wieder einführen. Ebenfalls keine sichtbare Schaltfläche „Alle Daten löschen“
  ohne neuen ausdrücklichen Nutzerauftrag ergänzen.

## PWA, GitHub Pages und Versionierung

- Alle lokalen URLs relativ zum Repository-Unterpfad schreiben (`./...`), nie
  root-absolut (`/...`). Manifest verwendet `start_url` und `scope` jeweils `./`.
- Neue Laufzeitdateien dem `APP_SHELL` im Service Worker und den statischen Checks
  hinzufügen. Der Offline-Start muss nach einem erfolgreichen Online-Aufruf ohne
  Netzwerk funktionieren.
- Die Versions- und Ausnahmeregeln aus dem verbindlichen Codex-Ablauf gelten auch
  für kleine Korrekturen. Der PR-Workflow erzwingt den Versionssprung technisch;
  `scripts/check-static.mjs` erzwingt die vier synchronen Versionsstellen.
- Updatefluss sowohl mit bereits wartendem Service Worker als auch während
  `updatefound` behandeln. Nach „Aktualisieren“ kontrolliert reloaden, damit keine
  alte HTML-Datei mit neuen Modulen gemischt wird.
- Nach Merge die Pages-URL und geänderte statische Ressourcen mit Cache-Busting
  prüfen. Bei PWA-Änderungen zusätzlich installierte App schließen/öffnen,
  Updatebanner und angezeigte Version kontrollieren.

## Sicherheit und Datenschutz

- Keine Secrets, Tokens oder privaten Endpunkte in Repository, Frontend, URLs,
  Logs oder Tests aufnehmen.
- Keine unerwarteten Drittanbieter-Requests, Telemetrie oder Analytics ergänzen.
- CSP und Referrer-Policy möglichst streng halten; neue Quellen nur begründet
  freischalten.
- GitHub Pages teilt die Origin mit anderen Projekten desselben Benutzerkontos.
  Sensiblere Isolation würde eine eigene Origin erfordern; diese Architektur nicht
  stillschweigend als vollständig isoliert darstellen.

## Test- und Abnahmepflicht

- Unterstützte lokale Laufzeit: Node.js 20 oder neuer.
- Vor Veröffentlichung ausführen:

  ```bash
  npm ci
  npm run verify
  ```

- `npm run verify` umfasst statische Checks und Unit-Tests. Jede neue reine Logik
  erhält Tests; Migrationen brauchen je historische Version eine Fixture.
- Relevante Regressionen manuell bzw. per Browser prüfen: Anlegen → Reload →
  Bearbeiten → Löschen/Undo; Übung aktivieren/deaktivieren/löschen; Dehnung samt
  Infotext und Tagesstatus; Timer; JSON-Export → Löschen → Import; beschädigter
  Import; warme Offline-Neuladung; Updatefluss; Direktaufruf unter `/MeTrack/`.
- Soll oder möchte der Nutzer eine Änderung vor der Veröffentlichung selbst
  testen, bleibt der PR bis zu seiner ausdrücklichen Freigabe ungemergt. Der
  Agent stellt dafür einen funktionierenden HTTPS-Testlink bereit, der exakt auf
  den geprüften PR-Head bzw. dessen Commit-SHA zeigt, und nennt die zu prüfende
  Version. Der Link ist vor der Weitergabe mindestens auf Erreichbarkeit und das
  Laden der geänderten Laufzeitdateien zu kontrollieren; bei Änderungen an der
  primären Zielplattform zusätzlich in Safari auf dem iPhone bzw. als PWA. Die
  Vorschau darf die veröffentlichte App und deren lokale Daten nicht
  überschreiben. Ohne nutzbaren Testlink weder zur manuellen Abnahme auffordern
  noch den PR mergen.
- Keine unbehandelten Console-Fehler und keine unerwarteten Netzwerkaufrufe.
- GitHub-Actions-Workflow „Quality“ muss für den tatsächlich zu mergenden Commit
  grün sein.

## Merge-Regel

- Kleine, klar abgegrenzte und risikoarme Änderungen werden nach erfolgreicher
  Prüfung standardmäßig bis `main` gemergt. Sie sollen nicht ungemergt auf einem
  Arbeitsbranch liegen bleiben, sofern der Nutzer nichts anderes verlangt.
- Ein kurzlebiger Branch oder Pull Request darf für Nachvollziehbarkeit und CI
  verwendet werden; nach grünen Checks wird er im selben Arbeitsgang gemergt.
- Größere oder risikoreiche Änderungen bleiben zunächst auf einem eigenen Branch
  als Draft-PR und werden erst nach ausdrücklicher Freigabe gemergt.
- Als größere Änderungen gelten insbesondere Datenmodell- oder
  Migrationsänderungen, neue Abhängigkeiten oder Buildsysteme, größere UI-
  Neugestaltungen, Änderungen an Import/Export oder Speicherung, sicherheits- oder
  datenschutzrelevante Eingriffe sowie umfangreiche Refactorings.
- Niemals fehlgeschlagene Checks umgehen, `main` per Force-Push überschreiben oder
  einen veränderten PR-Head ohne erneute Prüfung mergen.
- Nach dem Merge den resultierenden Commit auf `main`, den CI-Status und – bei
  Laufzeitänderungen – die tatsächlich ausgelieferte Pages-Version verifizieren.
