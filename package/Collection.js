(function(Catwalk) {

    "use strict";

    // Define the `Catwalk.Model` namespace.
    Catwalk.Model = {};

    /**
     * @class CatwalkCollection
     * @author Adam Timberlake
     * @link https://github.com/Wildhoney/Catwalk.js
     */
    class CatwalkCollection extends Catwalk {

        /**
         * @method constructor
         * @param {String} name
         * @param {Object} blueprint
         * @return {CatwalkCollection}
         */
        constructor(name = '', blueprint = {}) {

            if (name === '') {

                // No empty values allowed for the collection name!
                this.throwException('You must specify a name for the collection');

            }

            this.id         = 0;
            this.name       = name;
            this.models     = [];
            this.blueprint  = new Catwalk.Model.Blueprint(blueprint);
            this.utility    = new Catwalk.Utility();
            this.resolution = new Catwalk.Resolution();
            
        }

        /**
         * @method on
         * @param name {String}
         * @param eventFn {Function}
         * @return {void}
         */
        on(name, eventFn) {
            this.resolution.on(name, eventFn);
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

            let model = this.blueprint.conformModel(properties);
            model[Catwalk.PRIVATE] = {
                id: ++this.id,
                status: Catwalk.STATUS.DIRTY
            };
            this.models.push(Object.freeze(model));
            this.resolution.createPromise('create', model);
            return model;

        }

        /**
         * @method deleteModel
         * @param model {Object}
         * @return {Object}
         */
        deleteModel(model) {

            this.utility.fromCollection(this.models).removeModel(model);
            this.resolution.createPromise('delete', null, model);
            return model;
            
        }

        /**
         * @method updateModel
         * @param model {Object}
         * @param properties {Object}
         * @return {Object}
         */
        updateModel(model, properties) {

            var updatedModel = {};

            Object.keys(model).forEach(property => {

                // Clone the current model since it is frozen.
                updatedModel[property] = model[property];

            });

            Object.keys(properties).forEach(property => {

                // Iterate over the properties to be updated for the model.
                updatedModel[property] = properties[property];

            });

            updatedModel = this.blueprint.conformModel(updatedModel);
            updatedModel[Catwalk.PRIVATE] = model[Catwalk.PRIVATE];

            this.utility.fromCollection(this.models).removeModel(model);
            this.resolution.createPromise('update', updatedModel, model);
            this.models.push(Object.freeze(updatedModel));
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
    Catwalk.Collection = CatwalkCollection;

})(window.Catwalk);