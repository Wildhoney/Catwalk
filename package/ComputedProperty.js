(function($window) {

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

})(window);