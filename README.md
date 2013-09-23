# Fehler

 * Secure WebSocket verwenden (Umstellung auf socket.io erforderlich?)
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