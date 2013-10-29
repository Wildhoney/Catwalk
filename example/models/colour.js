(function($catwalk) {

    $catwalk.model.Colour = {

        /**
         * @property _primaryKey
         * @type {String}
         * @protected
         */
        _primaryKey: 'id',

        /**
         * @property id
         * @type {Number}
         */
        id: $catwalk.attr.integer,

        /**
         * @property name
         * @type {String}
         */
        name: $catwalk.attr.string,

        /**
         * @property age
         * @type {Number}
         */
        age : $catwalk.attr.integer

    }

})(window.catwalk);