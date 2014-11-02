(function($Catwalk, $object) {

    "use strict";

    /**
     * @constant CATWALK_PROPERTY
     * @type {String}
     */
    const CATWALK_PROPERTY = '__catwalkId';

    /**
     * @class CatwalkCollection
     * @author Adam Timberlake
     * @link https://github.com/Wildhoney/Catwalk.js
     */
    class CatwalkCollection extends $Catwalk {

        /**
         * @method constructor
         * @param {String} name
         * @param {Object} blueprint
         * @return {CatwalkCollection}
         */
        constructor(name = '', blueprint = {}) {

            if (name === '') {

                // No `undefined` values allowed!
                this.throwException('You must specify a name for the collection');

            }

            this.id         = 0;
            this.name       = name;
            this.models     = [];
            this.blueprint  = $object.freeze(blueprint);
            this.utility    = new $Catwalk.Utility();
        }

        /**
         * @method getModels
         * @return {Object}
         * @generator
         */
        *getModels() {

            for (let model of this.models) {
                yield model;
            }

        }

        /**
         * @method createModel
         * @param {Object} [properties={}]
         * @return {Object}
         */
         createModel(properties = {}) {

            let model = this.utility.fromBlueprint(this.blueprint).ensureModelConformation(properties);
            model[CATWALK_PROPERTY] = ++this.id;
            this.models.push($object.freeze(model));
            return model;

        }

        /**
         * @method deleteModel
         * @param model {Object}
         * @return {Object}
         */
        deleteModel(model) {

            this.utility.fromCollection(this.models).remove(model);
            return model;
            
        }

        /**
         * @method updateModel
         * @param model {Object}
         * @param properties {Object}
         * @return {Object}
         */
        updateModel(model, properties) {

            let updatedModel = {};

            $object.keys(model).forEach(property => {

                // Clone the current model since it is frozen.
                updatedModel[property] = model[property];

            });

            $object.keys(properties).forEach(property => {

                // Iterate over the properties to be updated for the model.
                updatedModel[property] = properties[property];

            });

            updatedModel = this.utility.fromBlueprint(this.blueprint).ensureModelConformation(updatedModel);
            updatedModel[CATWALK_PROPERTY] = model[CATWALK_PROPERTY];

            this.utility.fromCollection(this.models).remove(model);
            this.models.push($object.freeze(updatedModel));
            return updatedModel;

        }

        /**
         * @method clearModels
         * @return {void}
         */
        clearModels() {
            this.models.length = 0;
        }

    }

    // Expose the `Catwalk.Collection` property.
    $Catwalk.Collection = CatwalkCollection;

})(window.Catwalk, window.Object);