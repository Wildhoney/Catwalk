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
            this.events       = {};
            this.collections  = {};
            this.relationship = new Relationship();
            this.typecast     = new Typecast();
        }

        /**
         * @method createCollection
         * @return {Collection}
         */
        createCollection(name, properties) {

            var collection = new Collection(name, properties);
            this.collections[name] = collection;
            return collection;

        }

        /**
         * @method collection
         * @param name {String}
         * @return {Collection}
         */
        collection(name) {

            if (typeof this.collections[name] === 'undefined') {
                this.throwException(`Unable to find collection "${name}"`);
            }

            return this.collections[name];

        }

        /**
         * @method throwException
         * @throws Exception
         * @param message {String}
         * @return {void}
         */
        throwException(message) {
            throw `Catwalk: ${message}.`;
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

        /**
         * @method off
         * @param name {String}
         * @return {void}
         */
        off(name) {
            delete this.events[name];
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
            this.blueprint = new BlueprintModel(name, properties);
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
         * @param [properties={}] {Object}
         * @return {Object}
         */
        createModel(properties = {}) {

            // Ensure the model conforms to the blueprint.
            var model = this.blueprint.iterateAll(properties);

            this.injectMeta(model);
            Object.seal(model);
            this.models.push(model);
            this.issuePromise('create', model, null);
            return model;

        }

        /**
         * @method readModel
         * @param properties {Object}
         * @return {Object}
         */
        readModel(properties) {
            this.issuePromise('read', properties, null);
            return properties;
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
         * @return {Object}
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

            /**
             * Determines whether the model was successfully deleted with finding the model by reference.
             *
             * @property didDeleteViaReference
             * @type {Boolean}
             */
            var didDeleteViaReference = false;

            (() => {

                // Try to find the model by reference.
                var index = this.models.indexOf(model);

                if (index !== -1) {
                    didDeleteViaReference = true;
                    remove(this.models[index], index);
                }

            })();

            (() => {

                if (didDeleteViaReference) {
                    return;
                }

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
         * @param eventName {String} - Event name is actually not required, because we can deduce the subsequent action
         *                             from the state of the `currentModel` and `previousModel`, but we add it to add
         *                             clarification to our logical steps.
         * @param currentModel {Object}
         * @param previousModel {Object}
         * @return {Function}
         */
        resolvePromise(eventName, currentModel, previousModel) {

            if (currentModel && eventName === 'create') {

                // Model has been successfully persisted!
                currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.SAVED;

            }

            // When we're in the process of deleting a model, the `currentModel` is unset; instead the
            // `previousModel` will be defined.
            if ((currentModel === null && previousModel) && eventName === 'delete') {

                // Model has been successfully deleted!
                previousModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;

            }

            return (properties) => {

                this.silently(() => {

                    if (properties && eventName !== 'read') {
                        this.updateModel(currentModel, properties);
                    }

                    if (properties && !properties.hasOwnProperty(CATWALK_META_PROPERTY) && eventName === 'read') {

                        var model = this.createModel(properties);

                        // Update the model to reflect the changes on the object that `readModel` return.
                        this.updateModel(currentModel, model);

                    }

                });

                this.conditionallyEmitEvent();

            };

        }

        /**
         * @method rejectPromise
         * @param eventName {String}
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
         * @param name {String}
         * @param blueprint {Object}
         * @return {BlueprintModel}
         */
        constructor(name, blueprint) {
            this.name  = name;
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

                if (propertyHandler instanceof RelationshipAbstract) {

                    // Property is actually a relationship to another collection.
                    Object.defineProperty(model, property, propertyHandler.defineRelationship(this.name, property));
                    propertyHandler.setValues(properties[property]);

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

                if (typeof model[property] === 'undefined') {

                    // Ensure that it is defined.
                    model[property] = this.model[property];

                    if (typeof this.model[property] === 'function') {

                        // Determine if the property has a property handler method which would be responsible
                        // for typecasting, and determining the default value.
                        let propertyHandler = this.model[property];
                        model[property]     = propertyHandler();

                    }

                }

            });

            return model;

        }

    }

    /**
     * @class Typecast
     */
    class Typecast {

        /**
         * @method returnValue
         * @param typecastConstructor {Function}
         * @param value {*}
         * @param defaultValue {*}
         * @return {*}
         */
        returnValue(typecastConstructor, value, defaultValue) {
            return typecastConstructor(typeof value !== 'undefined' ? value : defaultValue);
        }

        /**
         * @method string
         * @param defaultValue {String}
         * @return {Function}
         */
        string(defaultValue = '') {

            return (value) => {
                return this.returnValue(String, value, defaultValue);
            };

        }

        /**
         * @method boolean
         * @param defaultValue {Boolean}
         * @return {Function}
         */
        boolean(defaultValue = true) {

            return (value) => {
                return this.returnValue(Boolean, value, defaultValue);
            };

        }

        /**
         * @method number
         * @param defaultValue {Number}
         * @return {Function}
         */
        number(defaultValue = 0) {

            return (value) => {
                return this.returnValue(Number, value, defaultValue);
            };

        }

    }

    /**
     * @class Relationship
     */
    class Relationship {

        /**
         * @method hasOne
         * @param foreignKey {String}
         * @param collectionName {String}
         * @return {RelationshipHasOne}
         */
        hasOne(foreignKey, collectionName) {
            return new RelationshipHasOne(foreignKey, collectionName);
        }

        /**
         * @method hasMany
         * @param foreignKey {String}
         * @param collectionName {String}
         * @return {RelationshipHasMany}
         */
        hasMany(foreignKey, collectionName) {
            return new RelationshipHasMany(foreignKey, collectionName);
        }

    }

    /**
     * @class RelationshipAbstract
     */
    class RelationshipAbstract {

        /**
         * @constructor
         * @param foreignKey {String}
         * @param collectionName {String}
         * @return {void}
         */
        constructor(foreignKey, collectionName) {

            this.target = {
                collection: collectionName,
                key: foreignKey
            };

        }

        /**
         * @method setValues
         * @param model {Object}
         * @return {void}
         */
        setValues(values) {
            this.values = this.value = values;
        }

        /**
         * @method defineRelationship
         * @param collectionName {String}
         * @param localKey {String}
         * @param accessorFunctions {Function}
         * @return {Object}
         */
        defineRelationship(collectionName, localKey, accessorFunctions) {

            this.source = {
                collection: collectionName,
                key: localKey
            };

            return {
                get: accessorFunctions.get,
                set: accessorFunctions.set
            }

        }

    }

    /**
     * @class RelationshipHasMany
     */
    class RelationshipHasMany extends RelationshipAbstract {

        /**
         * @method defineRelationship
         * @param collectionName {String}
         * @param localKey {String}
         * @return {Object}
         */
        defineRelationship(collectionName, localKey) {

            return super(collectionName, localKey, {
                get: this.getModels.bind(this),
                set: this.setModels.bind(this)
            });

        }

        /**
         * @method getModels
         * @return {Array}
         */
        getModels() {

            /**
             * @method loadModels
             * @return {Array}
             */
            var loadModels = () => {

                return foreignCollection.models.filter((foreignModel) => {
                    return this.values.indexOf(foreignModel[this.target.key]) !== -1;
                });

            };

            var arrayDiff = (firstArray, secondArray) => {
                return firstArray.filter(function(i) {return secondArray.indexOf(i) < 0;});
            };

            var foreignCollection = catwalk.collection(this.target.collection),
                models            = loadModels();

            // If there is a discrepancy between the counts, then we know all the models haven't been loaded.
            if (models.length !== this.values.length) {

                // Discover the keys that are currently not loaded.
                var loadedKeys   = models.map(model => model[this.target.key]),
                    requiredKeys = arrayDiff(this.values, loadedKeys);

                requiredKeys.forEach((foreignKey) => {

                    var requiredModel = {};
                    requiredModel[this.target.key] = foreignKey;
                    foreignCollection.readModel(requiredModel);

                });

                // Attempt to read the models again immediately.
                models = loadModels();

            }

            return models;

        }

        /**
         * @method setModels
         * @return {void}
         */
        setModels(values) {
            this.values = values;
        }

    }

    /**
     * @class RelationshipHasOne
     */
    class RelationshipHasOne extends RelationshipAbstract {

        /**
         * @method defineRelationship
         * @param collectionName {String}
         * @param localKey {String}
         * @return {Object}
         */
        defineRelationship(collectionName, localKey) {

            return super(collectionName, localKey, {
                get: this.getModel.bind(this),
                set: this.setModel.bind(this)
            });

        }

        /**
         * @method getModel
         * @return {Array}
         */
        getModel() {

            /**
             * @method loadModel
             * @return {Object}
             */
            var loadModel = () => {
                return foreignCollection.models.find((foreignModel) => {
                    return this.value === foreignModel[this.target.key];
                });  
            };

            var foreignCollection = catwalk.collection(this.target.collection),
                model             = loadModel();

            if (!model) {

                // Model cannot be found and therefore we'll attempt to read the model into the collection.
                var requiredModel   = {};
                requiredModel[this.target.key] = this.value;
                foreignCollection.readModel(requiredModel);

                // Attempt to read the model again immediately.
                model = loadModel();

            }

            return model;

        }

        /**
         * @method setModel
         * @return {void}
         */
        setModel(value) {
            this.value = value;
        }

    }

    // Instantiate the Catwalk class.
    $window.catwalk = new Catwalk();

})(window);