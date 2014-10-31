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
            this.blueprint  = blueprint;
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
         * @method addModel
         * @param properties {Object}
         * @return {Object}
         */
         addModel(properties) {

            let model = {};
            model[CATWALK_PROPERTY] = ++this.id;

            $object.keys(properties).forEach(property => {

                var value           = properties[property],
                    propertyHandler = this.blueprint[property];

                if (typeof propertyHandler === 'function') {

                    // Typecast property to the defined type.
                    value = propertyHandler(value);

                }

                model[property] = value;

            });

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