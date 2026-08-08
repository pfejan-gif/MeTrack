# MeTrack

![MeTrack – Fitness-Tracker](./assets/icons/social-preview.png)

Ein fokussierter, iPhone-optimierter Fitness-Tracker für den täglichen Fortschritt – ohne Konto, Tracking oder Server. MeTrack läuft direkt über GitHub Pages und speichert alle Daten ausschließlich im Browser des verwendeten Geräts.

**[MeTrack öffnen](https://pfejan-gif.github.io/MeTrack/)**

## Funktionen

- je drei Sätze bzw. Versuche für Plank, Liegestütze und Kniebeugen erfassen
- Übungen wie Sit-Ups anlegen und wahlweise in Wiederholungen oder Sekunden messen
- zeitbasierte Übungen mit einer Stoppuhr pro Satz messen, pausieren und direkt übernehmen
- jede Übung – auch Plank, Liegestütze und Kniebeugen – deaktivieren, ohne frühere Trainingswerte zu löschen
- Übungen nach einer deutlichen Warnung mitsamt allen historischen Werten ganz löschen
- Gewicht und Bauchumfang dokumentieren
- persönliche Bestwerte, Veränderungen und aktuelle Serie sehen
- Verlauf nach Messwert und Zeitraum auswerten
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

Bei zeitbasierten Übungen erscheint unter jedem Satz ein **Timer**. Die Stoppuhr berechnet die Laufzeit aus Zeitstempeln, bleibt deshalb auch nach einem kurzen Wechsel in eine andere App korrekt und kann nach einem Reload wieder geöffnet werden. Während einer sichtbaren, laufenden Messung versucht MeTrack – sofern Safari es unterstützt – den Bildschirm wach zu halten.

## Datenschutz und Sicherung

MeTrack besitzt kein Backend und lädt keine Drittanbieter-Ressourcen. Trainings- und Körperdaten bleiben im `localStorage` des jeweiligen Browsers. Das bedeutet auch:

- Es gibt keine automatische Cloud-Synchronisierung.
- Safari-Daten löschen entfernt auch MeTrack-Einträge.
- Bei einem Gerätewechsel müssen die Daten über **Sichern** exportiert und auf dem neuen Gerät über **Import** wiederhergestellt werden.

Bereits vorhandene Einträge aus `metrack_entries_v1`, `metrack_data_v2` und `metrack_data_v3` werden validiert und sicher nach `metrack_data_v4` übernommen. Die ältere Ablage bleibt als Rückfallkopie erhalten. Ein bisheriger Einzelwert wird automatisch zu Satz 1; Dashboard und Diagramme verwenden den besten Tageswert aus den drei Sätzen. Alle Übungen einschließlich Plank, Liegestütze und Kniebeugen liegen mit Einheit und Aktivstatus gemeinsam mit den Einträgen im versionierten v4-Dokument und werden in JSON-Sicherungen vollständig mitgeführt.

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

Die Prüfung umfasst JavaScript-Syntax, relative GitHub-Pages-Pfade, Manifest und App-Shell, Icon-Abmessungen sowie Unit-Tests für Validierung, Berechnungen, CRUD, CSV und Sicherungsimporte. GitHub Actions führt dieselben Prüfungen bei Pushes und Pull Requests aus.

## Projektstruktur

```text
.
├── index.html                 # semantische App-Oberfläche
├── assets/
│   ├── app.js                 # UI, Speicherung und PWA-Verhalten
│   ├── core.js                # getestete Daten- und Berechnungslogik
│   ├── styles.css             # responsive iPhone-/Desktop-Oberfläche
│   └── icons/                 # Favicon, App-Icons und Vorschau
├── manifest.webmanifest       # installierbare PWA
├── service-worker.js          # Offline-App-Shell und Updates
├── tests/                     # Unit-Tests ohne externe Abhängigkeiten
└── .github/workflows/         # automatische Qualitätsprüfung
```

## Deployment

GitHub Pages veröffentlicht den Inhalt des `main`-Branches aus dem Repository-Stamm. Alle App-Pfade sind relativ, damit MeTrack zuverlässig unter dem Repository-Unterpfad `/MeTrack/` funktioniert.

Repository-Einstellung: **Settings → Pages → Deploy from a branch → `main` / `(root)`**. Für produktive Änderungen sollte der `main`-Branch geschützt und der Workflow **Quality** als erforderlicher Check aktiviert werden.

## Browser-Unterstützung

MeTrack ist für aktuelles Safari auf iPhone/iPad sowie aktuelle Chromium- und Firefox-Versionen ausgelegt. Ohne native Dialog-Unterstützung verwendet der Sicherungsimport einen funktionalen Systemdialog als Fallback.
