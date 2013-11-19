(function($catwalk) {


    /**
     * @module Catwalk
     * @submodule Collection
     * @type {Object}
     */
    var CatWalkCollection = function CatWalkCollection(name, properties) {
        this._name          = name;
        this._properties    = properties;
        this._crossfilter   = crossfilter([]);
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
         * @property crossfilter
         * @type {Object}
         * @private
         */
        _crossfilter: {},

        /**
         * @method addModel
         * @param model {Object}
         * @return {void}
         */
        addModel: function addModel(model) {
            this.addModels([model]);
        },

        /**
         * @property addModels
         * @param models {Array}
         * @return {void}
         */
        addModels: function addModels(models) {

            var _models     = [],
                propertyMap = this._properties;

            models.forEach(function(model) {

                // Iterate over the properties to typecast them.
                _.forEach(model, function(value, key) {

                    // Typecast the property based on what's defined in the collection.
                    model[key] = propertyMap[key](value);

                });

                _models.push(model);

            });

            this._crossfilter.add(_models);
            console.log(this._crossfilter.size());

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