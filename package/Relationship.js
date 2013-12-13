(function($window, $catwalk, $q) {

    "use strict";

    /**
     * @method hasOne
     * @param descriptor {Object}
     * @return {Function}
     */
    var hasOne = function hasOne(descriptor) {

        return function(foreignId) {

            var collection  = $catwalk.collection(descriptor.collection),
                dimension   = collection._dimensions[descriptor.foreignKey],
                model       = dimension.filterAll().filterFunction(function(d) {
                    return foreignId === d;
                }).top(Infinity)[0];

            // If we cannot find the model then we need to present the question of where is it
            // to the developer, so that they can resolve it.
            if (!model) {

                if (_.indexOf(collection._resolvedIds, foreignId) !== -1) {
                    // Don't resolve the ID again if we've already attempted it.
                    // You only get one chance to load it!
                    return;
                }

                var deferred = $q.defer();

                // Present the developer with the foreign ID to load, and the promise to resolve
                // or reject.
                collection._events.read(deferred, foreignId);
                collection._resolvedIds.push(foreignId);

                // Once the promise has been resolved.
                deferred.promise.then(function(model) {
                    collection.createModel(model);
                });

            }

            return model;

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

                var deferred    = $q.defer(),
                    requiredIds = _.difference(foreignIds, _.pluck(models, 'id'));

                _.forEach(requiredIds, function(id) {

                    if (_.indexOf(collection._resolvedIds, id) !== -1) {
                        // Don't resolve the ID again if we've already attempted it.
                        // You only get one chance to load it!
                        return;
                    }

                    // Prompt the developer for the missing IDs with the required IDs and the
                    // promise to resolve or reject.
                    collection._events.read(deferred, id);
                    collection._resolvedIds.push(id);

                });

                // Once the promise has been resolved.
                deferred.promise.then(function(model) {
                    collection.createModel(model);
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

})(window, window.catwalk, window.Q);