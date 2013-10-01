# Fehler

 * Beim Löschen eines Boards: Falls dieses Board in einem anderen angeschlossenen Client aktiv ist, muss die Ansicht dort auf das davor aktive Board wechseln
 * Verschieben von Einträgen bei gescrollter Ansicht funktioniert nicht

# Features

 * Secure WebSocket verwenden (Umstellung auf socket.io erforderlich?)
 * Schöneres Layout für Gruppen und Ideen
   - http://cs.brown.edu/~rt/gdhandbook/chapters/force-directed.pdf ?
 * das Hin- und Herspringen von Ideen beim Verschieben stört manchmal
 * sanftere Animation beim Verschieben


# Schlüssel für HTTPS generieren

	openssl genrsa -out privatekey.pem 2048
	openssl req -new -key privatekey.pem -out certrequest.csr
	openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem


# Ideen

 * Abholen der Board-Liste vom Server per XmlHttpRequest?
 * Umstellung von datei-gestützter Board-Verwaltung auf SQLite3