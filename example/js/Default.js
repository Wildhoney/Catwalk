(function main($angular, $catwalk) {

    // Everything for a reason...
    $angular.module('catwalkApp', []).controller('BeersController', function BeersController($scope, $http) {

        /**
         * @property collection
         * @type {Collection}
         */
        $scope.collection = $catwalk.createCollection('beers', {
            name:        $catwalk.typecast.string(),
            description: $catwalk.typecast.string(),
            abv:         $catwalk.typecast.number()
        });

        $catwalk.on('delete', function onDelete(model, promise) {
            promise.resolve();
        });

        // Fetch all of the models from the collection.
        $scope.models = $scope.collection.extensibleIteration();

        $catwalk.on('refresh', function onRefresh() {
            
            $scope.models = $scope.collection.extensibleIteration();

            if (!$scope.$$phase) {
                $scope.$apply();
            }

        });

        // Fetch a list of all the beers.
        $http.jsonp('http://api.openbeerdatabase.com/v1/beers.json?callback=JSON_CALLBACK').then(function then(response) {
            $scope.collection.addModels(response.data.beers);
        });

    });

})(window.angular, window.catwalk);