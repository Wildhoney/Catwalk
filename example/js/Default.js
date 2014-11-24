(function main($angular, $catwalk) {

    // Everything for a reason...
    $angular.module('catwalkApp', []).controller('CatsController', function CatsController($scope) {

        /**
         * @property collection
         * @type {Collection}
         */
        $scope.collection = $catwalk.createCollection('cats', {
            name: $catwalk.typecast.string()
        });

        // Add some initial cat models.
        $scope.collection.createModel({ name: 'Kipper' });
        $scope.collection.createModel({ name: 'Splodge' });
        $scope.collection.createModel({ name: 'Mango' });
        $scope.collection.createModel({ name: 'Busters' });
        $scope.collection.createModel({ name: 'Miss Kittens' });
        $scope.collection.createModel({ name: 'Tinker' });
        $scope.collection.createModel({ name: 'Merlin' });

        // Fetch all of the models from the collection.
        $scope.models = $scope.collection.extensibleIteration();

        $catwalk.on('refresh', function onRefresh() {
            console.log('Here');
        });

    });

})(window.angular, window.catwalk);