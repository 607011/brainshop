# Fehler

 * Beim Anlegen eines Boards fehlt das Eingabefeld
 * Drag'n'Drop: Gruppe wird nicht als Ziel erkannt
 * Beim L�schen eines Boards: Falls dieses Board in einem anderen angeschlossenen Client aktiv ist, muss die Ansicht dort auf das davor aktive Board wechseln
 * Verschieben von Eintr�gen bei gescrollter Ansicht funktioniert nicht

# Features
 
 * Drag'n'Drop von Bildern in eine Ideen-Box; Speicherung inline per Data-URL
 * Secure WebSocket verwenden, u.a. wegen Fehler bei Firefox: 0x80530012 (SecurityError) (Umstellung auf socket.io erforderlich?)
 * Sch�neres Layout f�r Gruppen und Ideen
   - http://cs.brown.edu/~rt/gdhandbook/chapters/force-directed.pdf ?
 * das Hin- und Herspringen von Ideen beim Verschieben st�rt manchmal
 * sanftere Animation beim Verschieben


# Schl�ssel f�r HTTPS generieren

	openssl genrsa -out privatekey.pem 2048
	openssl req -new -key privatekey.pem -out certrequest.csr
	openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem


# Ideen

 * Abholen der Board-Liste vom Server per XmlHttpRequest?
 * Umstellung von datei-gest�tzter Board-Verwaltung auf SQLite3