(function($catwalk) {

    $catwalk.collection('cats', {

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
                foreignKey: 'id',
                typecast:   $catwalk.attribute.integer
            }),

            /**
             * @property friends
             * @type {Object}
             */
            friends: $catwalk.relationship.hasMany({
                collection: 'cats',
                foreignKey: 'id',
                typecast:   $catwalk.attribute.integer
            }),

            /**
             * @property owner
             * @type {Object}
             */
            owner: $catwalk.relationship.hasOne({
                collection: 'people',
                foreignKey: 'id',
                typecast:   $catwalk.attribute.integer
            }),

            /**
             * @property born
             * @type {Object}
             */
            born: $catwalk.relationship.hasOne({
                collection: 'countries',
                foreignKey: 'id',
                typecast:   $catwalk.attribute.integer
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
        name: $catwalk.attribute.string,

        /**
         * @property age
         * @type {Number}
         */
        age : $catwalk.attribute.number,

        /**
         * @property dateBorn
         * @type {String}
         */
        dateBorn: $catwalk.attribute.date('DD/MM/YY'),

        /**
         * @property isAdult
         * @type {Boolean}
         */
        isAdult: $catwalk.computedProperty(function() {
            return (this.age > 6) ? 'an adult cat' : 'a kitten';
        })

    });

})(window.catwalk);