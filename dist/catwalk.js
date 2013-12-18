(function($window) {

    "use strict";

    if (typeof $window.catwalk === 'undefined') {
        return;
    }

    /**
     * @method toString
     */
    var toString = function toString(value) {
        return String(value);
    };

    /**
     * @method toInteger
     */
    var toInteger = function toInteger(value) {
        return Number(value);
    };

    /**
     * @method toFloat
     */
    var toFloat = function toFloat(decimalPlaces) {
        return function(value) {
            return Number(value).toFixed(decimalPlaces);
        }
    };

    /**
     * @method toDate
     */
    var toDate = function toDate(format) {

        if (typeof $window.moment === 'undefined') {
            throw 'Typecasting to date format requires Moment.js: http://momentjs.com/';
        }

        return function(value) {
            return $window.moment(value).format(format);
        }
    };

    /**
     * @method toBoolean
     */
    var toBoolean = function toBoolean(value) {
        return Boolean(value);
    };

    /**
     * @method toCustom
     */
    var toCustom = function toCustom(callback) {
        return callback;
    };

    /**
     * @module Catwalk
     * @submodule Collection
     * @type {Object}
     * @reference http://book.cakephp.org/2.0/en/models/associations-linking-models-together.html
     */
    $window.catwalk.attribute = {

        string  : toString,
        number  : toInteger,
        integer : toInteger,
        date    : toDate,
        float   : toFloat,
        boolean : toBoolean,
        custom  : toCustom

    };

})(window);;(function($window) {

    "use strict";

    if (typeof $window.Q === 'undefined') {
        throw 'Catwalk requires Q: https://github.com/kriskowal/q';
    }

    if (typeof $window._ === 'undefined') {
        throw 'Catwalk requires Underscore: http://underscorejs.org/';
    }

    if (typeof $window.crossfilter === 'undefined') {
        throw 'Catwalk requires Crossfilter: https://github.com/square/crossfilter';
    }

    /**
     * @module Catwalk
     * @type {Object}
     */
    $window.catwalk = {};

})(window);;(function($catwalk, $q, $crossfilter) {

    "use strict";

    if (typeof $catwalk === 'undefined') {
        return;
    }

    /**
     * @property _collections
     * @type {Object}
     * @private
     */
    var _collections = {};

    /**
     * @module Catwalk
     * @submodule Collection
     * @type {Object}
     */
    var CatWalkCollection = function CatWalkCollection(name, properties) {

        if (typeof properties._primaryKey === 'undefined') {
            throw 'You must define the `_primaryKey` property for your collection.';
        }

        if (!_.contains(_.keys(properties), properties._primaryKey)) {
            throw 'Your `_primaryKey` must map to one of your collection properties.';
        }

        /**
         * @method noop
         * @return {void}
         */
        var noop = function noop() {};

        // Reset the variables because of JavaScript!
        this._crossfilter   = {};
        this._dimensions    = {};
        this._properties    = {};
        this._deletedIds    = [];
        this._resolvedIds   = [];
        this._events        = {
            create:     noop,
            read:       noop,
            update:     noop,
            delete:     noop,
            content:    noop
        };

        // Gather the name and the properties for the models.
        this._name          = name;
        this._properties    = properties;

        // Initiate the Crossfilter and its related dimensions.
        var _crossfilter     = this._crossfilter = $crossfilter([]),
            _dimensions      = this._dimensions;

        // Create the dimensions for our model properties.
        var keys = _.keys(properties);

        _.forEach(keys, function(key) {

            if (key.charAt(0) === '_' || key.charAt(0) === '$') {
                // We don't wish to include private/protected members.
                return;
            }

            // Create a dimension for each and every model property!
            _dimensions[key] = _crossfilter.dimension(function(d) {
                return d[key];
            });

        });

        // Create the dimension for the internal _catwalkId!
        _dimensions['catwalkId'] = _crossfilter.dimension(function(d) {
            return d['_catwalkId'];
        });

    };

    /**
     * @property prototype
     * @type {Object}
     */
    CatWalkCollection.prototype = {

        /**
         * @property _name
         * @type {String}
         * @private
         */
        _name: '',

        /**
         * @property events
         * @type {Object}
         */
        _events: {},

        /**
         * @property resolvedIds
         * @type {Array}
         */
        _resolvedIds: [],

        /**
         * @property _properties
         * @type {Object}
         * @private
         */
        _properties: {},

        /**
         * @property _crossfilter
         * @type {Object}
         * @private
         */
        _crossfilter: {},

        /**
         * @property _dimensions
         * @type {Object}
         * @private
         */
        _dimensions: {},

        /**
         * @property _deletedIds
         * @type {Array}
         */
        _deletedIds: [],

        /**
         * @method watch
         * @param type {String}
         * @param callback {Function}
         * @return {void}
         */
        watch: function watch(type, callback) {
            this._events[type] = callback;
        },

        /**
         * @method all
         * @return {Array}
         */
        all: function all() {
            return this._dimensions[this._properties._primaryKey].filterAll().top(Infinity);
        },

        /**
         * @method size
         * @return {Number}
         */
        size: function size() {
            return this._crossfilter.size();
        },

        /**
         * @method addModel
         * @param model {Object}
         * @return {Object}
         */
        addModel: function addModel(model) {
            return this.createModel(model, false);
        },

        /**
         * @method createModel
         * @param model {Object}
         * @param [emitEvent = true] {Boolean}
         * @return {Object}
         */
        createModel: function createModel(model, emitEvent) {

            var propertyMap         = this._properties,
                createRelationship  = _.bind(this._createRelationship, this),
                relationships       = this._properties._relationships || {},
                defaultDimension    = this._dimensions.catwalkId;

            // Remove the property meta as that will be constructed again.
            delete model._propertyMeta;

            // Apply an internal Catwalk ID to the model.
            model._catwalkId    = parseInt(_.uniqueId(), 10);
            model._collection   = this._name;
            model._propertyMeta = _.clone(model);

            // Fill in the model with any defaults that have been configured.
            _.forEach(this._properties, _.bind(function(value, property) {

                if (property.charAt(0) === '_') {
                    // Don't include any private Catwalk variables in the inheritance.
                    return;
                }

                // Determine if it's one of the default types, and it hasn't been set
                // by the current model.
                var validType   = _.contains(['number', 'string', 'boolean', 'object'], typeof value),
                    notSet      = typeof model[property] === 'undefined';

                if (notSet && validType) {
                    // Update the model's property to be the default value.
                    model[property] = value;
                }

            }, this));

            // Iterate over the properties to typecast them.
            _.forEach(model, function(value, key) {

                if (key.charAt(0) === '_' || key.charAt(0) === '$') {
                    // We can't do much with private/protected members.
                    return;
                }

                // Determine if this property is part of a relationship.
                if (typeof relationships[key] === 'function') {
                    createRelationship(model, key, value);
                    return;
                }

                try {

                    if (typeof propertyMap[key] === 'function') {

                        // Typecast the property based on what's defined in the collection.
                        model[key] = propertyMap[key](value);
                        return;

                    }

                    // Otherwise we'll attempt to typecast the value based on the default value.
                    var type         = typeof propertyMap[key],
                        typecastable = _.contains(['string', 'number', 'boolean'], type);

                    if (typecastable) {
                        model[key] = $catwalk.attribute[type](value);
                    }

                } catch (e) {

                    // Otherwise we'll throw the exception to notify the developer that the
                    // key was missed from the collection.
                    throw 'You forgot to define the `' + key + '` property on the collection blueprint.';

                }

            });

            // Add the model to our Crossfilter, and then finalise the creation!
            this._crossfilter.add([model]);

            return this._finalise('create', defaultDimension.top(Infinity)[0], {}, emitEvent);

        },

        /**
         * @method _createResolve
         * @param model {Object}
         * @param previousModel {Object}
         * @param properties {Object}
         * @return {void}
         * @private
         */
        _createResolve: function _createResolve(model, previousModel, properties) {

            // Iterate over each model to ensure the developer isn't attempting to update
            // a relationship during its creation.
//            for (var property in properties) {
//
//                if (properties.hasOwnProperty(property)) {
//
//                    if (typeof model._relationshipMeta[property] === 'undefined') {
//                        continue;
//                    }
//
//                    throw 'You are attempting to manipulate the "' + property + '" relationship during model creation.';
//
//                }
//
//            }

            // Update the model with the properties that the resolve wanted to add
            // to the model after creation.
            model = _.extend(model, properties);

        },

        /**
         * @method _createReject
         * @param model {Object}
         * @return {void}
         * @private
         */
        _createReject: function _createReject(model) {
            this.deleteModel(model, false);
        },

        /**
         * @method updateModel
         * @param model {Object}
         * @param properties {Object}
         * @param [emitEvent = true] {Boolean}
         * @return {Object}
         */
        updateModel: function updateModel(model, properties, emitEvent) {

            // Assert that the model is valid for this collection.
            this._assertValid(model);

            // Delete the model from the Crossfilter.
            this.deleteModel(model, false);

            // Create the new model with the properties from the old model, overwritten with
            // the properties we're updating the model with.
            var updatedModel = _.extend(_.clone(model._propertyMeta), properties);

            // Copy across the relationships as well.
            _.forEach(this._properties._relationships, function(relationship, property) {

                // Gather the raw relational data from the relationship meta data.
                delete updatedModel[property];
                updatedModel[property] = properties[property] ? properties[property]
                                                              : model._relationshipMeta[property];

            });

            // Remove the meta data for the relationships because it will be created again with
            // the `createModels` method.
            delete updatedModel._relationshipMeta;

            // Create the new model and add it to the Crossfilter.
            return this._finalise('update', this.createModel(updatedModel, false), model, emitEvent);

        },

        /**
         * @method _updateReject
         * @param model {Object}
         * @param previousModel {Object}
         * @return {void}
         * @private
         */
        _updateReject: function _updateReject(model, previousModel) {
            this.deleteModel(model, false);
            this._reanimateModel(previousModel);
        },

        /**
         * @method deleteModel
         * @param model {Object}
         * @param [emitEvent = true] {Boolean}
         * @return {Object}
         */
        deleteModel: function deleteModel(model, emitEvent) {

            // Assert that the model is valid for this collection.
            this._assertValid(model);

            var deletedIds = this._deletedIds;

            if (!('_catwalkId' in model)) {
                throw 'You are attempting to remove a non-Catwalk model.';
            }

            // Add the model to the deleted array.
            deletedIds.push(model._catwalkId);

            // Remove the model by its internal Catwalk ID.
            this._dimensions.catwalkId.filterFunction(function(d) {
                return !(_.contains(deletedIds, d));
            });

            return this._finalise('delete', model, {}, emitEvent);

        },

        /**
         * @method _deleteReject
         * @param model {Object}
         * @return {void}
         * @private
         */
        _deleteReject: function _deleteReject(model) {
            this._reanimateModel(model);
        },

        /**
         * Bring a model back to life after being removed.
         *
         * @method _reanimateModel
         * @param model {Object}
         * @return {void}
         * @private
         */
        _reanimateModel: function _reanimateModel(model) {

            var catwalkId   = model._catwalkId,
                index       = _.indexOf(this._deletedIds, catwalkId);

            // Remove the deleted ID from the array.
            this._deletedIds.splice(index, 1);

            // Reanimate our model!
            this._dimensions.catwalkId.filterFunction(_.bind(function(d) {
                return !(_.contains(this._deletedIds, d));
            }, this));

        },

        /**
         * @method _createRelationship
         * @param model {Object}
         * @param key {String}
         * @param ids {Array|Number|String}
         * @return {void}
         * @private
         */
        _createRelationship: function _createRelationship(model, key, ids) {

            var _relationships = this._properties._relationships || {};

            Object.defineProperty(model, key, {

                /**
                 * Responsible for invoking the `hasOne`/`hasMany` method to complete
                 * the mapped relationship.
                 *
                 * @method get
                 * @return {Object}
                 */
                get: function() {
                    return _relationships[key](ids);
                }

            });

            // Create the relationship meta data for the actual relational IDs.
            if (!('_relationshipMeta' in model)) {
                model._relationshipMeta = {};
            }

            model._relationshipMeta[key] = ids;

        },

        /**
         * @method _assertValid
         * @param model {Object}
         * @return {Boolean}
         * @private
         */
        _assertValid: function _assertValid(model) {

            if (!('_catwalkId' in model)) {
                throw 'You are attempting to manipulate a non-Catwalk model.';
            }

            if (_.indexOf(this._deletedIds, model._catwalkId) !== -1) {
                throw 'You are trying to modify a model in the garbage collection.';
            }

            if (model._collection !== this._name) {
                throw 'Model belongs to "' + model._collection + '" collection, not "' + this._name + '".';
            }

            return true;

        },


        /**
         * @method finalise
         * @param eventName {String}
         * @param model {Object}
         * @param [previousModel = {}] {Object}
         * @param [emitEvent = true] {Boolean}
         * @return {Object}
         * @private
         */
        _finalise: function _finalise(eventName, model, previousModel, emitEvent) {

            emitEvent = !!((typeof emitEvent === 'undefined' || emitEvent));

            // Create the deferred that the developer must resolve or reject.
            var deferred = $q.defer();

            /**
             * @method contentUpdated
             * @return {void}
             */
            var contentUpdated = _.bind(function contentUpdated() {

                // Content has been updated!
                this._events.content(this.all());

            }, this);

            /**
             * @method simplifyModel
             * @param model {Object}
             * @return {Object}
             */
            var simplifyModel = function simplifyModel(model) {

                if (typeof model === 'undefined') {
                    return {};
                }

                model = _.clone(model);

                // Map each relationship to its simple list of IDs.
                _.forEach(model._relationshipMeta, function(relationship, property) {
                    model[property] = relationship;
                });

                // Delete the unnecessary properties.
                var meta = model._propertyMeta;
                delete meta._collection;
                delete meta._catwalkId;
                delete meta._relationshipMeta;
                delete meta._propertyMeta;
                return meta;

            };

            /**
             * @method invokeCallback
             * @param state {String}
             * @return {void}
             */
            var invokeCallback = _.bind(function(state, properties) {

                // Find the related resolve/reject method and invoke it.
                var methodName  = '_' + eventName + state,
                    callback    = this[methodName];

                if (typeof callback !== 'function') {
                    return;
                }

                callback.apply(this, [model, previousModel, properties]);

            }, this);

            if (emitEvent) {

                // Invoke the related CRUD function.
                this._events[eventName](deferred, simplifyModel(model));

                // When the defer has been resolved.
                deferred.promise.then(_.bind(function(properties) {
                    invokeCallback('Resolve', properties);
                    contentUpdated();
                }, this));

                // When the defer has been rejected.
                deferred.promise.fail(_.bind(function() {
                    invokeCallback('Reject');
                    contentUpdated();
                }, this));

            }

            // Voila!
            contentUpdated();

            return model;

        }

    };

    /**
     * @method deleteCollection
     * @param name {String}
     * @return {void}
     */
    $catwalk.deleteCollection = function deleteCollection(name) {
        delete _collections[name];
    };

    /**
     * @method collection
     * @param name {String}
     * @param properties {Object}
     * @return {Object}
     */
    $catwalk.collection = function collection(name, properties) {

        if (properties) {

            if (typeof _collections[name] !== 'undefined') {
                throw 'You are attempting to overwrite an existing "' + name + '" collection.';
            }

            // Instantiate a new collection because we've passed properties.
            _collections[name] = new CatWalkCollection(name, properties);
            return _collections[name];

        }

        if (typeof _collections[name] === 'undefined') {
            throw 'Catwalk is unable to find a collection named "' + name + '".'
        }

        // Otherwise we'll attempt to find an existing collection by its name.
        return _collections[name];

    };

})(window.catwalk, window.Q, window.crossfilter);;(function($window, $catwalk, $q) {

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

        return function hasOne(foreignId) {

            var collection  = $catwalk.collection(descriptor.collection),
                dimension   = collection._dimensions[descriptor.foreignKey];

            if (typeof dimension === 'undefined') {
                throw 'Attempting to map to an invalid "' + descriptor.foreignKey + '" property on the "' + descriptor.collection + '" collection.';
            }

            var model = dimension.filterFunction(function(d) {
                    return foreignId === d;
                }).top(Infinity)[0];

            // Reset the dimension we just filtered on.
            dimension.filterAll();

            // If we cannot find the model then we need to present the question of where is it
            // to the developer, so that they can resolve it.
            if (!model) {

                if (_.indexOf(collection._resolvedIds, foreignId) === -1) {

                    // Don't resolve the ID again if we've already attempted it.
                    // You only get one chance to load it!

                    var deferred = $q.defer();

                    // Present the developer with the foreign ID to load, and the promise to resolve
                    // or reject.
                    collection._events.read(deferred, descriptor.foreignKey, foreignId);
                    collection._resolvedIds.push(foreignId);

                    // Once the promise has been resolved.
                    deferred.promise.then(function(model) {
                        collection.createModel(model);
                    });

                }

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

        return function hasMany(foreignIds) {

            var collection  = $catwalk.collection(descriptor.collection),
                dimension   = collection._dimensions[descriptor.foreignKey];

            if (typeof dimension === 'undefined') {
                throw 'Attempting to map to an invalid "' + descriptor.foreignKey + '" property on the "' + descriptor.collection + '" collection.';
            }

            var models = dimension.filterAll().filterFunction(function(d) {
                    return !!_.contains(foreignIds, d);
                }).top(Infinity);

            // Reset the dimension we just filtered on.
            dimension.filterAll();

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
                    collection._events.read(deferred, descriptor.foreignKey, id);
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