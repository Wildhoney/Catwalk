(function($window) {

    "use strict";

    /**
     * @constant CATWALK_META_PROPERTY
     * @type {String}
     */
    const CATWALK_META_PROPERTY = '__catwalk';

    /**
     * @constant CATWALK_STATE_PROPERTIES
     * @type {Object}
     */
    const CATWALK_STATES_PROPERTIES = { NEW: 1, DIRTY: 2, SAVED: 4, DELETED: 8 };

    /**
     * @class Catwalk
     */
    class Catwalk {

        /**
         * @constructor
         * @return {Catwalk}
         */
        constructor() {
            this.events      = {};
            this.collections = {};
        }

        /**
         * @method createCollection
         * @return {Catwalk.Collection}
         */
        createCollection(name, properties) {

            var collection = new Collection(name, properties);
            this.collections[name] = collection;
            return collection;

        }

        /**
         * @method on
         * @param name {String}
         * @param eventFn {Function}
         * @return {void}
         */
        on(name, eventFn) {
            this.events[name] = eventFn;
        }

    }

    /**
     * @class Collection
     */
    class Collection {

        /**
         * @constructor
         * @param name {String}
         * @param properties {Object}
         * @return {Collection}
         */
        constructor(name, properties) {
            this.id        = 0;
            this.name      = name;
            this.models    = [];
            this.silent    = false;
            this.blueprint = new BlueprintModel(properties);
        }

        /**
         * @method silently
         * @param silentFn {Function}
         * @return {void}
         */
        silently(silentFn) {
            this.silent = true;
            silentFn.apply(this);
            this.silent = false;
        }

        /**
         * @method createModel
         * @param properties {Object}
         * @return {Object}
         */
        createModel(properties) {

            // Ensure the model conforms to the blueprint.
            var model = this.blueprint.iterateAll(properties);

            this.injectMeta(model);
            Object.seal(model);
            this.models.push(model);
            this.issuePromise('create', model, null);
            return model;

        }

        /**
         * @method updateModel
         * @param model {Object}
         * @param properties {Object}
         * @return {Object}
         */
        updateModel(model, properties) {

            // Create a copy of the old model for rolling back.
            var previousModel = {};
            Object.keys(model).forEach(property => previousModel[property] = model[property]);

            try {

                // Copy across the data from the properties. We wrap the assignment in a try-catch block
                // because if the user has added any additional properties that don't belong in the model,
                // an exception will be raised because the object is sealed.
                Object.keys(properties).forEach(property => model[property] = properties[property]);

            }
            catch (e) {}

            this.issuePromise('update', model, previousModel);
            return model;

        }

        /**
         * @method deleteModel
         * @param model {Object}
         * @return {void}
         */
        deleteModel(model) {

            /**
             * @method remove
             * @param model {Object}
             * @param index {Number}
             * @return {Object}
             */
            var remove = (model, index) => {

                this.issuePromise('delete', null, model);
                this.models.splice(index, 1);

            };

            (() => {

                // Try to find the model by reference.
                var index = this.models.indexOf(model);

                if (index !== -1) {
                    remove(this.models[index], index);
                }

            })();

            (() => {

                var index = 0;

                // Try to find the model by its internal Catwalk ID.
                this.models.forEach((currentModel) => {

                    if (currentModel[CATWALK_META_PROPERTY].id === model[CATWALK_META_PROPERTY].id) {
                        remove(currentModel, index);
                    }

                    index++;

                });

            })();

            return model;

        }

        /**
         * @method injectMeta
         * @param model {Object}
         * @return {Object}
         */
        injectMeta(model) {

            model[CATWALK_META_PROPERTY] = {
                id: ++this.id,
                status: CATWALK_STATES_PROPERTIES.NEW
            }

        }

        /**
         * @method issuePromise
         * @param eventName {String}
         * @param currentModel {Object}
         * @param previousModel {Object}
         * @return {void}
         */
        issuePromise(eventName, currentModel, previousModel) {

            if (this.silent) {
                return;
            }

            if (typeof catwalk.events[eventName] !== 'function') {

                // Callback has not actually been set-up and therefore models will never be
                // persisted.
                return;

            }

            new Promise((resolve, reject) => {

                // Issue the promise for back-end persistence of the model.
                catwalk.events[eventName](this.name, this.cleanModel(currentModel || previousModel), {
                    resolve: resolve, reject: reject
                });

            }).then((resolutionParams) => {

                // Promise has been resolved!
                this.resolvePromise(eventName, currentModel, previousModel)(resolutionParams);

            }, (resolutionParams) => {

                // Promise has been rejected!
                this.rejectPromise(eventName, currentModel, previousModel)(resolutionParams);

            });

        }

        /**
         * @method resolvePromise
         * @param eventName {String}
         * @param currentModel {Object}
         * @param previousModel {Object}
         * @return {Function}
         */
        resolvePromise(eventName, currentModel, previousModel) {

            // Currently unused properties.
            void(previousModel);

            // When we're in the process of deleting a model, the `currentModel` is unset; instead the
            // `previousModel` will be defined.
            if (currentModel && eventName === 'create') {

                // Model has been successfully persisted!
                currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.SAVED;

            }

            if ((currentModel === null && previousModel) && eventName === 'delete') {

                // Model has been successfully deleted!
                previousModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;

            }

            return (properties) => {

                this.silently(() => {

                    if (properties) {
                        this.updateModel(currentModel, properties);
                    }

                });

                this.conditionallyEmitEvent();

            };

        }

        /**
         * @method rejectPromise
         * @param eventName {String} - Event name is actually not required, because we can deduce the subsequent action
         *                             from the state of the `currentModel` and `previousModel`, but we add it to add
         *                             clarification to our logical steps.
         * @param currentModel {Object}
         * @param previousModel {Object}
         * @return {Function}
         */
        rejectPromise(eventName, currentModel, previousModel) {

            /**
             * @method rejectWith
             * @param duplicateModel {Object}
             * @return {void}
             */
            var rejectWith = (duplicateModel) => {

                if (duplicateModel) {

                    this.silently(() => {

                        if (eventName === 'update' && duplicateModel.hasOwnProperty(CATWALK_META_PROPERTY)) {

                            // User passed in a model and therefore the previous should be deleted, but only
                            // when we're updating!
                            this.deleteModel(previousModel);
                            previousModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;

                        }

                        // Use the duplicate model as the reference.
                        this.updateModel(currentModel, duplicateModel);
                        currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.SAVED;

                    });

                }

                this.conditionallyEmitEvent();

            };

            if (previousModel === null && eventName === 'create') {

                this.silently(() => {

                    // Previous model was actually NULL and therefore we'll delete it.
                    this.deleteModel(currentModel);
                    currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;

                });

                return rejectWith;

            }

            if (currentModel === null && eventName === 'delete' ) {

                this.silently(() => {

                    // Developer doesn't actually want to delete the model, and therefore we need to revert it to
                    // the model it was, and set its flag back to what it was.
                    var model = this.updateModel({}, previousModel);
                    this.models.push(model);

                });

            }

            if ((currentModel && previousModel) && eventName === 'update') {

                this.silently(() => {

                    // Both of the current and previous models are updated, and therefore we'll simply
                    // revert the current model to the previous model.
                    this.updateModel(currentModel, previousModel);

                });

                return rejectWith;

            }

            return rejectWith;

        }

        /**
         * @method conditionallyEmitEvent
         * @return {void}
         */
        conditionallyEmitEvent() {

            if (typeof catwalk.events.refresh === 'function') {

                // We're all done!
                catwalk.events.refresh();

            }

        }

        /**
         * @method cleanModel
         * @param model {Object}
         * @return {Object}
         */
        cleanModel(model) {

            var cleanedModel = {};

            Object.keys(model).forEach(property => {

                if (property === CATWALK_META_PROPERTY) {

                    // Catwalk meta data should never be persisted.
                    return;

                }

                cleanedModel[property] = model[property];

            });

            return cleanedModel;

        }

    }

    /**
     * @class BlueprintModel
     */
    class BlueprintModel {

        /**
         * @constructor
         * @return {BlueprintModel}
         */
        constructor(blueprint) {
            this.model = Object.freeze(blueprint);
        }

        /**
         * Convenience method that wraps `iterateProperties` and `iterateBlueprint` into a one-liner.
         *
         * @method iterateAll
         * @param properties {Object}
         * @return {Object}
         */
        iterateAll(properties) {
            var model = this.iterateProperties(properties);
            return this.iterateBlueprint(model);
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

            Object.keys(properties).forEach(property => {

                var value           = properties[property],
                    propertyHandler = this.model[property];

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
         * Responsible for iterating over the blueprint to determine if any properties are missing
         * from the current model, that have been defined in the blueprint and therefore should be
         * present.
         *
         * @method iterateBlueprint
         * @param model {Object}
         * @return {Object}
         */
        iterateBlueprint(model) {

            Object.keys(this.model).forEach(property => {

                // Determine if the property has a property handler method which would be responsible
                // for typecasting, and determining the default value.
                if (typeof model[property] === 'function') {

                    let propertyHandler = this.model[property];
                    model[property]     = propertyHandler();
                    return;

                }

                if (typeof model[property] === 'undefined') {

                    // Ensure that it is defined.
                    model[property] = null;

                }

            });

            return model;

        }

    }

    // Instantiate the Catwalk class.
    $window.catwalk = new Catwalk();

})(window);