(function($catwalk) {


    /**
     * @module Catwalk
     * @submodule Collection
     * @type {Object}
     */
    var CatWalkCollection = function CatWalkCollection(name, properties) {
        this._name          = name;
        this._properties    = properties;
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
         * @property properties
         * @type {Object}
         * @private
         */
        _properties: {},

        /**
         * @property models
         * @type {Array}
         * @private
         */
        _models: [],

        /**
         * @method add
         * @param properties {Object}
         * @return {void}
         */
        add: function add(properties) {

            var propertyMap = this._properties,
                model       = {};

            _.forEach(properties, function(value, key) {

                // Typecast the property based on what's defined in the collection.
                model[key] = propertyMap[key](value);

            });

            this._models.push(model);

        },

        /**
         * @method remove
         * @param id {Number}
         * @return {void}
         */
        remove: function remove(id) {

        }

    };

    $catwalk.collection = function(name, properties) {
        return new CatWalkCollection(name, properties);
    };

})(window.catwalk);