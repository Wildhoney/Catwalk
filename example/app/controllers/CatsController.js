(function($app, $cats, $colours) {

    $app.controller('CatsController', function CatsController($scope, $timeout) {

        $cats.watch('content', function(collection) {

            $scope.cats = collection;

            if (!$scope.$$phase) {
                $scope.$apply();
            }

        });

        $cats.on('create', function(promise, model) {

        });

        $cats.on('delete', function(promise, model) {

        });

        $cats.on('update', function(promise, model) {

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
        var kipper      = $cats.createModel({ id: 1, name: 'Kipper', age: 14, colours: [1, 2] });
        var busters     = $cats.createModel({ id: 2, name: 'Busters', age: 4, colours: [3] });
        var missKittens = $cats.createModel({ id: 3, name: 'Miss Kittens', age: 2, colours: [1, 2, 3, 4] });

//        $timeout(function() {
//
//            $cats.deleteModel(missKittens);
//
//        }, 500);

    });

})(window.exampleApp, window.cats, window.colours);