(function($app, $cats, $colours) {

    $app.controller('CatsController', function CatsController($scope) {

        $colours.defineEvent('create', function() {
            $scope.cats = $colours.all();
        });

        $colours.addModel({ id: 1, colour: 'Black' });
        $colours.addModel({ id: 2, colour: 'White' });
        $colours.addModel({ id: 3, colour: 'Ginger' });
        $colours.addModel({ id: 4, colour: 'Grey' });

    });

})(window.exampleApp, window.cats, window.colours);