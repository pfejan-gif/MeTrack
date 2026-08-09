# MeTrack

![MeTrack – Fitness-Tracker](./assets/icons/social-preview.png)

Ein fokussierter, iPhone-optimierter Fitness-Tracker für den täglichen Fortschritt – ohne Konto, Tracking oder Server. MeTrack läuft direkt über GitHub Pages und speichert alle Daten ausschließlich im Browser des verwendeten Geräts.

**[MeTrack öffnen](https://pfejan-gif.github.io/MeTrack/)**

## Funktionen

- je drei Sätze bzw. Versuche für Plank, Liegestütze und Kniebeugen erfassen
- Übungen wie Sit-Ups anlegen und wahlweise in Wiederholungen oder Sekunden messen
- Dehnungen mit optionaler Anleitung anlegen und pro Tag als durchgeführt abhaken
- aus einer klaren Symbolpalette ein passendes Icon für jede Übung und Dehnung wählen
- zeitbasierte Übungen mit einer Stoppuhr pro Satz messen, pausieren und direkt übernehmen
- jede Übung – auch Plank, Liegestütze und Kniebeugen – deaktivieren, ohne frühere Trainingswerte zu löschen
- Übungen nach einer deutlichen Warnung mitsamt allen historischen Werten ganz löschen
- Gewicht und Bauchumfang dokumentieren
- persönliche Bestwerte, Veränderungen sowie Trainingsserien sehen
- Verlauf nach Messwert und Zeitraum auswerten
- Dehnungen ausschließlich nach der Anzahl ihrer Durchführungen auswerten
- Einträge mobil und am Desktop bearbeiten oder mit Rückgängig löschen
- Excel-kompatibles CSV exportieren
- versionierte JSON-Sicherungen exportieren, prüfen und wiederherstellen
- lokale Daten zusammenführen oder vollständig aus einer Sicherung ersetzen
- als PWA auf dem iPhone-Homescreen installieren
- nach dem ersten Aufruf vollständig offline verwenden
- automatische, helle und dunkle Darstellung

## Auf dem iPhone installieren

1. Die [GitHub-Pages-App](https://pfejan-gif.github.io/MeTrack/) in **Safari** öffnen.
2. Unten auf **Teilen** tippen.
3. **Zum Home-Bildschirm** auswählen.
4. Mit **Hinzufügen** bestätigen.

MeTrack öffnet sich danach im eigenen App-Fenster. Safe-Area-Abstände, Touch-Ziele und Zahlentastaturen sind für iPhone/Safari optimiert.

Bei zeitbasierten Übungen erscheint rechts neben jedem Satz eine **Stoppuhr**. Sie berechnet die Laufzeit aus Zeitstempeln, bleibt deshalb auch nach einem kurzen Wechsel in eine andere App korrekt und kann nach einem Reload wieder geöffnet werden. Während einer sichtbaren, laufenden Messung versucht MeTrack – sofern Safari es unterstützt – den Bildschirm wach zu halten.

## Datenschutz und Sicherung

MeTrack besitzt kein Backend und lädt keine Drittanbieter-Ressourcen. Trainings- und Körperdaten bleiben im `localStorage` des jeweiligen Browsers. Das bedeutet auch:

- Es gibt keine automatische Cloud-Synchronisierung.
- Safari-Daten löschen entfernt auch MeTrack-Einträge.
- Bei einem Gerätewechsel müssen die Daten über **Sichern** exportiert und auf dem neuen Gerät über **Import** wiederhergestellt werden.

Bereits vorhandene Einträge aus `metrack_entries_v1` sowie `metrack_data_v2` bis `metrack_data_v5` werden validiert und sicher nach `metrack_data_v6` übernommen. Die ältere Ablage bleibt als Rückfallkopie erhalten. Ein bisheriger Einzelwert wird automatisch zu Satz 1; Dashboard und Diagramme verwenden den besten Tageswert aus den drei Sätzen. Übungen und Dehnungen liegen mit Typ, Symbol, Aktivstatus und optionaler Anleitung gemeinsam mit den Einträgen im versionierten v6-Dokument und werden in JSON-Sicherungen vollständig mitgeführt. Frühere Tage erhalten bei der Migration keinen erfundenen Dehnungsstatus; vorhandene Übungen bekommen automatisch ein passendes Standardsymbol.

> Technischer Hinweis: GitHub Pages trennt Browser-Speicher nach Domain, nicht nach Repository-Pfad. Andere Webprojekte unter derselben `pfejan-gif.github.io`-Domain könnten daher technisch auf dieselbe Ablage zugreifen. Für eine vollständig isolierte Browser-Origin ist eine eigene Domain für MeTrack erforderlich.

## Lokale Entwicklung

Die App benötigt keinen Build-Schritt und keine Laufzeitabhängigkeiten.

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen. Service Worker funktionieren auf `localhost` oder über HTTPS.

## Qualität prüfen

Erforderlich: Node.js 20 oder neuer.

```bash
npm ci
npm run verify
```

Die Prüfung umfasst alle JavaScript-Module, relative GitHub-Pages-Pfade, Manifest und App-Shell, Icon-Abmessungen, die Modulgrößen-Grenze sowie Unit-Tests für Validierung, Berechnungen, CRUD, CSV und Sicherungsimporte. GitHub Actions führt dieselben Prüfungen bei Pushes und Pull Requests aus.

## Projektstruktur

```text
.
├── index.html                 # semantische App-Oberfläche
├── assets/
│   ├── app.js                 # UI-Orchestrator und Event-Verdrahtung
│   ├── app/                   # Timer, Übungen, Dashboard, Form, Transfer und PWA
│   ├── core.js                # stabile öffentliche Core-Fassade
│   ├── core/                  # Modell, Einträge, Statistik und Migration/Transfer
│   ├── exercise-icons.js      # lokale SVG-Symbolpalette
│   ├── styles.css             # geordneter CSS-Einstieg
│   ├── styles/                # fachlich getrennte Oberflächenbereiche
│   └── icons/                 # Favicon, App-Icons und Vorschau
├── manifest.webmanifest       # installierbare PWA
├── service-worker.js          # Offline-App-Shell und Updates
├── tests/                     # fachlich getrennte Unit-Tests und Fixtures
└── .github/workflows/         # automatische Qualitätsprüfung
```

## Deployment

GitHub Pages veröffentlicht den Inhalt des `main`-Branches aus dem Repository-Stamm. Alle App-Pfade sind relativ, damit MeTrack zuverlässig unter dem Repository-Unterpfad `/MeTrack/` funktioniert.

Repository-Einstellung: **Settings → Pages → Deploy from a branch → `main` / `(root)`**. Für produktive Änderungen sollte der `main`-Branch geschützt und der Workflow **Quality** als erforderlicher Check aktiviert werden.

## Browser-Unterstützung

MeTrack ist für aktuelles Safari auf iPhone/iPad sowie aktuelle Chromium- und Firefox-Versionen ausgelegt. Ohne native Dialog-Unterstützung verwendet der Sicherungsimport einen funktionalen Systemdialog als Fallback.
