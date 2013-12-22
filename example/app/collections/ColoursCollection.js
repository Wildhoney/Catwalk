(function($catwalk) {

    $catwalk.collection('colours', {

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
         * @property colour
         * @type {String}
         */
        colour: $catwalk.attribute.string

    });

})(window.catwalk);