(function($catwalk, $q, $crossfilter) {

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

})(window.catwalk, window.Q, window.crossfilter);