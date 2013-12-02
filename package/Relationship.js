(function($window, $catwalk) {

    /**
     * @method hasMany
     * @param descriptor {Object}
     * @return {Function}
     */
    var hasMany = function hasMany(descriptor) {

        return function(name, foreignIds) {

            var collection  = $catwalk.collection(name),
                dimension   = collection._dimensions[descriptor.foreignKey],
                models      = dimension.filterAll().filterFunction(function(d) {
                    return !!_.contains(foreignIds, d);
                });

            var items = models.top(Infinity);

            // If there is a mismatch in this check then we're missing some of our
            // models. Perhaps we need an AJAX request to get more?
            if (foreignIds.length !== models.length) {



            }

            return items;

        };

    };

    /**
     * @module Catwalk
     * @submodule Collection
     * @type {Object}
     * @reference http://book.cakephp.org/2.0/en/models/associations-linking-models-together.html
     */
    $window.catwalk.relationship = {

        hasOne              : function() {},
        hasMany             : hasMany,
        belongsTo           : function() {},
        hasAndBelongsToMany : function() {}

    };

})(window, window.catwalk);