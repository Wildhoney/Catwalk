(function($catwalk) {

    $catwalk.collection('colours', {

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
             * @property id
             * @type {Object}
             */
            id: $catwalk.relationship.belongsTo({
                collection: 'cats',
                foreignKey: 'colours',
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
        name: $catwalk.attribute.string

    });

})(window.catwalk);