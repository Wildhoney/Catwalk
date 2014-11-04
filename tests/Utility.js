(function($window, catwalk) {

    "use strict";

    /**
     * @class CatwalkUtility
     * @author Adam Timberlake
     * @link https://github.com/Wildhoney/Catwalk.js
     */
    class CatwalkUtility {

        /**
         * @method fromCollection
         * @param collection {Array}
         * @return {Object}
         */
        fromCollection(collection) {
            
            return {

                /**
                 * @method removeModel
                 * @param model {Object}
                 * @return {Object}
                 */
                removeModel: (model) => {
                    let index = collection.indexOf(model);
                    collection.splice(index, 1);
                    return model;
                }
                
            };
        }

        fromBlueprint(blueprint) {

            return {

                /**
                 * @method ensureModelConformation
                 * @param properties {Object}
                 * @return {Object}
                 */
                ensureModelConformation(properties) {
                    let model = this.iterateProperties(properties);
                    return this.iterateBlueprint(model);
                },
                
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

                    Object.keys(properties).forEach(property => {

                        var value           = properties[property],
                            propertyHandler = blueprint[property];

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

                },

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

                    Object.keys(blueprint).forEach(property => {

                        if (typeof model[property] === 'undefined') {

                            let propertyHandler = blueprint[property];
                            model[property]     = propertyHandler();

                        }

                    });

                    return model;

                }

            }

        }

    }

    // Expose the `Catwalk.Collection` property.
    catwalk.Utility = CatwalkUtility;

})(window, window.catwalk);