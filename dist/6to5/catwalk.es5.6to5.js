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

var _inherits = function (child, parent) {
  if (typeof parent !== "function" && parent !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof parent);
  }
  child.prototype = Object.create(parent && parent.prototype, {
    constructor: {
      value: child,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (parent) child.__proto__ = parent;
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
  var Catwalk =

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
  };

  /**
   * @method createCollection
   * @param name {String}
   * @param [properties={}] {Object}
   * @return {Collection}
   */
  Catwalk.prototype.createCollection = function (name) {
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
  };

  /**
   * @method deleteCollection
   * @param name {String}
   * @return {void}
   */
  Catwalk.prototype.deleteCollection = function (name) {
    if (this.collections[name]) {
      delete this.collections[name];
    }
  };

  /**
   * @method collection
   * @param name {String}
   * @return {Collection}
   */
  Catwalk.prototype.collection = function (name) {
    if (typeof this.collections[name] === "undefined") {
      this.throwException("Unable to find collection \"" + name + "\"");
    }

    return this.collections[name];
  };

  /**
   * @method createTransaction
   * @return {Transaction}
   */
  Catwalk.prototype.createTransaction = function () {
    return new Transaction();
  };

  /**
   * @method revertCallbackTypecast
   * @param setting {Boolean}
   * @return {void}
   */
  Catwalk.prototype.revertCallbackTypecast = function (setting) {
    this.revertTypecast = !!setting;
  };

  /**
   * @method throwException
   * @throws Exception
   * @param message {String}
   * @return {void}
   */
  Catwalk.prototype.throwException = function (message) {
    throw "Catwalk: " + message + ".";
  };

  /**
   * @method on
   * @param name {String}
   * @param [eventFn=()=>{}] {Function}
   * @return {void}
   */
  Catwalk.prototype.on = function (name) {
    var _this = this;
    var eventFn = arguments[1] === undefined ? function () {} : arguments[1];


    (name || "").split(/\s+/g).forEach(function (hookName) {
      _this.events[hookName] = eventFn;
    });
  };

  /**
   * @method off
   * @param name {String}
   * @return {void}
   */
  Catwalk.prototype.off = function (name) {
    var _this2 = this;


    (name || "").split(/\s+/g).forEach(function (hookName) {
      delete _this2.events[hookName];
    });
  };

  /**
   * @class Collection
   */
  var Collection =

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
  };

  /**
   * @method silently
   * @param silentFn {Function}
   * @return {void}
   */
  Collection.prototype.silently = function (silentFn) {
    var silentBefore = this.silent;
    this.silent = true;
    silentFn.apply(this);

    if (!silentBefore) {
      // Only remove the silence if it wasn't silent before, which prevents against
      // nesting the `silently` methods inside one another.
      this.silent = false;
    }
  };

  /**
   * Converts each non-extensible model into an extensible model, which is useful for JavaScript frameworks
   * such as Angular.js which insist on injecting $$hashKey into each object. Pfft!
   *
   * Todo: Use a generator instead of a simple return statement.
   *
   * @method extensibleIteration
   * @return {Array}
   */
  Collection.prototype.extensibleIteration = function () {
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
  };

  /**
   * @method addModel
   * @param properties {Object}
   * @return {Object}
   */
  Collection.prototype.addModel = function () {
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
  };

  /**
   * @method addModels
   * @param propertiesList {Object}
   * @return {Array}
   */
  Collection.prototype.addModels = function () {
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
  };

  /**
   * @method createModel
   * @param [properties={}] {Object}
   * @return {Object}
   */
  Collection.prototype.createModel = function () {
    var properties = arguments[0] === undefined ? {} : arguments[0];


    this.injectMeta(properties);

    // Ensure the model conforms to the blueprint.
    var model = this.blueprint.iterateAll(properties);

    Object.seal(model);
    this.models.push(model);
    this.issuePromise("create", model, null);
    return model;
  };

  /**
   * @method readModel
   * @param properties {Object}
   * @return {Object}
   */
  Collection.prototype.readModel = function (properties) {
    this.issuePromise("read", properties, null);
    return properties;
  };

  /**
   * @method updateModel
   * @param model {Object}
   * @param properties {Object}
   * @return {Object}
   */
  Collection.prototype.updateModel = function (model, properties) {
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
  };

  /**
   * @method getModelById
   * @param id {Number}
   * @return {Object|null}
   */
  Collection.prototype.getModelById = function (id) {
    return this.models.find(function (model) {
      return model[CATWALK_META_PROPERTY].id === id;
    });
  };

  /**
   * @method deleteModel
   * @param model {Object}
   * @return {Object}
   */
  Collection.prototype.deleteModel = function (model) {
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
  };

  /**
   * @method addAssociation
   * @param model {Object}
   * @param property {String}
   * @param properties {Array}
   * @return {Object}
   */
  Collection.prototype.addAssociation = function (model, property, properties) {
    if (!(this.blueprint.model[property] instanceof RelationshipHasMany)) {
      catwalk.throwException("Using `addAssociation` requires a hasMany relationship");
    }

    var currentProperties = model[CATWALK_META_PROPERTY].relationshipValues[property]();
    currentProperties = currentProperties.concat(properties);
    var updateData = {};
    updateData[property] = currentProperties;
    return this.updateModel(model, updateData);
  };

  /**
   * @method removeAssociation
   * @param model {Object}
   * @param property {String}
   * @param properties {Array}
   * @return {Object}
   */
  Collection.prototype.removeAssociation = function (model, property, properties) {
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
  };

  /**
   * @method injectMeta
   * @param model {Object}
   * @return {Object}
   */
  Collection.prototype.injectMeta = function (model) {
    model[CATWALK_META_PROPERTY] = {
      id: ++this.id,
      status: CATWALK_STATES_PROPERTIES.NEW,
      originalValues: {},
      relationshipValues: {}
    };
  };

  /**
   * @method issuePromise
   * @param eventName {String}
   * @param currentModel {Object}
   * @param previousModel {Object}
   * @return {void}
   */
  Collection.prototype.issuePromise = function (eventName, currentModel, previousModel) {
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
  };

  /**
   * @method resolvePromise
   * @param eventName {String} - Event name is actually not required, because we can deduce the subsequent action
   *                             from the state of the `currentModel` and `previousModel`, but we add it to add
   *                             clarification to our logical steps.
   * @param currentModel {Object}
   * @param previousModel {Object}
   * @return {Function}
   */
  Collection.prototype.resolvePromise = function (eventName, currentModel, previousModel) {
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
  };

  /**
   * @method rejectPromise
   * @param eventName {String}
   * @param currentModel {Object}
   * @param previousModel {Object}
   * @return {Function}
   */
  Collection.prototype.rejectPromise = function (eventName, currentModel, previousModel) {
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
  };

  /**
   * @method conditionallyEmitEvent
   * @return {void}
   */
  Collection.prototype.conditionallyEmitEvent = function () {
    if (typeof catwalk.events.refresh === "function") {
      // Voila! We're all done!
      catwalk.events.refresh();
      this.awakenFramework().angular();
    }
  };

  /**
   * @method awakenFramework
   * @return {Object}
   */
  Collection.prototype.awakenFramework = function () {
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
  };

  /**
   * @method cleanModel
   * @param model {Object}
   * @return {Object}
   */
  Collection.prototype.cleanModel = function (model) {
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
  };

  /**
   * @class BlueprintModel
   */
  var BlueprintModel =

  /**
   * @constructor
   * @param name {String}
   * @param blueprint {Object}
   * @return {BlueprintModel}
   */
  function BlueprintModel(name, blueprint) {
    this.name = name;
    this.model = Object.freeze(blueprint);
  };

  /**
   * Convenience method that wraps `iterateProperties` and `iterateBlueprint` into a one-liner.
   *
   * @method iterateAll
   * @param properties {Object}
   * @return {Object}
   */
  BlueprintModel.prototype.iterateAll = function (properties) {
    var model = this.iterateProperties(properties);
    return this.iterateBlueprint(model);
  };

  /**
   * Responsible for iterating over the passed in model properties to ensure they're in the blueprint,
   * and typecasting the properties based on the define blueprint for the current collection.
   *
   * @method iterateProperties
   * @param properties {Object}
   * @return {Object}
   */
  BlueprintModel.prototype.iterateProperties = function (properties) {
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
  };

  /**
   * Responsible for iterating over the blueprint to determine if any properties are missing
   * from the current model, that have been defined in the blueprint and therefore should be
   * present.
   *
   * @method iterateBlueprint
   * @param model {Object}
   * @return {Object}
   */
  BlueprintModel.prototype.iterateBlueprint = function (model) {
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
  };

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
  BlueprintModel.prototype.reiterateProperties = function (model) {
    var _this13 = this;


    Object.keys(model).forEach(function (property) {
      var propertyHandler = _this13.model[property];

      if (typeof propertyHandler === "function") {
        model[property] = propertyHandler(model[property]);
      }
    });

    return model;
  };

  /**
   * Responsible for instantiating a new relationship per model.
   *
   * @method relationshipHandler
   * @throws Exception
   * @param propertyHandler {RelationshipAbstract}
   * @return {RelationshipAbstract}
   */
  BlueprintModel.prototype.relationshipHandler = function (propertyHandler) {
    var instantiateProperties = [propertyHandler.target.key, propertyHandler.target.collection];

    if (propertyHandler instanceof RelationshipHasMany) {
      return _applyConstructor(RelationshipHasMany, _toArray(instantiateProperties));
    }

    if (propertyHandler instanceof RelationshipHasOne) {
      return _applyConstructor(RelationshipHasOne, _toArray(instantiateProperties));
    }

    // Should be unreachable...
    catwalk.throwException("Invalid relationship type");
  };

  /**
   * @class Typecast
   */
  var Typecast = function Typecast() {};

  /**
   * @method returnValue
   * @param typecastConstructor {Function}
   * @param value {*}
   * @param defaultValue {*}
   * @return {*}
   */
  Typecast.prototype.returnValue = function (typecastConstructor, value, defaultValue) {
    return typecastConstructor(typeof value !== "undefined" ? value : defaultValue);
  };

  /**
   * @method string
   * @param defaultValue {String}
   * @return {Function}
   */
  Typecast.prototype.string = function () {
    var _this14 = this;
    var defaultValue = arguments[0] === undefined ? "" : arguments[0];


    return function (value) {
      return _this14.returnValue(String, value, defaultValue);
    };
  };

  /**
   * @method boolean
   * @param defaultValue {Boolean}
   * @return {Function}
   */
  Typecast.prototype.boolean = function () {
    var _this15 = this;
    var defaultValue = arguments[0] === undefined ? true : arguments[0];


    return function (value) {
      return _this15.returnValue(Boolean, value, defaultValue);
    };
  };

  /**
   * @method number
   * @param defaultValue {Number}
   * @return {Function}
   */
  Typecast.prototype.number = function () {
    var _this16 = this;
    var defaultValue = arguments[0] === undefined ? 0 : arguments[0];


    return function (value) {
      return _this16.returnValue(Number, value, defaultValue);
    };
  };

  /**
   * @method array
   * @param defaultValue {Array}
   * @return {Function}
   */
  Typecast.prototype.array = function () {
    var _this17 = this;
    var defaultValue = arguments[0] === undefined ? [] : arguments[0];


    return function (value) {
      return _this17.returnValue(Array, value, defaultValue);
    };
  };

  /**
   * method autoIncrement
   * @param initialValue {Number}
   * @return {Function}
   */
  Typecast.prototype.autoIncrement = function () {
    var initialValue = arguments[0] === undefined ? 1 : arguments[0];


    return function () {
      return Number(initialValue++);
    };
  };

  /**
   * @method custom
   * @param typecastFn {Function}
   * @return {Function}
   */
  Typecast.prototype.custom = function (typecastFn) {
    return typecastFn;
  };

  /**
   * @class Relationship
   */
  var Relationship = function Relationship() {};

  /**
   * @method hasOne
   * @param foreignKey {String}
   * @param collectionName {String}
   * @return {RelationshipHasOne}
   */
  Relationship.prototype.hasOne = function (foreignKey, collectionName) {
    return new RelationshipHasOne(foreignKey, collectionName);
  };

  /**
   * @method hasMany
   * @param foreignKey {String}
   * @param collectionName {String}
   * @return {RelationshipHasMany}
   */
  Relationship.prototype.hasMany = function (foreignKey, collectionName) {
    return new RelationshipHasMany(foreignKey, collectionName);
  };

  /**
   * @class RelationshipAbstract
   */
  var RelationshipAbstract =

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
  };

  /**
   * @method setValues
   * @param values {Object}
   * @return {void}
   */
  RelationshipAbstract.prototype.setValues = function (values) {
    this.values = this.value = values;
  };

  /**
   * @method defineRelationship
   * @param collectionName {String}
   * @param localKey {String}
   * @param accessorFunctions {Function}
   * @return {Object}
   */
  RelationshipAbstract.prototype.defineRelationship = function (collectionName, localKey, accessorFunctions) {
    this.source = {
      collection: collectionName,
      key: localKey
    };

    return {
      get: accessorFunctions.get,
      set: accessorFunctions.set,
      enumerable: true
    };
  };

  /**
   * @method assertForeignPropertyExists
   * @param collection {Collection}
   * @param localKey {String}
   * @return {void}
   */
  RelationshipAbstract.prototype.assertForeignPropertyExists = function (collection, localKey) {
    if (typeof collection.blueprint.model[localKey] === "undefined") {
      catwalk.throwException("Unable to find property \"" + localKey + "\" in collection \"" + collection.name + "\"");
    }
  };

  /**
   * @class RelationshipHasMany
   */
  var RelationshipHasMany = (function () {
    var _RelationshipAbstract = RelationshipAbstract;
    var RelationshipHasMany = function RelationshipHasMany() {
      if (Object.getPrototypeOf(RelationshipHasMany) !== null) {
        Object.getPrototypeOf(RelationshipHasMany).apply(this, arguments);
      }
    };

    _inherits(RelationshipHasMany, _RelationshipAbstract);

    /**
     * @method defineRelationship
     * @param collectionName {String}
     * @param localKey {String}
     * @return {Object}
     */
    RelationshipHasMany.prototype.defineRelationship = function (collectionName, localKey) {
      return _get(Object.getPrototypeOf(RelationshipHasMany.prototype), "defineRelationship", this).call(this, collectionName, localKey, {
        get: this.getModels.bind(this),
        set: this.setModels.bind(this)
      });
    };

    /**
     * @method getModels
     * @return {Array}
     */
    RelationshipHasMany.prototype.getModels = function () {
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
    };

    /**
     * @method setModels
     * @return {void}
     */
    RelationshipHasMany.prototype.setModels = function (values) {
      this.values = values;
    };

    return RelationshipHasMany;
  })();

  /**
   * @class RelationshipHasOne
   */
  var RelationshipHasOne = (function () {
    var _RelationshipAbstract2 = RelationshipAbstract;
    var RelationshipHasOne = function RelationshipHasOne() {
      if (Object.getPrototypeOf(RelationshipHasOne) !== null) {
        Object.getPrototypeOf(RelationshipHasOne).apply(this, arguments);
      }
    };

    _inherits(RelationshipHasOne, _RelationshipAbstract2);

    /**
     * @method defineRelationship
     * @param collectionName {String}
     * @param localKey {String}
     * @return {Object}
     */
    RelationshipHasOne.prototype.defineRelationship = function (collectionName, localKey) {
      return _get(Object.getPrototypeOf(RelationshipHasOne.prototype), "defineRelationship", this).call(this, collectionName, localKey, {
        get: this.getModel.bind(this),
        set: this.setModel.bind(this)
      });
    };

    /**
     * @method getModel
     * @return {Object}
     */
    RelationshipHasOne.prototype.getModel = function () {
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
    };

    /**
     * @method setModel
     * @return {void}
     */
    RelationshipHasOne.prototype.setModel = function (value) {
      this.value = value;
    };

    return RelationshipHasOne;
  })();

  /**
   * @class Transaction
   */
  var Transaction =

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
  };

  /**
   * @method add
   * @param model {Object}
   * @param promise {Object}
   * @return {void}
   */
  Transaction.prototype.add = function (model, promise) {
    this.models.push({ model: model, promise: promise });
  };

  /**
   * @method resolve
   * @param resolveFn {Function}
   * @return {void}
   */
  Transaction.prototype.resolve = function (resolveFn) {
    this.resolveFn = resolveFn;
  };

  /**
   * @method flush
   * @return {void}
   */
  Transaction.prototype.flush = function () {
    this.resolveFn(this.models);
  };

  // Instantiate the Catwalk class.
  $window.catwalk = new Catwalk();
  $window.catwalk.META = CATWALK_META_PROPERTY;
  $window.catwalk.STATES = CATWALK_STATES_PROPERTIES;
})(window, window.document);