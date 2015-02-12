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

        $catwalk.on('refresh', function refresh() {
            $scope.models = $scope.collection.extensibleIteration();
        });

        // Fetch a list of all the beers.
        $http.jsonp('http://api.openbeerdatabase.com/v1/beers.json?callback=JSON_CALLBACK').then(function then(response) {
            $scope.collection.addModels(response.data.beers);
        });

    });

})(window.angular, window.catwalk);