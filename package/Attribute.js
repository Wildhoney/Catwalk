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

})(window);