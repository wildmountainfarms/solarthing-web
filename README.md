# solarthing-web
The web app to show how much power is being used at Wild Mountain Farms

This backend reads data from a serial port on an Outback MATE, and uploads it to a CouchDB
database. This web application accesses that CouchDB database and displays the data
from FX's and MX's.

See the backend here: https://github.com/wildmountainfarms/solarthing


### Recommended set up
This can be easily set up by installing `apache2`. If you want to use docker, you can run this command and
do the set up in `/var/www/html` just like you're using apache2: `sudo docker run -p 81:80 -v /var/www/html:/usr/local/apache2/htdocs/ httpd`. 
Change the 81 to whatever port you want.

You can clone this repository and it is recommended to rename the directory to `solarthing`. Usually navigating to
SolarThing involves going to something like `http://192.168.10.251/solarthing`.
