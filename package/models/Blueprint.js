(function(Catwalk) {

    "use strict";

    /**
     * @class Catwalk.Model.Blueprint
     * @author Adam Timberlake
     * @link https://github.com/Wildhoney/Catwalk.js
     */
    class BlueprintModel {

        /**
         * @constructor
         * @param blueprint {Object}
         * @return {BlueprintModel}
         */
        constructor(blueprint) {
            this.model     = Object.freeze(blueprint);
            this.utility   = new Catwalk.Utility();
        }

        /**
         * @method conformModel
         * @param properties {Object}
         * @return {Object}
         */
        conformModel(properties) {
            return this.utility.fromBlueprint(this.model).ensureModelConformation(properties);
        }

    }

    // Store a reference to the blueprint model.
    Catwalk.Model.Blueprint = BlueprintModel;

})(window.Catwalk);