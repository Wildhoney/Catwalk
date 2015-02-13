"use strict";

var _applyConstructor = function (Constructor, args) {
  var instance = Object.create(Constructor.prototype);

  var result = Constructor.apply(instance, args);

  return result != null && (typeof result == "object" || typeof result == "function") ? result : instance;
};

var _toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

var _get = function get(object, property, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    return desc.value;
  } else {
    var getter = desc.get;
    if (getter === undefined) {
      return undefined;
    }
    return getter.call(receiver);
  }
};

var _inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) subClass.__proto__ = superClass;
};

var _prototypeProperties = function (child, staticProps, instanceProps) {
  if (staticProps) Object.defineProperties(child, staticProps);
  if (instanceProps) Object.defineProperties(child.prototype, instanceProps);
};

/**
 * @module Catwalk
 * @author Adam Timberlake
 * @link https://github.com/Wildhoney/Catwalk.js
 */
(function main($window, $document) {
  "use strict";

  /**
   * @constant CATWALK_META_PROPERTY
   * @type {String}
   */
  var CATWALK_META_PROPERTY = "__catwalk";

  /**
   * @constant CATWALK_STATE_PROPERTIES
   * @type {Object}
   */
  var CATWALK_STATES_PROPERTIES = { NEW: 1, DIRTY: 2, SAVED: 4, DELETED: 8 };

  /**
   * @class Catwalk
   */
  var Catwalk = (function () {
    /**
     * @constructor
     * @return {Catwalk}
     */
    function Catwalk() {
      this.events = {};
      this.collections = {};
      this.relationship = new Relationship();
      this.typecast = new Typecast();
      this.revertTypecast = true;
    }

    _prototypeProperties(Catwalk, null, {
      createCollection: {

        /**
         * @method createCollection
         * @param name {String}
         * @param [properties={}] {Object}
         * @return {Collection}
         */
        value: function createCollection(name) {
          var properties = arguments[1] === undefined ? {} : arguments[1];


          name = String(name);

          if (name.length === 0) {
            this.throwException("Collection must have an associated name");
          }

          if (Object.keys(properties).length === 0) {
            this.throwException("Collection \"" + name + "\" must define its blueprint");
          }

          var collection = new Collection(name, properties);
          this.collections[name] = collection;
          return collection;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      deleteCollection: {

        /**
         * @method deleteCollection
         * @param name {String}
         * @return {void}
         */
        value: function deleteCollection(name) {
          if (this.collections[name]) {
            delete this.collections[name];
          }
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      collection: {

        /**
         * @method collection
         * @param name {String}
         * @return {Collection}
         */
        value: function collection(name) {
          if (typeof this.collections[name] === "undefined") {
            this.throwException("Unable to find collection \"" + name + "\"");
          }

          return this.collections[name];
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      createTransaction: {

        /**
         * @method createTransaction
         * @return {Transaction}
         */
        value: function createTransaction() {
          return new Transaction();
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      revertCallbackTypecast: {

        /**
         * @method revertCallbackTypecast
         * @param setting {Boolean}
         * @return {void}
         */
        value: function revertCallbackTypecast(setting) {
          this.revertTypecast = !!setting;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      throwException: {

        /**
         * @method throwException
         * @throws Exception
         * @param message {String}
         * @return {void}
         */
        value: function throwException(message) {
          throw "Catwalk: " + message + ".";
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      on: {

        /**
         * @method on
         * @param name {String}
         * @param [eventFn=()=>{}] {Function}
         * @return {void}
         */
        value: function on(name) {
          var _this = this;
          var eventFn = arguments[1] === undefined ? function () {} : arguments[1];


          (name || "").split(/\s+/g).forEach(function (hookName) {
            _this.events[hookName] = eventFn;
          });
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      off: {

        /**
         * @method off
         * @param name {String}
         * @return {void}
         */
        value: function off(name) {
          var _this2 = this;


          (name || "").split(/\s+/g).forEach(function (hookName) {
            delete _this2.events[hookName];
          });
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return Catwalk;
  })();

  /**
   * @class Collection
   */
  var Collection = (function () {
    /**
     * @constructor
     * @param name {String}
     * @param properties {Object}
     * @return {Collection}
     */
    function Collection(name, properties) {
      this.id = 0;
      this.name = name;
      this.models = [];
      this.silent = false;
      this.blueprint = new BlueprintModel(name, properties);
    }

    _prototypeProperties(Collection, null, {
      silently: {

        /**
         * @method silently
         * @param silentFn {Function}
         * @return {void}
         */
        value: function silently(silentFn) {
          var silentBefore = this.silent;
          this.silent = true;
          silentFn.apply(this);

          if (!silentBefore) {
            // Only remove the silence if it wasn't silent before, which prevents against
            // nesting the `silently` methods inside one another.
            this.silent = false;
          }
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      extensibleIteration: {

        /**
         * Converts each non-extensible model into an extensible model, which is useful for JavaScript frameworks
         * such as Angular.js which insist on injecting $$hashKey into each object. Pfft!
         *
         * Todo: Use a generator instead of a simple return statement.
         *
         * @method extensibleIteration
         * @return {Array}
         */
        value: function extensibleIteration() {
          var extensibleModels = [];

          /**
           * @method makeExtensible
           * @param model {Object}
           * @return {Object}
           */
          var makeExtensible = function (model) {
            var extensibleModel = {};

            // Copy across the model into an extensible object.
            Object.keys(model).forEach(function (key) {
              return extensibleModel[key] = model[key];
            });

            return extensibleModel;
          };

          this.models.forEach(function (model) {
            return extensibleModels.push(makeExtensible(model));
          });

          return extensibleModels;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      addModel: {

        /**
         * @method addModel
         * @param properties {Object}
         * @return {Object}
         */
        value: function addModel() {
          var _this3 = this;
          var properties = arguments[0] === undefined ? {} : arguments[0];


          var model = {};

          this.silently(function () {
            model = _this3.createModel(properties);
          });

          if (!this.silent) {
            this.conditionallyEmitEvent();
          }

          return model;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      addModels: {

        /**
         * @method addModels
         * @param propertiesList {Object}
         * @return {Array}
         */
        value: function addModels() {
          var propertiesList = arguments[0] === undefined ? [] : arguments[0];


          if (!Array.isArray(propertiesList)) {
            catwalk.throwException("Argument for `addModels` must be an array of properties");
          }

          var models = [];

          this.silently(function silently() {
            var _this4 = this;


            propertiesList.forEach(function (properties) {
              models.push(_this4.addModel(properties));
            });
          });

          this.conditionallyEmitEvent();
          return models;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      createModel: {

        /**
         * @method createModel
         * @param [properties={}] {Object}
         * @return {Object}
         */
        value: function createModel() {
          var properties = arguments[0] === undefined ? {} : arguments[0];


          this.injectMeta(properties);

          // Ensure the model conforms to the blueprint.
          var model = this.blueprint.iterateAll(properties);

          Object.seal(model);
          this.models.push(model);
          this.issuePromise("create", model, null);
          return model;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      readModel: {

        /**
         * @method readModel
         * @param properties {Object}
         * @return {Object}
         */
        value: function readModel(properties) {
          this.issuePromise("read", properties, null);
          return properties;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      updateModel: {

        /**
         * @method updateModel
         * @param model {Object}
         * @param properties {Object}
         * @return {Object}
         */
        value: function updateModel(model, properties) {
          var _this5 = this;


          // Create a copy of the old model for rolling back.
          var previousModel = {};
          Object.keys(model).forEach(function (property) {
            return previousModel[property] = model[property];
          });

          try {
            // Copy across the data from the properties. We wrap the assignment in a try-catch block
            // because if the user has added any additional properties that don't belong in the model,
            // an exception will be raised because the object is sealed.
            Object.keys(properties).forEach(function (property) {
              return model[property] = properties[property];
            });
          } catch (exception) {}

          // Typecast the updated model and copy across its properties to the current model, so as we
          // don't break any references.
          var typecastModel = this.blueprint.reiterateProperties(model);
          Object.keys(typecastModel).forEach(function (property) {
            if (_this5.blueprint.model[property] instanceof RelationshipAbstract) {
              return;
            }

            model[property] = typecastModel[property];
          });

          this.issuePromise("update", model, previousModel);
          return model;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      getModelById: {

        /**
         * @method getModelById
         * @param id {Number}
         * @return {Object|null}
         */
        value: function getModelById(id) {
          return this.models.find(function (model) {
            return model[CATWALK_META_PROPERTY].id === id;
          });
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      deleteModel: {

        /**
         * @method deleteModel
         * @param model {Object}
         * @return {Object}
         */
        value: function deleteModel(model) {
          var _this6 = this;


          /**
           * @method remove
           * @param model {Object}
           * @param index {Number}
           * @return {Object}
           */
          var remove = function (model, index) {
            _this6.issuePromise("delete", null, model);
            _this6.models.splice(index, 1);
          };

          /**
           * Determines whether the model was successfully deleted with finding the model by reference.
           *
           * @property didDeleteViaReference
           * @type {Boolean}
           */
          var didDeleteViaReference = false;

          (function () {
            // Try to find the model by reference.
            var index = _this6.models.indexOf(model);

            if (index !== -1) {
              didDeleteViaReference = true;
              remove(_this6.models[index], index);
            }
          })();

          if (!didDeleteViaReference) {
            (function () {
              var index = 0;

              // Try to find the model by its internal Catwalk ID.
              _this6.models.forEach(function (currentModel) {
                if (currentModel[CATWALK_META_PROPERTY].id === model[CATWALK_META_PROPERTY].id) {
                  remove(currentModel, index);
                }

                index++;
              });
            })();
          }

          return model;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      addAssociation: {

        /**
         * @method addAssociation
         * @param model {Object}
         * @param property {String}
         * @param properties {Array}
         * @return {Object}
         */
        value: function addAssociation(model, property, properties) {
          if (!(this.blueprint.model[property] instanceof RelationshipHasMany)) {
            catwalk.throwException("Using `addAssociation` requires a hasMany relationship");
          }

          var currentProperties = model[CATWALK_META_PROPERTY].relationshipValues[property]();
          currentProperties = currentProperties.concat(properties);
          var updateData = {};
          updateData[property] = currentProperties;
          return this.updateModel(model, updateData);
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      removeAssociation: {

        /**
         * @method removeAssociation
         * @param model {Object}
         * @param property {String}
         * @param properties {Array}
         * @return {Object}
         */
        value: function removeAssociation(model, property, properties) {
          if (!(this.blueprint.model[property] instanceof RelationshipHasMany)) {
            catwalk.throwException("Using `removeAssociation` requires a hasMany relationship");
          }

          var currentProperties = model[CATWALK_META_PROPERTY].relationshipValues[property]();

          properties.forEach(function (property) {
            var index = currentProperties.indexOf(property);
            currentProperties.splice(index, 1);
          });

          var updateData = {};
          updateData[property] = currentProperties;
          return this.updateModel(model, updateData);
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      injectMeta: {

        /**
         * @method injectMeta
         * @param model {Object}
         * @return {Object}
         */
        value: function injectMeta(model) {
          model[CATWALK_META_PROPERTY] = {
            id: ++this.id,
            status: CATWALK_STATES_PROPERTIES.NEW,
            originalValues: {},
            relationshipValues: {}
          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      issuePromise: {

        /**
         * @method issuePromise
         * @param eventName {String}
         * @param currentModel {Object}
         * @param previousModel {Object}
         * @return {void}
         */
        value: function issuePromise(eventName, currentModel, previousModel) {
          var _this7 = this;


          if (this.silent) {
            return;
          }

          if (typeof catwalk.events[eventName] !== "function") {
            // Callback has not actually been set-up and therefore models will never be
            // persisted.
            return;
          }

          new Promise(function (resolve, reject) {
            // Issue the promise for back-end persistence of the model.
            catwalk.events[eventName].call(_this7, _this7.cleanModel(currentModel || previousModel), {
              resolve: resolve, reject: reject
            });
          }).then(function (resolutionParams) {
            // Promise has been resolved!
            _this7.resolvePromise(eventName, currentModel, previousModel)(resolutionParams);
          }, function (resolutionParams) {
            // Promise has been rejected!
            _this7.rejectPromise(eventName, currentModel, previousModel)(resolutionParams);
          });
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      resolvePromise: {

        /**
         * @method resolvePromise
         * @param eventName {String} - Event name is actually not required, because we can deduce the subsequent action
         *                             from the state of the `currentModel` and `previousModel`, but we add it to add
         *                             clarification to our logical steps.
         * @param currentModel {Object}
         * @param previousModel {Object}
         * @return {Function}
         */
        value: function resolvePromise(eventName, currentModel, previousModel) {
          var _this8 = this;


          if (currentModel && eventName === "create") {
            // Model has been successfully persisted!
            currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.SAVED;
          }

          // When we're in the process of deleting a model, the `currentModel` is unset; instead the
          // `previousModel` will be defined.
          if (currentModel === null && previousModel && eventName === "delete") {
            // Model has been successfully deleted!
            previousModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;
          }

          return function (properties) {
            _this8.silently(function () {
              if (properties && eventName !== "read") {
                _this8.updateModel(currentModel, properties);
              }

              if (properties && !properties.hasOwnProperty(CATWALK_META_PROPERTY) && eventName === "read") {
                var model = _this8.createModel(properties);

                // Update the model to reflect the changes on the object that `readModel` return.
                _this8.updateModel(currentModel, model);
              }
            });

            _this8.conditionallyEmitEvent();
          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      rejectPromise: {

        /**
         * @method rejectPromise
         * @param eventName {String}
         * @param currentModel {Object}
         * @param previousModel {Object}
         * @return {Function}
         */
        value: function rejectPromise(eventName, currentModel, previousModel) {
          var _this9 = this;


          /**
           * @method rejectWith
           * @param duplicateModel {Object}
           * @return {void}
           */
          var rejectWith = function (duplicateModel) {
            if (duplicateModel) {
              _this9.silently(function () {
                if (eventName === "update" && duplicateModel.hasOwnProperty(CATWALK_META_PROPERTY)) {
                  // User passed in a model and therefore the previous should be deleted, but only
                  // when we're updating!
                  _this9.deleteModel(previousModel);
                  previousModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;
                }

                // Use the duplicate model as the reference.
                _this9.updateModel(currentModel, duplicateModel);
                currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.SAVED;
              });
            }

            _this9.conditionallyEmitEvent();
          };

          if (previousModel === null && eventName === "create") {
            this.silently(function () {
              // Previous model was actually NULL and therefore we'll delete it.
              _this9.deleteModel(currentModel);
              currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;
            });

            return rejectWith;
          }

          if (currentModel === null && eventName === "delete") {
            this.silently(function () {
              // Developer doesn't actually want to delete the model, and therefore we need to revert it to
              // the model it was, and set its flag back to what it was.
              var model = _this9.updateModel({}, previousModel);
              _this9.models.push(model);
            });
          }

          if (currentModel && previousModel && eventName === "update") {
            this.silently(function () {
              // Both of the current and previous models are updated, and therefore we'll simply
              // revert the current model to the previous model.
              _this9.updateModel(currentModel, previousModel);
            });
          }

          return rejectWith;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      conditionallyEmitEvent: {

        /**
         * @method conditionallyEmitEvent
         * @return {void}
         */
        value: function conditionallyEmitEvent() {
          if (typeof catwalk.events.refresh === "function") {
            // Voila! We're all done!
            catwalk.events.refresh();
            this.awakenFramework().angular();
          }
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      awakenFramework: {

        /**
         * Responsible for initiating the digest of any JavaScript frameworks that rely
         * on manual intervention.
         *
         * @method awakenFramework
         * @return {Object}
         */
        value: function awakenFramework() {
          return {

            /**
             * @method angular
             * @return {void}
             */
            angular: function angular() {
              if (typeof $window.angular !== "undefined") {
                // Attempt to refresh the Angular.js scope automatically.
                var appElement = $window.angular.element($document.querySelector("*[ng-app]"));

                if ("scope" in appElement) {
                  var scope = appElement.scope();

                  if (!scope.$$phase) {
                    scope.$apply();
                  }
                }
              }
            }

          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      cleanModel: {

        /**
         * @method cleanModel
         * @param model {Object}
         * @return {Object}
         */
        value: function cleanModel(model) {
          var _this10 = this;


          var cleanedModel = {};

          Object.keys(model).forEach(function (property) {
            if (property === CATWALK_META_PROPERTY) {
              // Catwalk meta data should never be persisted to the back-end.
              return;
            }

            // Determine if the property is actually a relationship, which we need to resolve to
            // its primitive value(s).
            if (_this10.blueprint.model[property] instanceof RelationshipAbstract) {
              var relationshipFunction = model[CATWALK_META_PROPERTY].relationshipValues[property];

              if (relationshipFunction) {
                cleanedModel[property] = relationshipFunction();
              }

              return;
            }

            if (typeof _this10.blueprint.model[property] === "function") {
              if (model[CATWALK_META_PROPERTY] && model[CATWALK_META_PROPERTY].originalValues[property]) {
                // We have discovered a typecasted property that needs to be reverted to its original
                // value before invoking the callback.
                cleanedModel[property] = model[CATWALK_META_PROPERTY].originalValues[property];
                return;
              }
            }

            cleanedModel[property] = model[property];
          });

          return cleanedModel;
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return Collection;
  })();

  /**
   * @class BlueprintModel
   */
  var BlueprintModel = (function () {
    /**
     * @constructor
     * @param name {String}
     * @param blueprint {Object}
     * @return {BlueprintModel}
     */
    function BlueprintModel(name, blueprint) {
      this.name = name;
      this.model = Object.freeze(blueprint);
    }

    _prototypeProperties(BlueprintModel, null, {
      iterateAll: {

        /**
         * Convenience method that wraps `iterateProperties` and `iterateBlueprint` into a one-liner.
         *
         * @method iterateAll
         * @param properties {Object}
         * @return {Object}
         */
        value: function iterateAll(properties) {
          var model = this.iterateProperties(properties);
          return this.iterateBlueprint(model);
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      iterateProperties: {

        /**
         * Responsible for iterating over the passed in model properties to ensure they're in the blueprint,
         * and typecasting the properties based on the define blueprint for the current collection.
         *
         * @method iterateProperties
         * @param properties {Object}
         * @return {Object}
         */
        value: function iterateProperties(properties) {
          var _this11 = this;


          var model = {};

          Object.keys(properties).forEach(function (property) {
            var value = properties[property],
                propertyHandler = _this11.model[property];

            if (property !== CATWALK_META_PROPERTY && typeof propertyHandler === "undefined") {
              // Property doesn't belong in the model because it's not in the blueprint.
              return;
            }

            if (propertyHandler instanceof RelationshipAbstract) {
              propertyHandler = _this11.relationshipHandler(propertyHandler);
              Object.defineProperty(model, property, propertyHandler.defineRelationship(_this11.name, property));
              propertyHandler.setValues(properties[property]);

              if (properties[CATWALK_META_PROPERTY]) {
                // Store the original value of the relationship to resolve when cleaning the model.
                properties[CATWALK_META_PROPERTY].relationshipValues[property] = function () {
                  return propertyHandler.values;
                };
              }
            }

            if (typeof propertyHandler === "function") {
              // Typecast property to the defined type.
              var originalValue = value;
              value = propertyHandler(value);

              if (catwalk.revertTypecast && originalValue !== value) {
                // Store the original value so that we can revert it for when invoking the callback
                // with the `cleanModel` method.
                properties[CATWALK_META_PROPERTY].originalValues[property] = originalValue;
              }
            }

            model[property] = value;
          });

          return model;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      iterateBlueprint: {

        /**
         * Responsible for iterating over the blueprint to determine if any properties are missing
         * from the current model, that have been defined in the blueprint and therefore should be
         * present.
         *
         * @method iterateBlueprint
         * @param model {Object}
         * @return {Object}
         */
        value: function iterateBlueprint(model) {
          var _this12 = this;


          Object.keys(this.model).forEach(function (property) {
            if (typeof model[property] === "undefined") {
              // Ensure that it is defined.
              model[property] = _this12.model[property];
              var propertyHandler = _this12.model[property];

              if (propertyHandler instanceof RelationshipAbstract) {
                propertyHandler = _this12.relationshipHandler(propertyHandler);
                Object.defineProperty(model, property, propertyHandler.defineRelationship(_this12.name, property));
                propertyHandler.setValues([]);
                return;
              }

              if (typeof _this12.model[property] === "function") {
                // Determine if the property has a property handler method which would be responsible
                // for typecasting, and determining the default value.
                model[property] = propertyHandler();
              }
            }
          });

          return model;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      reiterateProperties: {

        /**
         * Responsible for reiterating over the model to once again typecast the values; which is
         * especially useful for when the model has been updated, but relationships need to be left
         * alone. Since the model is sealed we can also guarantee that no other properties have been
         * added into the model.
         *
         * @method reiterateProperties
         * @param model {Object}
         * @return {Object}
         */
        value: function reiterateProperties(model) {
          var _this13 = this;


          Object.keys(model).forEach(function (property) {
            var propertyHandler = _this13.model[property];

            if (typeof propertyHandler === "function") {
              model[property] = propertyHandler(model[property]);
            }
          });

          return model;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      relationshipHandler: {

        /**
         * Responsible for instantiating a new relationship per model.
         *
         * @method relationshipHandler
         * @throws Exception
         * @param propertyHandler {RelationshipAbstract}
         * @return {RelationshipAbstract}
         */
        value: function relationshipHandler(propertyHandler) {
          var instantiateProperties = [propertyHandler.target.key, propertyHandler.target.collection];

          if (propertyHandler instanceof RelationshipHasMany) {
            return _applyConstructor(RelationshipHasMany, _toArray(instantiateProperties));
          }

          if (propertyHandler instanceof RelationshipHasOne) {
            return _applyConstructor(RelationshipHasOne, _toArray(instantiateProperties));
          }

          // Should be unreachable...
          catwalk.throwException("Invalid relationship type");
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return BlueprintModel;
  })();

  /**
   * @class Typecast
   */
  var Typecast = (function () {
    function Typecast() {}

    _prototypeProperties(Typecast, null, {
      returnValue: {

        /**
         * @method returnValue
         * @param typecastConstructor {Function}
         * @param value {*}
         * @param defaultValue {*}
         * @return {*}
         */
        value: function returnValue(typecastConstructor, value, defaultValue) {
          return typecastConstructor(typeof value !== "undefined" ? value : defaultValue);
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      string: {

        /**
         * @method string
         * @param defaultValue {String}
         * @return {Function}
         */
        value: function string() {
          var _this14 = this;
          var defaultValue = arguments[0] === undefined ? "" : arguments[0];


          return function (value) {
            return _this14.returnValue(String, value, defaultValue);
          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      boolean: {

        /**
         * @method boolean
         * @param defaultValue {Boolean}
         * @return {Function}
         */
        value: function boolean() {
          var _this15 = this;
          var defaultValue = arguments[0] === undefined ? true : arguments[0];


          return function (value) {
            return _this15.returnValue(Boolean, value, defaultValue);
          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      number: {

        /**
         * @method number
         * @param defaultValue {Number}
         * @return {Function}
         */
        value: function number() {
          var _this16 = this;
          var defaultValue = arguments[0] === undefined ? 0 : arguments[0];


          return function (value) {
            return _this16.returnValue(Number, value, defaultValue);
          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      array: {

        /**
         * @method array
         * @param defaultValue {Array}
         * @return {Function}
         */
        value: function array() {
          var _this17 = this;
          var defaultValue = arguments[0] === undefined ? [] : arguments[0];


          return function (value) {
            return _this17.returnValue(Array, value, defaultValue);
          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      autoIncrement: {

        /**
         * method autoIncrement
         * @param initialValue {Number}
         * @return {Function}
         */
        value: function autoIncrement() {
          var initialValue = arguments[0] === undefined ? 1 : arguments[0];


          return function () {
            return Number(initialValue++);
          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      custom: {

        /**
         * @method custom
         * @param typecastFn {Function}
         * @return {Function}
         */
        value: function custom(typecastFn) {
          return typecastFn;
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return Typecast;
  })();

  /**
   * @class Relationship
   */
  var Relationship = (function () {
    function Relationship() {}

    _prototypeProperties(Relationship, null, {
      hasOne: {

        /**
         * @method hasOne
         * @param foreignKey {String}
         * @param collectionName {String}
         * @return {RelationshipHasOne}
         */
        value: function hasOne(foreignKey, collectionName) {
          return new RelationshipHasOne(foreignKey, collectionName);
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      hasMany: {

        /**
         * @method hasMany
         * @param foreignKey {String}
         * @param collectionName {String}
         * @return {RelationshipHasMany}
         */
        value: function hasMany(foreignKey, collectionName) {
          return new RelationshipHasMany(foreignKey, collectionName);
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return Relationship;
  })();

  /**
   * @class RelationshipAbstract
   */
  var RelationshipAbstract = (function () {
    /**
     * @constructor
     * @param foreignKey {String}
     * @param collectionName {String}
     * @return {void}
     */
    function RelationshipAbstract(foreignKey, collectionName) {
      this.target = {
        collection: collectionName,
        key: foreignKey
      };
    }

    _prototypeProperties(RelationshipAbstract, null, {
      setValues: {

        /**
         * @method setValues
         * @param values {Object}
         * @return {void}
         */
        value: function setValues(values) {
          this.values = this.value = values;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      defineRelationship: {

        /**
         * @method defineRelationship
         * @param collectionName {String}
         * @param localKey {String}
         * @param accessorFunctions {Function}
         * @return {Object}
         */
        value: function defineRelationship(collectionName, localKey, accessorFunctions) {
          this.source = {
            collection: collectionName,
            key: localKey
          };

          return {
            get: accessorFunctions.get,
            set: accessorFunctions.set,
            enumerable: true
          };
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      assertForeignPropertyExists: {

        /**
         * @method assertForeignPropertyExists
         * @param collection {Collection}
         * @param localKey {String}
         * @return {void}
         */
        value: function assertForeignPropertyExists(collection, localKey) {
          if (typeof collection.blueprint.model[localKey] === "undefined") {
            catwalk.throwException("Unable to find property \"" + localKey + "\" in collection \"" + collection.name + "\"");
          }
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return RelationshipAbstract;
  })();

  /**
   * @class RelationshipHasMany
   */
  var RelationshipHasMany = (function (RelationshipAbstract) {
    function RelationshipHasMany() {
      if (Object.getPrototypeOf(RelationshipHasMany) !== null) {
        Object.getPrototypeOf(RelationshipHasMany).apply(this, arguments);
      }
    }

    _inherits(RelationshipHasMany, RelationshipAbstract);

    _prototypeProperties(RelationshipHasMany, null, {
      defineRelationship: {

        /**
         * @method defineRelationship
         * @param collectionName {String}
         * @param localKey {String}
         * @return {Object}
         */
        value: function defineRelationship(collectionName, localKey) {
          return _get(Object.getPrototypeOf(RelationshipHasMany.prototype), "defineRelationship", this).call(this, collectionName, localKey, {
            get: this.getModels.bind(this),
            set: this.setModels.bind(this)
          });
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      getModels: {

        /**
         * @method getModels
         * @return {Array}
         */
        value: function getModels() {
          var _this18 = this;


          /**
           * @method loadModels
           * @return {Array}
           */
          var loadModels = function () {
            return foreignCollection.models.filter(function (foreignModel) {
              return _this18.values.indexOf(foreignModel[_this18.target.key]) !== -1;
            });
          };

          /**
           * @method arrayDiff
           * @param firstArray {Array}
           * @param secondArray {Array}
           * @return {*}
           */
          var arrayDiff = function (firstArray, secondArray) {
            return firstArray.filter(function (index) {
              return secondArray.indexOf(index) < 0;
            });
          };

          var foreignCollection = catwalk.collection(this.target.collection),
              models = loadModels();

          // Assert that the foreign property exists in the collection.
          this.assertForeignPropertyExists(foreignCollection, this.target.key);

          // If there is a discrepancy between the counts, then we know all the models haven't been loaded.
          if (models.length !== this.values.length) {
            // Discover the keys that are currently not loaded.
            var loadedKeys = models.map(function (model) {
              return model[_this18.target.key];
            }),
                requiredKeys = arrayDiff(this.values, loadedKeys);

            requiredKeys.forEach(function (foreignKey) {
              var requiredModel = {};
              requiredModel[_this18.target.key] = foreignKey;
              foreignCollection.readModel(requiredModel);
            });

            // Attempt to read the models again immediately.
            models = loadModels();
          }

          return models;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      setModels: {

        /**
         * @method setModels
         * @return {void}
         */
        value: function setModels(values) {
          this.values = values;
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return RelationshipHasMany;
  })(RelationshipAbstract);

  /**
   * @class RelationshipHasOne
   */
  var RelationshipHasOne = (function (RelationshipAbstract) {
    function RelationshipHasOne() {
      if (Object.getPrototypeOf(RelationshipHasOne) !== null) {
        Object.getPrototypeOf(RelationshipHasOne).apply(this, arguments);
      }
    }

    _inherits(RelationshipHasOne, RelationshipAbstract);

    _prototypeProperties(RelationshipHasOne, null, {
      defineRelationship: {

        /**
         * @method defineRelationship
         * @param collectionName {String}
         * @param localKey {String}
         * @return {Object}
         */
        value: function defineRelationship(collectionName, localKey) {
          return _get(Object.getPrototypeOf(RelationshipHasOne.prototype), "defineRelationship", this).call(this, collectionName, localKey, {
            get: this.getModel.bind(this),
            set: this.setModel.bind(this)
          });
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      getModel: {

        /**
         * @method getModel
         * @return {Object}
         */
        value: function getModel() {
          var _this19 = this;


          /**
           * @method loadModel
           * @return {Object}
           */
          var loadModel = function () {
            return foreignCollection.models.find(function (foreignModel) {
              return _this19.value === foreignModel[_this19.target.key];
            });
          };

          var foreignCollection = catwalk.collection(this.target.collection),
              model = loadModel();

          // Assert that the foreign property exists in the collection.
          this.assertForeignPropertyExists(foreignCollection, this.target.key);

          if (!model) {
            // Model cannot be found and therefore we'll attempt to read the model into the collection.
            var requiredModel = {};
            requiredModel[this.target.key] = this.value;
            foreignCollection.readModel(requiredModel);

            // Attempt to read the model again immediately.
            model = loadModel();
          }

          return model;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      setModel: {

        /**
         * @method setModel
         * @return {void}
         */
        value: function setModel(value) {
          this.value = value;
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return RelationshipHasOne;
  })(RelationshipAbstract);

  /**
   * @class Transaction
   */
  var Transaction = (function () {
    /**
     * @constructor
     * @return {Transaction}
     */
    function Transaction() {
      var _this20 = this;


      this.models = [];
      this.resolveFn = function () {};

      // Flush the promises in the subsequent run-loop.
      setTimeout(function () {
        return _this20.flush;
      });
    }

    _prototypeProperties(Transaction, null, {
      add: {

        /**
         * @method add
         * @param model {Object}
         * @param promise {Object}
         * @return {void}
         */
        value: function add(model, promise) {
          this.models.push({ model: model, promise: promise });
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      resolve: {

        /**
         * @method resolve
         * @param resolveFn {Function}
         * @return {void}
         */
        value: function resolve(resolveFn) {
          this.resolveFn = resolveFn;
        },
        writable: true,
        enumerable: true,
        configurable: true
      },
      flush: {

        /**
         * @method flush
         * @return {void}
         */
        value: function flush() {
          this.resolveFn(this.models);
        },
        writable: true,
        enumerable: true,
        configurable: true
      }
    });

    return Transaction;
  })();

  // Instantiate the Catwalk class.
  $window.catwalk = new Catwalk();
  $window.catwalk.META = CATWALK_META_PROPERTY;
  $window.catwalk.STATES = CATWALK_STATES_PROPERTIES;
})(window, window.document);