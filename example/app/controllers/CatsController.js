(function($app, $cats, $colours, $people, $countries) {

    $app.controller('CatsController', function CatsController($scope, $timeout) {

        $cats.watch('content', function(collection) {

            $scope.cats = collection;

            if (!$scope.$$phase) {
                $scope.$apply();
            }

        });

$cats.watch('create', function(deferred, model) {
    myApi.save(JSON.stringify(model));
    deferred.resolve();
});

        $cats.watch('delete', function(deferred, model) {
            deferred.reject();
        });

        $cats.watch('update', function(deferred, model) {
            deferred.resolve();
        });

        $colours.watch('read', function(deferred, id) {

            deferred.resolve({
                id: id,
                colour: 'Blue'
            });

        });

        /**
         * @method removeCat
         * @type {Function}
         */
        $scope.removeCat = function removeCat(model) {
            $cats.deleteModel(model);
        };

        // Add all of the colours.
        $colours.createModel({ id: 1, colour: 'Black' });
        $colours.createModel({ id: 2, colour: 'White' });
        $colours.createModel({ id: 3, colour: 'Ginger' });
        $colours.createModel({ id: 4, colour: 'Grey' });

        // ...And add all of the cats, too.
        var kipper = $cats.createModel({
            id: 1,
            name: 'Kipper',
            age: 14,
            colours: [1, 2],
            owner: 1
        });

        var busters = $cats.createModel({
            id: 2,
            name: 'Busters',
            age: 4,
            colours: [3],
            owner: 1
        });

        var missKittens = $cats.createModel({
            id: 3,
            name: 'Miss Kittens',
            age: 2,
            colours: [1, 2, 3, 4],
            owner: 1
        });

        // ...And the possible owners.
        $people.createModel({ id: 1, name: 'Adam', country: 10 });

        // ...And their countries.
        $countries.createModel({ id: 10, name: 'United Kingdom' });

//        $timeout(function() {
//
//            $cats.updateModel(missKittens, {
//                name: 'Lucifer',
//                colours: [1, 2, 12]
//            });
//
//        }, 500);

    });

})(window.exampleApp, window.cats, window.colours, window.people, window.countries);