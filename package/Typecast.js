(function($window, $Catwalk) {

    "use strict";

    /**
     * @class Catwalk
     * @author Adam Timberlake
     * @link https://github.com/Wildhoney/Catwalk.js
     */
    class CatwalkTypecast {

        /**
         * @method string
         * @return {Function}
         */
        string() {

            /**
             * @method stringTypecast
             * @param [value=''] {String|Boolean|Number}
             * @return {String}
             */
            return function stringTypecast(value = '') {
                return $window.String(value);
            }

        }

        /**
         * @method number
         * @return {Function}
         */
        number() {

            /**
             * @method numberTypecast
             * @param [value=0] {String|Boolean|Number}
             * @return {String}
             */
            return function numberTypecast(value = 0) {
                return $window.parseInt(value);
            }

        }

    }

    // Expose the `Catwalk.Collection` property.
    $Catwalk.Typecast = CatwalkTypecast;

})(window, window.Catwalk);