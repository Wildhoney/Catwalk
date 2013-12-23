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
             * @property parentCat
             * @type {Object}
             */
            cat: $catwalk.relationship.belongsTo({
                collection: 'cats',
                foreignKey: 'id',
                localKey:   'colours',
                typecast:   $catwalk.attribute.integer
            })

        },

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