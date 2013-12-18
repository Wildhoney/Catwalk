(function($window, $catwalk) {

    $window.cats = $catwalk.collection('cats', {

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
             * @property colours
             * @type {Object}
             */
            colours: $catwalk.relationship.hasMany({
                collection: 'colours',
                foreignKey: 'id'
            }),

            /**
             * @property owner
             * @type {Object}
             */
            owner: $catwalk.relationship.hasOne({
                collection: 'people',
                foreignKey: 'id'
            }),

            /**
             * @property born
             * @type {Object}
             */
            born: $catwalk.relationship.hasOne({
                collection: 'countries',
                foreignKey: 'id'
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
        name: '',

        /**
         * @property age
         * @type {Number}
         */
        age : $catwalk.attribute.number,

        /**
         * @property dateBorn
         * @type {String}
         */
        dateBorn: $catwalk.attribute.date('MMMM Do, YYYY')

    });

})(window, window.catwalk);