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
         * @method add
         * @param properties {Object}
         * @return {void}
         */
        add: function add(properties) {

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