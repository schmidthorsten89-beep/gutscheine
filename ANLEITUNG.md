# Gutschein-App einrichten

Du brauchst ein Google-Konto und ein kostenloses GitHub-Konto. Die zweite Person braucht keins von beiden.

## 1. Google Sheet und Backend

1. Lege auf [sheets.new](https://sheets.new) eine neue Tabelle an, z. B. „Gutscheine".
2. Öffne **Erweiterungen > Apps Script**.
3. Ersetze den Inhalt von `Code.gs` durch den Inhalt der Datei `apps-script/Code.gs` und speichere.
4. Wähle oben die Funktion **einrichten** aus und klicke auf **Ausführen**. Bestätige die Berechtigungen deines Kontos.
5. Kopiere den **Token** aus dem Ausführungsprotokoll.
6. Klicke auf **Bereitstellen > Neue Bereitstellung > Typ: Web-App** und stelle ein:
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
7. Klicke auf **Bereitstellen** und kopiere die **Web-App-URL** (endet auf `/exec`).

## 2. App veröffentlichen

1. Lege auf [github.com/new](https://github.com/new) ein neues Repository an, z. B. `gutscheine`.
2. Lade über **uploading an existing file** den **Inhalt** dieses Ordners hoch, also `index.html` usw. direkt in die oberste Ebene. Der Code enthält weder URL noch Token, das Repository darf also öffentlich sein.
3. Stelle unter **Settings > Pages** bei „Branch" `main` und `/ (root)` ein und speichere.
4. Nach etwa einer Minute läuft die App unter `https://DEINNAME.github.io/gutscheine/`.

## 3. Auf dem Handy installieren

1. Öffne die Adresse in **Chrome** auf dem Android-Handy.
2. Tippe auf **⚙** und trage URL und Token ein. Danach sollte oben keine Fehlermeldung stehen.
3. Wähle im Chrome-Menü **Zum Startbildschirm hinzufügen** bzw. **App installieren**.

## 4. Mit der zweiten Person teilen

1. Tippe in der App auf **⚙ > Einrichtungslink kopieren** und schicke den Link privat.
2. Die Person öffnet ihn in Chrome und installiert die App wie in Schritt 3.

Wer den Link hat, hat vollen Zugriff auf eure Gutscheine.

## Gut zu wissen

- **Link gesperrt werden soll:** Führe im Apps-Script-Editor `tokenErneuern` aus, trage den neuen Token auf deinem Handy ein und schicke einen neuen Link.
- **Änderung an `Code.gs`:** Sie wird erst aktiv über **Bereitstellen > Bereitstellungen verwalten > Bearbeiten > Version: Neue Version**. Die URL bleibt dabei gleich.
- **Änderung an den App-Dateien:** Erhöhe in `sw.js` die Nummer bei `CACHE` und lade die Dateien neu hoch.
- **Sheet:** Bearbeite die Tabelle möglichst nicht von Hand. Spaltenreihenfolge und Überschriften müssen gleich bleiben.
