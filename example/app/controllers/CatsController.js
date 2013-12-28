(function($app, $catwalk) {

    $app.controller('CatsController', function CatsController($scope, $window, $http) {

        /**
         * @property cats
         * @type {Array}
         */
        $scope.cats = [];

        /**
         * @property url
         * @type {String}
         */
        $scope.url = 'http://localhost:8901/';

        var cats        = $catwalk.collection('cats'),
            colours     = $catwalk.collection('colours'), 
            countries   = $catwalk.collection('countries'), 
            people      = $catwalk.collection('people');

        /**
         * @method addColour
         * @param parentCatId {Number}
         * @return {void}
         */
        $scope.addColour = function addColour(parentCatId) {

            var name    = $window.prompt('What is the colour?');

            colours.createModel({
                id: null,
                name: name,
                cats: parentCatId
            });

        };

        /**
         * @method removeCat
         * @param model {Object}
         * @return {void}
         */
        $scope.removeCat = function removeCat(model) {
            cats.deleteModel(model);
        };

        // When the content of a collection has been updated.
        $catwalk.updated(function(collections) {

            $scope.cats = collections.cats.all();

            if (!$scope.$$phase) {
                $scope.$apply();
            }

        });

        // When a model has been added to the collection.
        $catwalk.event.on('create', function(collection, deferred, model) {

            var colours = _.where(this.collection('colours').all(), { name: model.name });

            if (colours.length > 1) {
                deferred.resolve(colours[colours.length - 1]);
                return;
            }

            deferred.resolve();

        });

        // When a model has been updated in the collection.
        $catwalk.event.on('update', function(collection, deferred, model) {

            var request = $http({
                url:    $scope.url + collection + '/' + model.id,
                method: 'put'
            });

            request.then(function updated() {
                deferred.resolve();
            });

        });

        // When a model is needed to be loaded into the collection.
        $catwalk.event.on('read', function(collection, deferred, property, value) {

            var request = $http({
                url:    $scope.url + collection + '/' + value,
                method: 'get'
            });

            request.then(function read(model) {
                deferred.resolve(model.data);
            });

        });

        // When a model has been deleted from the collection.
        $catwalk.event.on('delete', function(collection, deferred, model) {

            var request = $http({
                url:    $scope.url + collection + '/' + model.id,
                method: 'delete'
            });

            request.then(function deleted() {
                deferred.resolve();
            });

        });

        // Get the starting path which is an array of all the cats.
        $http({ url: 'http://localhost:8901/cats', method: 'get' }).then(function complete(models) {

            _.forEach(models.data, function(model) {
                cats.addModel(model);
            });

        });

    });

})(window.exampleApp, window.catwalk);