(function($window, $catwalk) {

    var hasMany = function hasMany(descriptor) {

        return function(name, foreignIds) {

            var collection  = $catwalk.collection(name),
                dimension   = collection._dimensions[descriptor.foreignKey],
                models      = dimension.filterAll().filterFunction(function(d) {
                    return !!_.contains(foreignIds, d);
                });

            return models.top(Infinity);

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