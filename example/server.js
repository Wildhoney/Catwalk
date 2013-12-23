(function() {

    var express = require('express'),
        app     = express(),
        sqlite3 = require('sqlite3').verbose(),
        db = new sqlite3.Database('Cats.sqlite');

    app.all('*', function(request, response, next) {

        response.header('Access-Control-Allow-Origin', '*');
        response.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-File-Type, X-File-Name, X-File-Size');
        response.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, HEAD, OPTIONS');
        next();

    });

    app.get('/cats', function getCats(request, response) {
        var models = [];
        db.each('SELECT * FROM cats', function row(err, row) {
            row.colours = row.colours.split(',');
            models.push(row);
        }, function complete() {
            response.send(models);
        });
    });

    app.get('/people/:id', function getPeople(request, response) {
        db.each('SELECT * FROM people WHERE id = ' + request.params.id, function row(err, row) {
            response.send(row);
        });
    });

    app.get('/colours/:id', function getColours(request, response) {
        db.each('SELECT * FROM colours WHERE id = ' + request.params.id, function row(err, row) {
            response.send(row);
        });
    });

    app.get('/countries/:id', function getCountries(request, response) {
        db.each('SELECT * FROM countries WHERE id = ' + request.params.id, function row(err, row) {
            response.send(row);
        });
    });

    app.listen(8901);

})();