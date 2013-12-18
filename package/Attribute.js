(function($window) {

    "use strict";

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
    var toFloat = function toFloat(value) {
        return Number(value);
    };

    /**
     * @method toBoolean
     */
    var toBoolean = function toBoolean(value) {
        return Boolean(value);
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
        float   : toFloat,
        boolean : toBoolean

    };

})(window);