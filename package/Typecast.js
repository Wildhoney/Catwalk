(function($window, $Catwalk) {

    "use strict";

    /**
     * @class CatwalkTypecast
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
             * @method typecastString
             * @param [value=''] {String|Boolean|Number}
             * @return {String}
             */
            return function typecastString(value = '') {
                return $window.String(value);
            };

        }

        /**
         * @method number
         * @return {Function}
         */
        number() {

            /**
             * @method {Anonymous}
             * @param [value=0] {String|Boolean|Number}
             * @return {String}
             */
            return function typecastNumber(value = 0) {
                return $window.parseInt(value);
            };

        }

        /**
         * @method custom
         * @param typecastFn {Function}
         * @return {Function}
         */
        custom(typecastFn) {
            return typecastFn;
        }

    }

    // Expose the `Catwalk.Collection` property.
    $Catwalk.Typecast = CatwalkTypecast;

})(window, window.Catwalk);