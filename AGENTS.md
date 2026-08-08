# MeTrack – Arbeitsregeln für Coding-Agents

Diese Datei ist vor jeder Änderung vollständig zu lesen. Sie dokumentiert bewusst
nicht nur den Veröffentlichungsweg, sondern auch Produktentscheidungen, die nicht
versehentlich „vereinfacht“ oder zurückgebaut werden dürfen.

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
  drei Sätze. Dehnungen werden anhand erledigter Tage, Quote/Serie und Ja/Nein-
  Verlauf ausgewertet.
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
- `assets/app.js`: UI-Zustand, DOM-Rendering, Storage-Zugriff, Timer und PWA-
  Updatefluss.
- `assets/core.js`: kanonisches Datenmodell, Validierung, Migrationen,
  Statistiken sowie Import/Export. Neue reine Logik hier implementieren und
  direkt testen.
- `assets/exercise-icons.js`: erlaubte persistente Icon-IDs und lokale Inline-
  SVG-Erzeugung.
- `assets/styles.css`: responsive und iPhone-spezifische Darstellung.
- `service-worker.js`: App-Shell, Offline-Cache und Update-Aktivierung.
- `manifest.webmanifest` und `assets/icons/`: installierbare PWA und App-Logo.
- `tests/*.test.js`: Unit- und Regressionstests.
- `scripts/check-static.mjs`: statische Release-Invarianten. Eine bewusst
  geänderte Invariante muss hier zusammen mit der Implementierung aktualisiert
  werden; Checks nicht nur entfernen, um CI grün zu bekommen.
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
- Die bereits großen Dateien `assets/app.js` und `assets/core.js` bei passenden
  größeren Arbeiten schrittweise und testgesichert zerlegen. Keinen riskanten
  Komplettumbau als Nebenänderung starten, aber ihre Größe durch neue unabhängige
  Funktionen nicht weiter unnötig erhöhen.

## Kanonisches Datenmodell

Das aktuelle Schema ist v6. Die Konstanten in `assets/core.js` sind maßgeblich.
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
  `assets/core.js` bleiben für Migration und Datenrettung lesbar.
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
  Bilder. Icons bleiben lokale, sichere Inline-SVGs bzw. gebündelte PWA-Assets.
- Der aktuelle Katalog enthält persistente IDs in `assets/exercise-icons.js`.
  Neue Symbole müssen bei 22–24 px ohne Beschriftung eindeutig erkennbar sein.
- Für eine neue Palette darf Bildgenerierung als Konzept- oder Variantenblatt
  dienen. Produktionssymbole anschließend als konsistente, manuell bereinigte
  24×24-SVGs umsetzen: gleiche Strichstärke, Rundungen, optische Größe und sichere
  Innenabstände; Übungen und Dehnungen dürfen sich nicht nur minimal unterscheiden.
- Neue Icons nach Typ filtern, mit sinnvollen deutschen Labels versehen und in
  Daten-, Backup- und Import-Roundtrips testen.
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
- Bei jeder Änderung an HTML, CSS, JavaScript, Manifest oder PWA-Assets dieselbe
  neue Semver-Version an allen Stellen setzen:
  1. `package.json`
  2. `package-lock.json`
  3. `APP_VERSION` in `assets/app.js`
  4. `CACHE_NAME` in `service-worker.js`
- Reine Dokumentationsänderungen an `README.md`, `AGENTS.md` oder `docs/` brauchen
  keinen App-/Cache-Versionssprung, sofern keine Datei der App-Shell verändert wird.
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
