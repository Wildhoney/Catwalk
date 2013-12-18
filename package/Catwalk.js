(function($window) {

    "use strict";

    if (typeof $window.Q === 'undefined') {
        throw 'Catwalk requires Q: https://github.com/kriskowal/q';
    }

    if (typeof $window._ === 'undefined') {
        throw 'Catwalk requires Underscore: http://underscorejs.org/';
    }

    if (typeof $window.crossfilter === 'undefined') {
        throw 'Catwalk requires Crossfilter: https://github.com/square/crossfilter';
    }

    /**
     * @module Catwalk
     * @type {Object}
     */
    $window.catwalk = {};

})(window);