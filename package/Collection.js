(function($Catwalk, $object) {

    "use strict";

    /**
     * @constant CATWALK_PROPERTY
     * @type {String}
     */
    const CATWALK_PROPERTY = '__catwalkId';

    /**
     * @class Catwalk
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

            let model = this.cleanModel(properties);
            model[CATWALK_PROPERTY] = ++this.id;

            // Make the model immutable, and then add it to the array.
            this.models.push($object.freeze(model));
            return model;

        }

        /**
         * @method deleteModel
         * @param model {Object}
         * @return {Object}
         */
        deleteModel(model) {
            this.spliceModel(model);
            return model;
        }

        /**
         * @method spliceModel
         * @param model {Object}
         */
        spliceModel(model) {
            let index = this.models.indexOf(model);
            this.models.splice(index, 1);
        }

        /**
         * @method cleanModel
         * @param properties {Object}
         * @return {Object}
         */
        cleanModel(properties) {
            let model = this.iterateProperties(properties);
            return this.iterateBlueprint(model);
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

            updatedModel = this.cleanModel(updatedModel);
            updatedModel[CATWALK_PROPERTY] = model[CATWALK_PROPERTY];

            this.spliceModel(model);
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

        /**
         * Responsible for iterating over the blueprint to determine if any properties are missing
         * from the current model, that have been defined in the blueprint and therefore should be
         * present.
         *
         * @method iterateBlueprint
         * @param model {Object}
         * @return {Object}
         */
        iterateBlueprint(model) {

            $object.keys(this.blueprint).forEach(property => {

                if (typeof model[property] === 'undefined') {

                    let propertyHandler = this.blueprint[property];
                    model[property]     = propertyHandler();

                }

            });

            return model;

        }

        /**
         * Responsible for iterating over the passed in model properties to ensure they're in the blueprint,
         * and typecasting the properties based on the define blueprint for the current collection.
         *
         * @method iterateProperties
         * @param properties {Object}
         * @return {Object}
         */
        iterateProperties(properties) {

            var model = {};

            $object.keys(properties).forEach(property => {

                var value           = properties[property],
                    propertyHandler = this.blueprint[property];

                if (typeof propertyHandler === 'undefined') {

                    // Property doesn't belong in the model because it's not in the blueprint.
                    return;

                }

                if (typeof propertyHandler === 'function') {

                    // Typecast property to the defined type.
                    value = propertyHandler(value);

                }

                model[property] = value;

            });

            return model;

        }

    }

    // Expose the `Catwalk.Collection` property.
    $Catwalk.Collection = CatwalkCollection;

})(window.Catwalk, window.Object);