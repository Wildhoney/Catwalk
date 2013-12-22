(function($catwalk) {

    $catwalk.collection('countries', {

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
        id: $catwalk.attribute.integer,

        /**
         * @property name
         * @type {String}
         */
        name: $catwalk.attribute.string,

        /**
         * @property code
         * @type {String}
         */
        code: $catwalk.attribute.string

    });

})(window.catwalk);