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
             * @property colour
             * @type {Object}
             */
            colour: $catwalk.relationship.hasOne({
                collection: 'colours',
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
        name: $catwalk.attribute.string,

        /**
         * @property age
         * @type {Number}
         */
        age : $catwalk.attribute.integer

    });

})(window, window.catwalk);