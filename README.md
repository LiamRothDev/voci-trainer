# Voci-Trainer

Eine eigene Lern-App für Vokabeln: **Karteikarten, Lernen, Test und Zuordnen** – wie man es von
Lernkarten-Seiten wie Quizlet kennt, aber komplett selbst gebaut (eigener Code, eigenes Design).
Läuft ohne Installation im Browser, auf Computer und Handy, und speichert den Lernfortschritt im Browser.

> Unabhängiges Projekt, kein Bezug zu Quizlet Inc.

## Was die App kann

| Modus | So funktioniert's |
|---|---|
| **Karteikarten** | Karte antippen oder Leertaste zum Umdrehen, blättern, mischen, vorlesen, automatisch abspielen. Mit «Fortschritt verfolgen» sortierst du jede Karte in *Gewusst* oder *Noch am Lernen* (mit Rückgängig). |
| **Lernen** | Zuerst Multiple Choice, danach schriftlich. Falsche Antworten kommen in der gleichen Runde nochmal. Jede Karte geht von *Neu* über *Am Lernen* zu *Gemeistert*. |
| **Test** | Richtig/Falsch, Multiple Choice, Zuordnen und Schriftlich gemischt – am Schluss mit **Note (Schweizer Skala 1–6)** und Auswertung. «Fehler wiederholen» macht einen neuen Test nur mit den Fehlern. |
| **Zuordnen** | 6 Paare gegen die Zeit. Ein falsches Paar kostet 1 Sekunde, dein Rekord wird gespeichert. |

Ausserdem: Karten mit Stern markieren, eigene Sets erstellen (Liste einfügen), Hell-/Dunkelmodus.

**Faire Antwortprüfung beim Schreiben:** Gross-/Kleinschreibung und Satzzeichen sind egal, «ss» statt «ß» ist ok,
Klammern sind freiwillig, bei «Kollege, Kollegin» reicht eine Variante, bei «Aktivist/-in» gehen beide Formen,
und «to», «hier:» sowie Platzhalter wie *sb/sth/etw./jmdn.* dürfen fehlen. Wenn du trotzdem recht hattest,
gibt es den Knopf «Ich hatte recht».

## Starten

Ordner herunterladen und **`index.html` doppelklicken** – die App öffnet sich im Browser.

## Tastenkürzel

| Wo | Taste | Aktion |
|---|---|---|
| Karteikarten | Leertaste, ↑, ↓ | Karte umdrehen |
| | ← → | blättern – oder mit Fortschritt: *Noch am Lernen* / *Gewusst* |
| | S | Karte markieren |
| | Strg + Z | Rückgängig |
| Lernen | 1 – 4 | Antwort wählen |
| | Enter | weiter |

## Eigene Vokabeln

- **In der App:** Startseite → «Neues Set erstellen» → Liste einfügen, eine Karte pro Zeile,
  z. B. `house - das Haus`, `beautiful = schön` oder mit Tabulator getrennt (so kommt es aus Excel).
- **Fest eingebaut:** in `data/sets.js` ein weiteres Set ergänzen (Format `["Begriff", "Bedeutung"]`).

## Woher die Vokabeln stammen

Das eingebaute Set «Englisch Voci 1.1+1.3» (348 Begriffe) stammt aus einem öffentlichen
[Quizlet-Set](https://quizlet.com/de/karteikarten/englisch-voci-1113-1220432163) einer anderen Person und ist
**nur zum persönlichen Lernen** gedacht. Darum ist dieses Repository privat. Bitte nicht öffentlich machen
(auch nicht über GitHub Pages), solange die Liste drin ist – ausser die Person, die das Set erstellt hat, ist einverstanden.

Beim Übernehmen wurden Leerzeichen-Fehler aufgeräumt (z. B. «etw . tun» → «etw. tun», «non - binary» → «non-binary»)
und sechs eindeutige Tippfehler korrigiert:

| Vorher | Nachher |
|---|---|
| → passion gender | → passion |
| to Page the way for sth/sb | to pave the way for sth/sb |
| Sphäre | sphere |
| day to have a negative impact on sth | to have a negative impact on sth |
| Verschmelzung von Technologen | Verschmelzung von Technologien |
| Geschlechtspezifisches Lohngefälle | Geschlechtsspezifisches Lohngefälle |

## Aufbau

```
index.html          Einstieg
css/style.css       Design (hell + dunkel)
data/sets.js        eingebaute Vokabel-Sets
js/util.js          Helfer, Antwortprüfung, Listen-Import
js/store.js         Speicher im Browser: Fortschritt, eigene Sets, Optionen
js/speech.js        Vorlesen mit der Sprachausgabe des Browsers
js/ui.js            Icons und gemeinsame Bausteine
js/views/           Seiten: Start, Set-Übersicht, Karteikarten, Lernen, Test, Zuordnen, Set-Editor
js/app.js           Start und Navigation
sw.js               Offline-Speicher (wenn die App über eine Webadresse läuft)
```

Reines HTML, CSS und JavaScript – kein Build-Schritt, keine Abhängigkeiten.
