(function($window) {

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

})(window);;(function($window) {

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
     * Property used for keeping a track of the update emitting.
     *
     * @property _emitUpdated
     * @type {Object}
     * @private
     */
    var _emitUpdated = null;

    /**
     * @property _contentUpdated
     * @type {Function}
     * @private
     */
    var _contentUpdated = function _noopContentUpdated() { return this; };

    /**
     * Invoked whenever the content has been updated.
     *
     * @method updated
     */
    $catwalk.updated = function updated(callback) {
        _contentUpdated = callback;
    };

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

        // Reset the variables because of JavaScript!
        this._crossfilter   = {};
        this._dimensions    = {};
        this._properties    = {};
        this._deletedIds    = [];
        this._resolvedIds   = [];

        // Gather the name and the properties for the models.
        this._name                  = name;
        this._properties            = properties;
        this._properties._computed  = null;

        // Initiate the Crossfilter and its related dimensions.
        var _crossfilter     = this._crossfilter = $crossfilter([]),
            _dimensions      = this._dimensions;

        // Create the dimensions for our model properties.
        var keys = _.keys(properties);

        _.forEach(keys, _.bind(function(key) {

            if (key.charAt(0) === '_' || key.charAt(0) === '$') {
                // We don't wish to include private/protected members.
                return;
            }

            // Create a dimension for each and every model property!
            _dimensions[key] = _crossfilter.dimension(function(d) {
                return d[key];
            });

            // If the function has zero arguments then we're assuming it's a
            // computed property.
            if (properties[key].length === 0) {

                if (!this._properties._computed) {

                    // Convert the `_computed` property into an object if we have
                    // at least one.
                    this._properties._computed = {};

                }

                // Store the computed property's function for later during the model's
                // creation.
                this._properties._computed[key] = properties[key];

            }

        }, this));

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
         * @property resolvedIds
         * @type {Array}
         * @private
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
         * @private
         */
        _deletedIds: [],

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
                defaultDimension    = this._dimensions.catwalkId,
                computedProperties  = this._properties._computed,
                uniqueIdentifier    = parseInt(_.uniqueId(), 10);

            // Assume a primary key if one isn't set.
            if (model[this._properties._primaryKey] === null) {
                model.id = parseInt(uniqueIdentifier);
            }

            // Remove the property meta as that will be constructed again.
            delete model._propertyMeta;

            // Apply an internal Catwalk ID to the model.
            model._catwalkId    = uniqueIdentifier;
            model._collection   = this._name;
            model._propertyMeta = _.clone(model);

            // Fill in the model with any defaults that have been configured.
            this._fillDefaults(model);

            // Iterate over the properties to typecast them.
            _.forEach(model, function(value, key) {

                if (key.charAt(0) === '_' || key.charAt(0) === '$') {
                    // We can't do much with private/protected members.
                    return;
                }

                // Ensure that the user isn't attempting to override a computed property
                // with their own simple value.
                if (computedProperties && _.contains(_.keys(computedProperties), key)) {
                    throw 'You are attempting to provide a value for the "' + key + '" computed property.';
                }

                // We don't want to pay attention to any `belongsTo` relationships.
                if (typeof relationships[key] === 'object') {
                    return;
                }

                // Determine if this property is part of a relationship.
                if (typeof relationships[key] === 'function') {
                    createRelationship(model, key, value);
                    return;
                }

                if (!_.contains(_.keys(propertyMap), key) && !_.contains(_.keys(relationships), key)) {
//                    throw 'You forgot to define the `' + key + '` property on the collection blueprint.';
                }

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

            });

            if (computedProperties) {

                // Computed any computed properties that are defined.
                _.forEach(computedProperties, function(computedProperty, key) {
                    model[key] = computedProperty.apply(model);
                });

            }

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

            // Determine if the resolved model is different to the current one.
            var beenReplaced = !!(properties && '_catwalkId' in properties && properties._catwalkId !== model._catwalkId);

            if (beenReplaced) {
                // Copy across the ID if we're replacing the current model, and delete the model
                // that was just created because it's not required any longer.
                this.deleteModel(model);
                model.id = properties.id;
            }

            // Attempt to resolve any `belongsTo` relationships.
            _.forEach(this._properties._relationships, function(relationship, property) {

                // If the `typeof` the relationship is "object" then we've discovered
                // a `belongsTo` relationship!
                if (typeof relationship === 'object' && model[property]) {
                    relationship.createAssociation(model, property);
                }

            });


            if (beenReplaced) {
                // We don't want to do anything else if the model has been overwritten by
                // an existing model.
                return;
            }

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

            // Copy across the relationships in their simple form.
            _.forEach(updatedModel._relationshipMeta, function(relationship, property) {
                updatedModel[property] = relationship;
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

            if (!('_catwalkId' in model)) {
                throw 'You are attempting to remove a non-Catwalk model.';
            }

            // Add the model to the deleted array.
            this._deletedIds.push(model._catwalkId);

            // Remove the model by its internal Catwalk ID.
            this._dimensions.catwalkId.filterFunction(_.bind(function(d) {
                return !(_.contains(this._deletedIds, d));
            }, this));

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
                },

                configurable: true

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

            if (_.contains(this._deletedIds, model._catwalkId)) {
                throw 'You are trying to modify a model in the garbage collection.';
            }

            if (model._collection !== this._name) {
                throw 'Model belongs to "' + model._collection + '" collection, not "' + this._name + '".';
            }

            return true;

        },

        /**
         * @method _fillDefaults
         * @param model {Object}
         * @return {void}
         * @private
         */
        _fillDefaults: function _fillDefaults(model) {

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

                if (_emitUpdated) {
                    clearTimeout(_emitUpdated);
                }

                // Content has been updated!
                _emitUpdated = setTimeout(function() {
                    _contentUpdated(_collections);
                }, 1);

            }, this);

            /**
             * @method simplifyModel
             * @param model {Object}
             * @return {Object}
             */
            var simplifyModel = _.bind(function simplifyModel(model) {

                if (typeof model === 'undefined') {
                    return {};
                }

                model = _.clone(model);

                // Map each relationship to its simple list of IDs.
                _.forEach(model._relationshipMeta, function(relationship, property) {
                    model[property] = relationship;
                });

                // Delete the unnecessary properties.
                delete model._collection;
                delete model._catwalkId;
                delete model._relationshipMeta;

                var keys = _.keys(this._properties);

                // Only restrict the properties to those defined in the collection.
                _.forEach(model, function(property, key) {

                    if (_.contains(keys, key)) {
                        return;
                    }

                    delete model[key];

                });

                delete model._propertyMeta;
                return model;

            }, this);

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
                $catwalk.event.broadcastOthers(eventName, this, deferred, simplifyModel(model));

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

})(window.catwalk, window.Q, window.crossfilter);;(function($window) {

    "use strict";

    if (typeof $window.catwalk === 'undefined') {
        return;
    }

    /**
     * @module Catwalk
     * @submodule ComputedProperty
     * @type {Object}
     */
    $window.catwalk.computedProperty = function computedProperty(callback) {
        return callback;
    }

})(window);;(function($catwalk) {

    "use strict";

    /**
     * @property _resolve
     * @type {Object}
     */
    var _resolve = function defaultResolve(collection, deferred) { deferred.resolve(); };

    $catwalk.event = {

        /**
         * @property _events
         * @type {Object}
         * @protected
         */
        _events: {
            create: _resolve,
            read:   _resolve,
            update: _resolve,
            delete: _resolve
        },

        /**
         * @method on
         * @param namespace {String}
         * @param callback {Function}
         * @return {void}
         */
        on: function on(namespace, callback) {
            this._events[namespace] = callback;
        },

        /**
         * @method broadcastRead
         * @param type {String}
         * @param collection {Object}
         * @param deferred {Object}
         * @param property {String}
         * @param value {String}
         * @return {void}
         */
        broadcastRead: function broadcastRead(type, collection, deferred, property, value) {
            var eventName = type + '/' + collection._name;
            this._getCallback(eventName, type).call($catwalk, collection._name, deferred, property, value);
        },

        /**
         * @method broadcastOthers
         * @param type {String}
         * @param collection {Object}
         * @param deferred {Object}
         * @param model {Object}
         * @return {void}
         */
        broadcastOthers: function broadcastOthers(type, collection, deferred, model) {
            var eventName = type + '/' + collection._name;
            this._getCallback(eventName, type).call($catwalk, collection._name, deferred, model);
        },

        /**
         * @method _getCallback
         * @param specificCallbackPath {String}
         * @param generalCallbackPath {String}
         * @return {Function}
         * @private
         */
        _getCallback: function _getPath(specificCallbackPath, generalCallbackPath) {

            if (_.contains(_.keys(this._events), specificCallbackPath)) {
                return this._events[specificCallbackPath];
            }

            return this._events[generalCallbackPath];

        }

    };

})(window.catwalk);;(function($window, $catwalk, $q) {

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