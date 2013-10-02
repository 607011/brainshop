# Fehler

 * Verschieben einer Idee: Gruppe wird nicht als Ziel erkannt

# Features

 * Kopieren von Ideen innerhalb des Boards
 * Verschieben/Kopieren von Ideen in ein anderes Board
 * Drag'n'Drop von Bildern in eine Ideen-Box; Speicherung inline per Data-URL
 * Secure WebSocket verwenden, u.a. wegen Fehler bei Firefox: 0x80530012 (SecurityError) (Umstellung auf socket.io erforderlich?)
 * Schöneres Layout für Gruppen und Ideen
   - http://cs.brown.edu/~rt/gdhandbook/chapters/force-directed.pdf ?
 * sanftere Animation beim Verschieben


# Schlüssel für HTTPS generieren

	openssl genrsa -out privatekey.pem 2048
	openssl req -new -key privatekey.pem -out certrequest.csr
	openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem


# Ideen

 * Abholen der Board-Liste vom Server per XmlHttpRequest?
 * Umstellung von datei-gestützter Board-Verwaltung auf SQLite3