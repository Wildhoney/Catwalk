(function($window) {

    "use strict";

    /**
     * @class Catwalk
     * @author Adam Timberlake
     * @link https://github.com/Wildhoney/Catwalk.js
     */
    class Catwalk {

        /**
         * @constructor
         * @return {Catwalk}
         */
        constructor() {
            this.typecast = new $window.Catwalk.Typecast();
        }

        /**
         * @method createCollection
         * @param {String} name
         * @param {Object} properties
         * @return {window.Catwalk.Collection}
         */
        createCollection(name, properties) {
            return new $window.Catwalk.Collection(name, properties);
        }

    }

    // Expose the `Catwalk` class.
    $window.Catwalk = Catwalk;

})(window);