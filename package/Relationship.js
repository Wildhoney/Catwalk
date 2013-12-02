(function($window) {

    var hasMany = function hasMany() {
        return function() {};
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

})(window);