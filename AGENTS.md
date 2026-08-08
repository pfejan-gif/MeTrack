# MeTrack – Arbeitsregeln für Coding-Agents

## Repository und Veröffentlichung

- GitHub-Repository: `pfejan-gif/MeTrack`
- Standardbranch: `main`
- GitHub Pages: `https://pfejan-gif.github.io/MeTrack/`
- GitHub Pages veröffentlicht den Inhalt von `main` aus dem Repository-Stamm.
- In ChatGPT Work/Codex ist das Repository über die verbundene GitHub-App erreichbar. Dafür die Connector-Werkzeuge `mcp__codex_apps__github_*` mit `repository_full_name: "pfejan-gif/MeTrack"` verwenden.
- Wenn die lokale GitHub-CLI `gh` fehlt, aber die verbundene GitHub-App die benötigte Operation abdeckt, den Connector verwenden und nicht allein wegen der fehlenden CLI abbrechen.

## Merge-Regel

- Kleine, klar abgegrenzte und risikoarme Änderungen werden nach erfolgreicher Prüfung standardmäßig bis `main` gemergt. Sie sollen nicht ungemergt auf einem Arbeitsbranch liegen bleiben, sofern der Nutzer nichts anderes verlangt.
- Ein kurzlebiger Branch oder Pull Request darf für Nachvollziehbarkeit und CI verwendet werden; nach grünen Checks wird er im selben Arbeitsgang gemergt.
- Größere oder risikoreiche Änderungen bleiben zunächst auf einem eigenen Branch als Draft-PR und werden erst nach ausdrücklicher Freigabe gemergt.
- Als größere Änderungen gelten insbesondere Datenmodell- oder Migrationsänderungen, neue Abhängigkeiten oder Buildsysteme, größere UI-Neugestaltungen, Änderungen an Import/Export oder Speicherung, sicherheits- oder datenschutzrelevante Eingriffe sowie umfangreiche Refactorings.
- Niemals fehlgeschlagene Checks umgehen, `main` per Force-Push überschreiben oder einen veränderten PR-Head ohne erneute Prüfung mergen.

## Qualitäts- und PWA-Regeln

- Vor einer Veröffentlichung mindestens `npm run verify` ausführen.
- Bei HTML-, CSS- oder JavaScript-Änderungen App-Version, `APP_VERSION` und Service-Worker-Cache-Version synchron erhöhen, damit installierte PWAs das Update erhalten.
- Bestehende lokale Nutzerdaten müssen erhalten bleiben. Änderungen an Speicherung, Migration oder Import benötigen eigene Tests und gelten als größere Änderung.
- Nach einem Merge die GitHub-Pages-Adresse und die betroffenen statischen Ressourcen prüfen.
