(function($app, $cats, $colours) {

    $app.controller('CatsController', function CatsController($scope) {

        $cats.when('create', function(models) {
            $scope.cats = $cats.all();
        });

        $cats.when('delete', function(models) {
            $scope.cats = $cats.all();
        });

        /**
         * @method removeCat
         * @type {Function}
         */
        $scope.removeCat = function removeCat(model) {
            $cats.removeModel(model);
        };

        // Add all of the colours.
        $colours.addModel({ id: 1, colour: 'Black' });
        $colours.addModel({ id: 2, colour: 'White' });
        $colours.addModel({ id: 3, colour: 'Ginger' });
        $colours.addModel({ id: 4, colour: 'Grey' });

        // ...And add all of the cats, too.
        $cats.addModel({ id: 1, name: 'Kipper', age: 14, colours: [1, 2] });
        $cats.addModel({ id: 2, name: 'Busters', age: 4, colours: [3] });
        $cats.addModel({ id: 3, name: 'Miss Kittens', age: 4, colours: [1, 2, 3, 4] });

    });

})(window.exampleApp, window.cats, window.colours);