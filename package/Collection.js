(function($catwalk) {

    "use strict";

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

        // Reset the variables because of JavaScript!
        this._crossfilter   = {};
        this._dimensions    = {};

        // Gather the name and the properties for the models.
        this._name          = name;
        this._properties    = properties;

        // Initiate the Crossfilter and its related dimensions.
        var _crossfilter     = this._crossfilter = crossfilter([]),
            _dimensions      = this._dimensions;

        // Create the dimensions for our model properties.
        var keys = _.keys(properties);

        _.forEach(keys, function(key) {

            if (key.charAt(0) === '_') {
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
        _events: {

            /**
             * @method create
             * @param models {Array}
             * @return {void}
             */
            create: function (models) {
                console.info('Created ' + models.length + ' model(s): ' + _.pluck(models, 'id'));
            },

            /**
             * @method read
             * @return {void}
             */
            read: function() {},

            /**
             * @event update
             */
            update: function() {},

            /**
             * @event delete
             */
            delete: function() {}

        },

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
         * @method addModel
         * @param model {Object}
         * @return {Object}
         */
        addModel: function addModel(model) {
            return this.addModels([model])[0];
        },

        /**
         * @method addModels
         * @param models {Array}
         * @return {Array}
         */
        addModels: function addModels(models) {
            return this._addModels(models, true);
        },

        /**
         * @property addModels
         * @param models {Array}
         * @param emitCreateEvent {Boolean}
         * @return {Array}
         * @private
         */
        _addModels: function _addModels(models, emitCreateEvent) {

            var _models             = [],
                propertyMap         = this._properties,
                relationships       = this._properties._relationships || {},
                createRelationship  = _.bind(this._createRelationship, this);

            // Apply an internal Catwalk ID to each model.
            _.forEach(models, function(model) {
                model._catwalkId = _.uniqueId('catwalk_');
            });

            models.forEach(function(model) {

                // Iterate over the properties to typecast them.
                _.forEach(model, function(value, key) {

                    if (key === '_catwalkId') {
                        // We can't do much with the internal Catwalk ID.
                        return;
                    }

                    // Determine if this property is part of a relationship.
                    if (typeof relationships[key] === 'function') {
                        createRelationship(model, key, value);
                        return;
                    }

                    try {

                        // Typecast the property based on what's defined in the collection.
                        model[key] = propertyMap[key](value);

                    } catch (e) {

                        // Otherwise we'll throw the exception to notify the developer that the
                        // key was missed from the collection.
                        throw 'You forgot to define the `' + key + '` property on the collection blueprint.';

                    }

                });

                _models.push(model);

            });

            // Add the models to our Crossfilter!
            this._crossfilter.add(_models);

            // Obtain the primary key to return our added models.
            var primaryKey  = this._properties._primaryKey,
                keys        = _.pluck(models, 'id');

            // Find all of the items we've just added.
            var items = this._dimensions[primaryKey].filterAll().filterFunction(function(d) {
                return !!_.contains(keys, d);
            });

            if (emitCreateEvent) {

                // Invoke the create callback.
                this._events.create(models);

            }

            // Voila!
            return items.top(Infinity);

        },

        /**
         * @property when
         * @param type {String}
         * @param callback {Function}
         * @return {void}
         */
        when: function when(type, callback) {
            this._events[type] = callback;
        },

        /**
         * @method updateModel
         * @param model {Object}
         * @param properties {Object}
         * @return {Object}
         */
        updateModel: function updateModel(model, properties) {

            if (!('_catwalkId' in model)) {
                throw 'You are attempting to remove a non-Catwalk model.';
            }

            // Delete the model from the Crossfilter.
            this._deleteModels([model], false);

            // Create the new model with the properties from the old model, overwritten with
            // the properties we're updating the model with.
            var updatedModel = _.extend(model, properties);

            // Copy across the relationships as well.
            _.forEach(this._properties._relationships, function(relationship, property) {

                // Gather the raw relational data from the relationship meta data.
                delete updatedModel[property];
                updatedModel[property] = properties[property] ? properties[property]
                                                              : model._relationshipMeta[property];

            });

            // Remove the meta data for the relationships because it will be created again with
            // the `addModels` method.
            delete updatedModel._relationshipMeta;

            // Create the new model and add it to the Crossfilter.
            this.addModels([updatedModel], false);

            // Emit the update event to notify of the updated model.
            this._events.update(updatedModel);

            // Find the item we've just updated.
            return this._dimensions.catwalkId.filterExact(updatedModel._catwalkId).top(Infinity)[0];

        },

        /**
         * @method deleteModel
         * @param model {Object}
         * @return {void}
         */
        deleteModel: function deleteModel(model) {
            this.deleteModels([model]);
        },

        /**
         * @method deleteModels
         * @param models {Array}
         * @return {void}
         */
        deleteModels: function deleteModels(models) {
            this._deleteModels(models, true);
        },

        /**
         * @method _deleteModels
         * @param models {Object}
         * @param emitDeleteEvent {Boolean}
         * @private
         */
        _deleteModels: function _deleteModels(models, emitDeleteEvent) {

            // Append the deleted IDs to the array.
            this._deletedIds = this._deletedIds.concat(_.pluck(models, '_catwalkId'));

            var _models          = [],
                defaultDimension = this._dimensions.catwalkId,
                _deletedIds      = this._deletedIds;

            _.forEach(models, function(model) {

                if (!('_catwalkId' in model)) {
                    throw 'You are attempting to remove a non-Catwalk model.';
                }

                // Remove the model by its internal Catwalk ID.
                defaultDimension.filterFunction(function(d) {
                    return !(_.contains(_deletedIds, d));
                });

                // Model has been deleted so update the array to invoke the method
                // later on.
                _models.push(model);

            });

            if (emitDeleteEvent) {

                // Invoke the delete method.
                this._events.delete(models);

            }

        },

        /**
         * @method all
         * @return {Array}
         */
        all: function all() {

            var models = this._dimensions[this._properties._primaryKey].filterAll().top(Infinity);
            this._events.read(models);
            return models;

        },

        /**
         * @method size
         * @return {Number}
         */
        size: function size() {
            return this._crossfilter.size();
        },

        /**
         * @method _createRelationship
         * @param model {Object}
         * @param key {String}
         * @param ids {Array|Number|String}
         * @private
         */
        _createRelationship: function _createRelationship(model, key, ids) {

            var _relationships = this._properties._relationships || {};

            Object.defineProperty(model, key, {

                get: function() {
                    return _relationships[key](ids);
                }

            });

            // Create the relationship meta data for the actual relational IDs.
            if (!('_relationshipMeta' in model)) {
                model._relationshipMeta = {};
            }

            model._relationshipMeta[key] = ids;

        }

    };

    $catwalk.collection = function(name, properties) {

        if (properties) {
            // Instantiate a new collection because we've passed properties.
            _collections[name] = new CatWalkCollection(name, properties);
            return _collections[name];
        }

        // Otherwise we'll attempt to find an existing collection by its name.
        return _collections[name];

    };

})(window.catwalk);