(function($window, $catwalk, $q) {

    "use strict";

    if (typeof $catwalk === 'undefined') {
        return;
    }

    /**
     * @method hasOne
     * @param descriptor {Object}
     * @return {Function}
     */
    var hasOne = function hasOne(descriptor) {

        return _.bind(function hasOne(foreignId) {

            // Typecast the `foreignId` if necessary.
            foreignId = this._typecast(descriptor, foreignId);

            var collection  = this._getCollection(descriptor),
                model       = this._getModels(foreignId, descriptor)[0];

            // If we cannot find the model then we need to present the question of where is it
            // to the developer, so that they can resolve it.
            if (!model) {

                if (_.indexOf(collection._resolvedIds, foreignId) === -1) {

                    // Don't resolve the ID again if we've already attempted it.
                    // You only get one chance to load it!

                    var deferred = $q.defer();

                    // Present the developer with the foreign ID to load, and the promise to resolve
                    // or reject.
                    $catwalk.event.broadcastRead('read', collection, deferred, descriptor.foreignKey, foreignId);
                    collection._resolvedIds.push(foreignId);

                    // Once the promise has been resolved.
                    deferred.promise.then(function(model) {
                        collection.addModel(model);
                    });

                }

            }

            return model;

        }, this);

    };

    /**
     * @method hasMany
     * @param descriptor {Object}
     * @return {Function}
     */
    var hasMany = function hasMany(descriptor) {

        return _.bind(function hasMany(foreignIds) {

            // Typecast the `foreignIds` if necessary.
            foreignIds = this._typecast(descriptor, foreignIds);

            var collection  = this._getCollection(descriptor),
                models      = this._getModels(foreignIds, descriptor);

            // If there is a mismatch in this check then we're missing some of our
            // models. Perhaps we need an AJAX request to get more?
            if (foreignIds.length !== models.length) {

                var requiredIds = _.difference(foreignIds, _.pluck(models, 'id'));

                _.forEach(requiredIds, function(id) {

                    var deferred = $q.defer();

                    if (_.indexOf(collection._resolvedIds, id) !== -1) {
                        // Don't resolve the ID again if we've already attempted it.
                        // You only get one chance to load it!
                        return;
                    }

                    // Prompt the developer for the missing IDs with the required IDs and the
                    // promise to resolve or reject.
                    $catwalk.event.broadcastRead('read', collection, deferred, descriptor.foreignKey, id);
                    collection._resolvedIds.push(id);

                    // Once the promise has been resolved.
                    deferred.promise.then(function(model) {
                        collection.addModel(model);
                    });

                });

            }

            return models;

        }, this);

    };

    /**
     * @method belongsTo
     * @param descriptor {Object}
     * @return {Object}
     */
    var belongsTo = function belongsTo(descriptor) {

        return {

            /**
             * Responsible for updating all of the related models.
             *
             * @method createAssociation
             * @param model {Object}
             * @param key {String}
             * @return {void}
             */
            createAssociation: function createAssociation(model, key) {

                /**
                 * @method find
                 * @param d {Number|String|Boolean}
                 * @return {Boolean}
                 */
                var find = function findOne(d) {
                    return (d === model[descriptor.collection]);
                };

                var foreignCollection   = $catwalk.collection(descriptor.collection),
                    dimension           = foreignCollection._dimensions[key],
                    foreignModel        = dimension.filterFunction(find).top(Infinity)[0],
                    foreignIds          = foreignModel._relationshipMeta[descriptor.foreignKey];

                foreignIds.push(model[key]);

            }

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
        belongsTo           : belongsTo,
        hasAndBelongsToMany : function() {},

        /**
         * Responsible for obtaining the collection from the descriptor.
         *
         * @method _getCollection
         * @param descriptor {Object}
         * @return {object}
         * @private
         */
        _getCollection: function _getCollection(descriptor) {
            return $catwalk.collection(descriptor.collection);
        },

        /**
         * Responsible for obtaining the models from the descriptor.
         *
         * @method _getModels
         * @param value {Array|Number}
         * @param descriptor {Object}
         * @return {object}
         * @private
         */
        _getModels: function _getModels(value, descriptor) {

            var dimension   = this._getCollection(descriptor)._dimensions[descriptor.foreignKey],
                find        = function () {};

            if (typeof dimension === 'undefined') {
                throw 'Attempting to map to an invalid "' + descriptor.foreignKey + '" property on the "' + descriptor.collection + '" collection.';
            }

            if (_.isArray(value)) {

                // Because the `value` is an array we're dealing with a `hasMany`.
                find = function findMany(d) {
                    return _.contains(value, d);
                };

            } else {

                // Otherwise we're dealing with a `hasOne` relationship.
                find = function findOne(d) {
                    return (d === value);
                }

            }

            // Find all of the models from the foreign collection using the `find` method we
            // defined above based on whether the `value` is an array or not.
            var models = dimension.filterFunction(find).top(Infinity);

            // Reset the dimension we just filtered on.
            dimension.filterAll();

            return models;

        },

        /**
         * @method _typecast
         * @param descriptor {Object}
         * @param value {String}
         * @return {Array|Number}
         * @private
         */
        _typecast: function _typecast(descriptor, value) {

            if (descriptor.typecast) {

                if (!_.isArray(value)) {
                    return descriptor.typecast(value);
                }

                return _.map(value, function(value) {
                    return descriptor.typecast(value);
                });

            }

            return value;

        }

    };

})(window, window.catwalk, window.Q);