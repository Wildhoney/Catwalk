(function($app, $catwalk) {

    $app.controller('CatsController', function CatsController($scope, $timeout, $window) {
        
        var cats        = $catwalk.collection('cats'),
            colours     = $catwalk.collection('colours'), 
            countries   = $catwalk.collection('countries'), 
            people      = $catwalk.collection('people');

        $scope.addColour = function addColour(parentCatId) {

            var name = $window.prompt('What is the colour?');

            colours.createModel({
                id: 15,
                colour: name,
                cat: parentCatId
            });

        };

        $catwalk.updated(function(collections) {

            $scope.cats = collections.cats.all();

            if (!$scope.$$phase) {
                $scope.$apply();
            }

        });

        cats.watch('create', function(deferred, model) {
            deferred.resolve();
        });

        cats.watch('delete', function(deferred, model) {
            deferred.resolve();
        });

        cats.watch('update', function(deferred, model) {
            deferred.resolve();
        });

        colours.watch('read', function(deferred, property, value) {

            if (value !== 12) {
                return;
            }

            $timeout(function() {

                deferred.resolve({
                    id: value,
                    colour: 'Blue'
                });

            }, 2100);

        });

        /**
         * @method removeCat
         * @type {Function}
         */
        $scope.removeCat = function removeCat(model) {
            cats.deleteModel(model);
        };

        // Add all of the colours.
        colours.createModel({ id: 1, colour: 'Black' });
        colours.createModel({ id: 2, colour: 'White' });
        colours.createModel({ id: 3, colour: 'Ginger' });
        colours.createModel({ id: 4, colour: 'Grey' });

        // ...And add all of the cats, too.
        var kipper = cats.createModel({
            id: 1,
            name: 'Kipper',
            age: 14,
            colours: [1, 2],
            dateBorn: 'Oct 10, 1985',
            born: 1,
            owner: 1,
            friends: []
        });

        var busters = cats.createModel({
            id: 2,
            name: 'Busters',
            age: 4,
            colours: [3],
            dateBorn: 'Jul 4, 2012',
            born: 2,
            owner: 2,
            friends: []
        });

        var missKittens = cats.createModel({
            id: 3,
            name: 'Miss Kittens',
            age: 2,
            colours: [12],
            dateBorn: 'Aug 16, 2013',
            born: "2",
            owner: "2",
            friends: []
        });

        // ...And their countries.
        countries.createModel({ id: 1, name: 'United Kingdom', code: 'UK' });
        countries.createModel({ id: 2, name: 'Russian Federation', code: 'RU' });

        // ...And the possible owners.
        people.createModel({ id: 1, name: 'Adam', country: 1 });
        people.createModel({ id: 2, name: 'Masha', country: 2 });

        cats.updateModel(missKittens, {
            name: 'Lucifer',
            colours: [1,2,3,"12"]
        });

    });

})(window.exampleApp, window.catwalk);