(function($catwalk) {

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
         * @method addModel
         * @param model {Object}
         * @return {void}
         */
        addModel: function addModel(model) {
            this.addModels([model]);
            return model;
        },

        /**
         * @property addModels
         * @param models {Array}
         * @return {void}
         */
        addModels: function addModels(models) {

            var _models             = [],
                propertyMap         = this._properties,
                relationships       = this._properties._relationships || {},
                createRelationship  = _.bind(this._createRelationship, this);

            models.forEach(function(model) {

                // Iterate over the properties to typecast them.
                _.forEach(model, function(value, key) {

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

            this._crossfilter.add(_models);

        },

        _createRelationship: function _createRelationship(model, key, ids) {

            var _relationships = this._properties._relationships || {};

            Object.defineProperty(model, key, {

                get: function() {
                    return _relationships[key](key, ids);
                }

            });

        },

        /**
         * @method removeModel
         * @param id {Number}
         * @return {void}
         */
        removeModel: function removeModel(id) {

        },

        /**
         * @method size
         * @return {Number}
         */
        size: function size() {
            return this._crossfilter.size();
        }

    };

    $catwalk.collection = function(name, properties) {

        if (properties) {
            // Instantiate a new collection because we've passed properties.
            return _collections[name] = new CatWalkCollection(name, properties);
        }

        // Otherwise we'll attempt to find an existing collection by its name.
        return _collections[name];

    };

})(window.catwalk);