(function($app, $catwalk) {

    $app.controller('CatsController', function CatsController($scope, $window, $http) {

        $scope.cats = [];

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

//        $catwalk.on('update', function(collection, deferred, model) {
//
//        });

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

            $http({ url: 'http://localhost:8901/colours/' + value, method: 'get' }).then(function complete(model) {
                deferred.resolve(model.data);
            });

        });

        countries.watch('read', function(deferred, property, value) {

            $http({ url: 'http://localhost:8901/countries/' + value, method: 'get' }).then(function complete(model) {
                deferred.resolve(model.data);
            });

        });

        people.watch('read', function(deferred, property, value) {

            $http({ url: 'http://localhost:8901/people/' + value, method: 'get' }).then(function complete(model) {
                deferred.resolve(model.data);
            });

        });

        $http({ url: 'http://localhost:8901/cats', method: 'get' }).then(function complete(models) {

            _.forEach(models.data, function(model) {
                cats.addModel(model);
            });

        });

    });

})(window.exampleApp, window.catwalk);