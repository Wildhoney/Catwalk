(function($window, $catwalk) {

    $window.people = $catwalk.collection('people', {

        /**
         * @property _primaryKey
         * @type {String}
         * @protected
         */
        _primaryKey: 'id',

        /**
         * @property _relationships
         * @type {Object}
         * @protected
         */
        _relationships: {

            /**
             * @property country
             * @type {Object}
             */
            country: $catwalk.relationship.hasOne({
                collection: 'countries',
                foreignKey: 'code'
            })

        },

        /**
         * @property id
         * @type {Number}
         */
        id: $catwalk.attribute.integer,

        /**
         * @property name
         * @type {String}
         */
        name: $catwalk.attribute.string

    });

})(window, window.catwalk);