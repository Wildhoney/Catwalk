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

    app.post('/:collection/:id', function createModel(request, response) {
//        db.each('UPDATE ' + request.params.collection + ' WHERE id = ' + request.params.id, function row(err, row) {
//            response.send(row);
//        });
    });

    app.get('/:collection/:id', function readModel(request, response) {
        db.each('SELECT * FROM ' + request.params.collection + ' WHERE id = ' + request.params.id, function row(err, row) {
            response.send(row);
        });
    });

    app.put('/:collection/:id', function updateModel(request, response) {
//        db.each('UPDATE ' + request.params.collection + ' WHERE id = ' + request.params.id, function row(err, row) {
//            response.send(row);
//        });
    });

    app.del('/:collection/:id', function deleteModel(request, response) {
//        db.each('DELETE FROM ' + request.params.collection + ' WHERE id = ' + request.params.id, function row(err, row) {
//            response.send(row);
//        });
    });

    app.listen(8901);

})();