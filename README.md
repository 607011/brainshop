# Fehler

 * Board# nicht als Idea-Attribut speichern, da Board# bereits Index der Idea-Liste


# Schl�ssel f�r HTTPS generieren

	openssl genrsa -out privatekey.pem 2048
	openssl req -new -key privatekey.pem -out certrequest.csr
	openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem


# Ideen

 * Abholen der Board-Liste vom Server per XmlHttpRequest?
 * Umstellung von datei-gest�tzter Board-Verwaltung auf SQLite3