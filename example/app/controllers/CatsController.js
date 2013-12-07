(function($app, $cats, $colours) {

    $app.controller('CatsController', function CatsController($scope) {

        $cats.when('create', function() {
            $scope.cats = $cats.all();
        });

        $colours.addModel({ id: 1, colour: 'Black' });
        $colours.addModel({ id: 2, colour: 'White' });
        $colours.addModel({ id: 3, colour: 'Ginger' });
        $colours.addModel({ id: 4, colour: 'Grey' });

        $cats.addModel({ id: 5, name: 'Kipper', age: 14, colours: [1, 2] });

    });

})(window.exampleApp, window.cats, window.colours);