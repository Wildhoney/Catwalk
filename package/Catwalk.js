(function($window) {

    /**
     * @module Catwalk
     * @constructor
     */
    $window.catwalk = new function Catwalk() {};

    /**
     * @property model
     * @type {Object}
     */
    $window.catwalk.model = {

        /**
         * @method save
         * @return {void}
         */
        save: function save() {},

        /**
         * @method remove
         * @return {void}
         */
        remove: function remove() {}

    };

    /**
     * @property attr
     * @type {Object}
     */
    $window.catwalk.attr = {
        string  : 'string',
        integer : 'integer',
        float   : 'float',
        boolean : 'boolean'
    };

    /**
     * @property relationship
     * @type {Object}
     * @reference http://book.cakephp.org/2.0/en/models/associations-linking-models-together.html
     */
    $window.catwalk.relationship = {
        hasOne              : {},
        hasMany             : {},
        belongsTo           : {},
        hasAndBelongsToMany : {}
    }

})(window);