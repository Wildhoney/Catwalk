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
    class CatwalkCollection {

        /**
         * @method constructor
         * @param {String} name
         * @param {Object} blueprint
         * @return {CatwalkCollection}
         */
        constructor(name, blueprint) {
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

            let model = {};
            model = this.iterateProperties(properties);
            model = this.iterateBlueprint(model);
            model[CATWALK_PROPERTY] = ++this.id;

            // Make the model immutable, and then add it to the array.
            this.models.push($object.freeze(model));
            return model;

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

                    var propertyHandler = this.blueprint[property];
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

        /**
         * @method deleteModel
         * @param model {Object}
         * @return {Object}
         */
        deleteModel(model) {

            let index = this.models.indexOf(model);
            this.models.splice(index, 1);
            return model;

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