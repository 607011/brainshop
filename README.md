# Brainshop

## Web-based brainstorming 

Wenn man wie in Chats oder anderen interaktiven Anwendungen Daten zwischen Webserver und -browser übermitteln möchte, sind WebSockets das ideale Vehikel. Damit entfällt das aufwendige Polling per XmlHttpRequest. Die Brainstorming-Web-Anwendung Brainshop zeigt, wie das geht. Mehr Infos dazu im Artikel "Liveschaltung" ([c't 1/14, S. 178](http://heise.de/-2280230))

### NUTZUNGSHINWEISE

Die Software "Brainshop" ist zu Lehr- und Demonstrationszwecken entstanden und nicht für den produktiven Einsatz vorgesehen. Der Autor und der Heise Zeitschriften Verlag haften nicht für Schäden, die aus der Nutzung der Software entstehen, und übernehmen keine Gewähr für ihre Vollständigkeit, Fehlerfreiheit und Eignung für einen bestimmten Zweck.


### Schlüssel für HTTPS generieren

	openssl genrsa -out privatekey.pem 2048
	openssl req -new -key privatekey.pem -out certrequest.csr
	openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem

### To-do

#### Ideen

 * Abholen der Board-Liste vom Server per XmlHttpRequest?
 * Umstellung von datei-gestützter Board-Verwaltung auf SQLite3
 
#### Fehler

 * Verschieben einer Idee: Gruppe wird nicht als Ziel erkannt

#### Features

 * Kopieren von Ideen innerhalb des Boards
 * Verschieben/Kopieren von Ideen in ein anderes Board
 * Drag'n'Drop von Bildern in eine Ideen-Box; Speicherung inline per Data-URL
 * Secure WebSocket verwenden, u.a. wegen Fehler bei Firefox: 0x80530012 (SecurityError) (Umstellung auf socket.io erforderlich?)
 * Schöneres Layout für Gruppen und Ideen
   - http://cs.brown.edu/~rt/gdhandbook/chapters/force-directed.pdf ?
 * sanftere Animation beim Verschieben
