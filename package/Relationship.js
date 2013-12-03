(function($window, $catwalk) {

    var hasOne = function hasOne(descriptor) {

        return function(foreignId) {

            var collection  = $catwalk.collection(descriptor.collection),
                dimension   = collection._dimensions[descriptor.foreignKey],
                models      = dimension.filterAll().filterFunction(function(d) {
                    return foreignId === d;
                }).top(Infinity) || [];

            // If we cannot find the model then we need to present the question of where is it
            // to the developer, so that they can resolve it.
            if (models.length === 0) {

                var defer = Q.defer();

                // Present the developer with the foreign ID to load, and the promise to resolve
                // or reject.
                collection._events.read(foreignId, defer);

                // Once the promise has been resolved.
                defer.promise.then(function(model) {
                    models.push(model);
                    console.log(models);
                });

            }

            return models[0];

        };

    };

    /**
     * @method hasMany
     * @param descriptor {Object}
     * @return {Function}
     */
    var hasMany = function hasMany(descriptor) {

        return function(foreignIds) {

            var collection  = $catwalk.collection(descriptor.collection),
                dimension   = collection._dimensions[descriptor.foreignKey],
                models      = dimension.filterAll().filterFunction(function(d) {
                    return !!_.contains(foreignIds, d);
                }).top(Infinity);

            // If there is a mismatch in this check then we're missing some of our
            // models. Perhaps we need an AJAX request to get more?
            if (foreignIds.length !== models.length) {

                var defer       = Q.defer(),
                    requiredIds = _.difference(foreignIds, _.pluck(models, 'id'));

                // Prompt the developer for the missing IDs with the required IDs and the
                // promise to resolve or reject.
                collection._events.read(requiredIds, defer);

                // Once the promise has been resolved.
                defer.promise.then(function(models) {
                    models = models.concat(models);
                    collection.addModels(models);
                    console.log(models);
                });

            }

            return models;

        };

    };

    /**
     * @module Catwalk
     * @submodule Collection
     * @type {Object}
     * @reference http://book.cakephp.org/2.0/en/models/associations-linking-models-together.html
     */
    $window.catwalk.relationship = {

        hasOne              : hasOne,
        hasMany             : hasMany,
        belongsTo           : function() {},
        hasAndBelongsToMany : function() {}

    };

})(window, window.catwalk);