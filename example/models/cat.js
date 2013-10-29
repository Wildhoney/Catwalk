(function($catwalk) {

    $catwalk.model.Cat = {

        /**
         * @property _primaryKey
         * @type {String}
         * @protected
         */
        _primaryKey: 'id',

        /**
         * @property colours
         * @type {Object}
         */
        colours: $catwalk.relationship.hasMany({
            foreignKey: 'colour_id'
        }),

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