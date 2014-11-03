(function($window) {

    "use strict";

    /**
     * @property collections
     * @type {Array}
     */
    var collections = [];

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
            this.typecast = new Catwalk.Typecast();
        }

        /**
         * @method createCollection
         * @param {String} name
         * @param {Object} properties
         * @return {Catwalk.Collection}
         */
        createCollection(name, properties) {

            var collection    = new Catwalk.Collection(name, properties);
            collections[name] = collection;
            return collection;

        }

        /**
         * @method collection
         * @param name {String}
         * @return {Catwalk.Collection}
         */
        collection(name) {
            return collections[name];
        }

        /**
         * @method throwException
         * @throw Exception
         * @return {void}
         */
        throwException(message) {
            throw `Catwalk.js: ${message}.`;
        }

    }

    // Expose the `Catwalk` class.
    $window.Catwalk = Catwalk;

    /**
     * @constant Catwalk.PRIVATE
     * @type {String}
     */
    Catwalk.PRIVATE = '__catwalkMeta';

    /**
     * @constant Catwalk.STATUS
     * @type {Object}
     */
    Catwalk.STATUS = {
        DIRTY: 1,
        RESOLVED: 2
    };

})(window);