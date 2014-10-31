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
         * @param value {String|Boolean|Number}
         * @return {String}
         */
        string(value) {

            return value => {
                return $window.String(value);
            };

        }

    }

    // Expose the `Catwalk.Collection` property.
    $Catwalk.Typecast = CatwalkTypecast;

})(window, window.Catwalk);