"use strict";
(function main($window) {
  "use strict";
  var CATWALK_META_PROPERTY = '__catwalk';
  var CATWALK_STATES_PROPERTIES = {
    NEW: 1,
    DIRTY: 2,
    SAVED: 4,
    DELETED: 8
  };
  var Catwalk = function Catwalk() {
    this.events = {};
    this.collections = {};
    this.relationship = new Relationship();
    this.typecast = new Typecast();
    this.revertTypecast = true;
  };
  ($traceurRuntime.createClass)(Catwalk, {
    createCollection: function(name) {
      var properties = arguments[1] !== (void 0) ? arguments[1] : {};
      name = String(name);
      if (name.length === 0) {
        this.throwException('Collection must have an associated name');
      }
      if (Object.keys(properties).length === 0) {
        this.throwException(("Collection \"" + name + "\" must define its blueprint"));
      }
      var collection = new Collection(name, properties);
      this.collections[name] = collection;
      return collection;
    },
    deleteCollection: function(name) {
      if (this.collections[name]) {
        delete this.collections[name];
      }
    },
    collection: function(name) {
      if (typeof this.collections[name] === 'undefined') {
        this.throwException(("Unable to find collection \"" + name + "\""));
      }
      return this.collections[name];
    },
    createTransaction: function() {
      return new Transaction();
    },
    revertCallbackTypecast: function(setting) {
      this.revertTypecast = !!setting;
    },
    throwException: function(message) {
      throw ("Catwalk: " + message + ".");
    },
    on: function(name) {
      var eventFn = arguments[1] !== (void 0) ? arguments[1] : (function() {});
      var $__0 = this;
      (name || '').split(/\s+/g).forEach((function(hookName) {
        $__0.events[hookName] = eventFn;
      }));
    },
    off: function(name) {
      var $__0 = this;
      (name || '').split(/\s+/g).forEach((function(hookName) {
        delete $__0.events[hookName];
      }));
    }
  }, {});
  var Collection = function Collection(name, properties) {
    this.id = 0;
    this.name = name;
    this.models = [];
    this.silent = false;
    this.blueprint = new BlueprintModel(name, properties);
  };
  ($traceurRuntime.createClass)(Collection, {
    silently: function(silentFn) {
      var silentBefore = this.silent;
      this.silent = true;
      silentFn.apply(this);
      if (!silentBefore) {
        this.silent = false;
      }
    },
    extensibleIteration: function() {
      var extensibleModels = [];
      var makeExtensible = (function(model) {
        var extensibleModel = {};
        Object.keys(model).forEach((function(key) {
          return extensibleModel[key] = model[key];
        }));
        return extensibleModel;
      });
      this.models.forEach((function(model) {
        return extensibleModels.push(makeExtensible(model));
      }));
      return extensibleModels;
    },
    addModel: function() {
      var properties = arguments[0] !== (void 0) ? arguments[0] : {};
      var $__0 = this;
      var model = {};
      this.silently((function() {
        model = $__0.createModel(properties);
      }));
      if (!this.silent) {
        this.conditionallyEmitEvent();
      }
      return model;
    },
    addModels: function() {
      var propertiesList = arguments[0] !== (void 0) ? arguments[0] : [];
      if (!Array.isArray(propertiesList)) {
        catwalk.throwException('Argument for `addModels` must be an array of properties');
      }
      var models = [];
      this.silently(function silently() {
        var $__0 = this;
        propertiesList.forEach((function(properties) {
          models.push($__0.addModel(properties));
        }));
      });
      this.conditionallyEmitEvent();
      return models;
    },
    createModel: function() {
      var properties = arguments[0] !== (void 0) ? arguments[0] : {};
      this.injectMeta(properties);
      var model = this.blueprint.iterateAll(properties);
      Object.seal(model);
      this.models.push(model);
      this.issuePromise('create', model, null);
      return model;
    },
    readModel: function(properties) {
      this.issuePromise('read', properties, null);
      return properties;
    },
    updateModel: function(model, properties) {
      var $__0 = this;
      var previousModel = {};
      Object.keys(model).forEach((function(property) {
        return previousModel[property] = model[property];
      }));
      try {
        Object.keys(properties).forEach((function(property) {
          return model[property] = properties[property];
        }));
      } catch (exception) {}
      var typecastModel = this.blueprint.reiterateProperties(model);
      Object.keys(typecastModel).forEach((function(property) {
        if ($__0.blueprint.model[property] instanceof RelationshipAbstract) {
          return;
        }
        model[property] = typecastModel[property];
      }));
      this.issuePromise('update', model, previousModel);
      return model;
    },
    getModelById: function(id) {
      return this.models.find((function(model) {
        return model[CATWALK_META_PROPERTY].id === id;
      }));
    },
    deleteModel: function(model) {
      var $__0 = this;
      var remove = (function(model, index) {
        $__0.issuePromise('delete', null, model);
        $__0.models.splice(index, 1);
      });
      var didDeleteViaReference = false;
      ((function() {
        var index = $__0.models.indexOf(model);
        if (index !== -1) {
          didDeleteViaReference = true;
          remove($__0.models[index], index);
        }
      }))();
      if (!didDeleteViaReference) {
        ((function() {
          var index = 0;
          $__0.models.forEach((function(currentModel) {
            if (currentModel[CATWALK_META_PROPERTY].id === model[CATWALK_META_PROPERTY].id) {
              remove(currentModel, index);
            }
            index++;
          }));
        }))();
      }
      return model;
    },
    addAssociation: function(model, property, properties) {
      if (!(this.blueprint.model[property] instanceof RelationshipHasMany)) {
        catwalk.throwException('Using `addAssociation` requires a hasMany relationship');
      }
      var currentProperties = model[CATWALK_META_PROPERTY].relationshipValues[property]();
      currentProperties = currentProperties.concat(properties);
      var updateData = {};
      updateData[property] = currentProperties;
      return this.updateModel(model, updateData);
    },
    removeAssociation: function(model, property, properties) {
      if (!(this.blueprint.model[property] instanceof RelationshipHasMany)) {
        catwalk.throwException('Using `removeAssociation` requires a hasMany relationship');
      }
      var currentProperties = model[CATWALK_META_PROPERTY].relationshipValues[property]();
      properties.forEach((function(property) {
        var index = currentProperties.indexOf(property);
        currentProperties.splice(index, 1);
      }));
      var updateData = {};
      updateData[property] = currentProperties;
      return this.updateModel(model, updateData);
    },
    injectMeta: function(model) {
      model[CATWALK_META_PROPERTY] = {
        id: ++this.id,
        status: CATWALK_STATES_PROPERTIES.NEW,
        originalValues: {},
        relationshipValues: {}
      };
    },
    issuePromise: function(eventName, currentModel, previousModel) {
      var $__0 = this;
      if (this.silent) {
        return;
      }
      if (typeof catwalk.events[eventName] !== 'function') {
        return;
      }
      new Promise((function(resolve, reject) {
        catwalk.events[eventName].call($__0, $__0.cleanModel(currentModel || previousModel), {
          resolve: resolve,
          reject: reject
        });
      })).then((function(resolutionParams) {
        $__0.resolvePromise(eventName, currentModel, previousModel)(resolutionParams);
      }), (function(resolutionParams) {
        $__0.rejectPromise(eventName, currentModel, previousModel)(resolutionParams);
      }));
    },
    resolvePromise: function(eventName, currentModel, previousModel) {
      var $__0 = this;
      if (currentModel && eventName === 'create') {
        currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.SAVED;
      }
      if ((currentModel === null && previousModel) && eventName === 'delete') {
        previousModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;
      }
      return (function(properties) {
        $__0.silently((function() {
          if (properties && eventName !== 'read') {
            $__0.updateModel(currentModel, properties);
          }
          if (properties && !properties.hasOwnProperty(CATWALK_META_PROPERTY) && eventName === 'read') {
            var model = $__0.createModel(properties);
            $__0.updateModel(currentModel, model);
          }
        }));
        $__0.conditionallyEmitEvent();
      });
    },
    rejectPromise: function(eventName, currentModel, previousModel) {
      var $__0 = this;
      var rejectWith = (function(duplicateModel) {
        if (duplicateModel) {
          $__0.silently((function() {
            if (eventName === 'update' && duplicateModel.hasOwnProperty(CATWALK_META_PROPERTY)) {
              $__0.deleteModel(previousModel);
              previousModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;
            }
            $__0.updateModel(currentModel, duplicateModel);
            currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.SAVED;
          }));
        }
        $__0.conditionallyEmitEvent();
      });
      if (previousModel === null && eventName === 'create') {
        this.silently((function() {
          $__0.deleteModel(currentModel);
          currentModel[CATWALK_META_PROPERTY].status = CATWALK_STATES_PROPERTIES.DELETED;
        }));
        return rejectWith;
      }
      if (currentModel === null && eventName === 'delete') {
        this.silently((function() {
          var model = $__0.updateModel({}, previousModel);
          $__0.models.push(model);
        }));
      }
      if ((currentModel && previousModel) && eventName === 'update') {
        this.silently((function() {
          $__0.updateModel(currentModel, previousModel);
        }));
      }
      return rejectWith;
    },
    conditionallyEmitEvent: function() {
      if (typeof catwalk.events.refresh === 'function') {
        catwalk.events.refresh();
      }
    },
    cleanModel: function(model) {
      var $__0 = this;
      var cleanedModel = {};
      Object.keys(model).forEach((function(property) {
        if (property === CATWALK_META_PROPERTY) {
          return;
        }
        if ($__0.blueprint.model[property] instanceof RelationshipAbstract) {
          var relationshipFunction = model[CATWALK_META_PROPERTY].relationshipValues[property];
          if (relationshipFunction) {
            cleanedModel[property] = relationshipFunction();
          }
          return;
        }
        if (typeof $__0.blueprint.model[property] === 'function') {
          if (model[CATWALK_META_PROPERTY] && model[CATWALK_META_PROPERTY].originalValues[property]) {
            cleanedModel[property] = model[CATWALK_META_PROPERTY].originalValues[property];
            return;
          }
        }
        cleanedModel[property] = model[property];
      }));
      return cleanedModel;
    }
  }, {});
  var BlueprintModel = function BlueprintModel(name, blueprint) {
    this.name = name;
    this.model = Object.freeze(blueprint);
  };
  ($traceurRuntime.createClass)(BlueprintModel, {
    iterateAll: function(properties) {
      var model = this.iterateProperties(properties);
      return this.iterateBlueprint(model);
    },
    iterateProperties: function(properties) {
      var $__0 = this;
      var model = {};
      Object.keys(properties).forEach((function(property) {
        var value = properties[property],
            propertyHandler = $__0.model[property];
        if (property !== CATWALK_META_PROPERTY && typeof propertyHandler === 'undefined') {
          return;
        }
        if (propertyHandler instanceof RelationshipAbstract) {
          propertyHandler = $__0.relationshipHandler(propertyHandler);
          Object.defineProperty(model, property, propertyHandler.defineRelationship($__0.name, property));
          propertyHandler.setValues(properties[property]);
          if (properties[CATWALK_META_PROPERTY]) {
            properties[CATWALK_META_PROPERTY].relationshipValues[property] = (function() {
              return propertyHandler.values;
            });
          }
        }
        if (typeof propertyHandler === 'function') {
          var originalValue = value;
          value = propertyHandler(value);
          if (catwalk.revertTypecast && originalValue !== value) {
            properties[CATWALK_META_PROPERTY].originalValues[property] = originalValue;
          }
        }
        model[property] = value;
      }));
      return model;
    },
    iterateBlueprint: function(model) {
      var $__0 = this;
      Object.keys(this.model).forEach((function(property) {
        if (typeof model[property] === 'undefined') {
          model[property] = $__0.model[property];
          var propertyHandler = $__0.model[property];
          if (propertyHandler instanceof RelationshipAbstract) {
            propertyHandler = $__0.relationshipHandler(propertyHandler);
            Object.defineProperty(model, property, propertyHandler.defineRelationship($__0.name, property));
            propertyHandler.setValues([]);
            return;
          }
          if (typeof $__0.model[property] === 'function') {
            model[property] = propertyHandler();
          }
        }
      }));
      return model;
    },
    reiterateProperties: function(model) {
      var $__0 = this;
      Object.keys(model).forEach((function(property) {
        var propertyHandler = $__0.model[property];
        if (typeof propertyHandler === 'function') {
          model[property] = propertyHandler(model[property]);
        }
      }));
      return model;
    },
    relationshipHandler: function(propertyHandler) {
      var instantiateProperties = [propertyHandler.target.key, propertyHandler.target.collection];
      if (propertyHandler instanceof RelationshipHasMany) {
        return new (Function.prototype.bind.apply(RelationshipHasMany, $traceurRuntime.spread([null], instantiateProperties)))();
      }
      if (propertyHandler instanceof RelationshipHasOne) {
        return new (Function.prototype.bind.apply(RelationshipHasOne, $traceurRuntime.spread([null], instantiateProperties)))();
      }
      catwalk.throwException('Invalid relationship type');
    }
  }, {});
  var Typecast = function Typecast() {};
  ($traceurRuntime.createClass)(Typecast, {
    returnValue: function(typecastConstructor, value, defaultValue) {
      return typecastConstructor(typeof value !== 'undefined' ? value : defaultValue);
    },
    string: function() {
      var defaultValue = arguments[0] !== (void 0) ? arguments[0] : '';
      var $__0 = this;
      return (function(value) {
        return $__0.returnValue(String, value, defaultValue);
      });
    },
    boolean: function() {
      var defaultValue = arguments[0] !== (void 0) ? arguments[0] : true;
      var $__0 = this;
      return (function(value) {
        return $__0.returnValue(Boolean, value, defaultValue);
      });
    },
    number: function() {
      var defaultValue = arguments[0] !== (void 0) ? arguments[0] : 0;
      var $__0 = this;
      return (function(value) {
        return $__0.returnValue(Number, value, defaultValue);
      });
    },
    array: function() {
      var defaultValue = arguments[0] !== (void 0) ? arguments[0] : [];
      var $__0 = this;
      return (function(value) {
        return $__0.returnValue(Array, value, defaultValue);
      });
    },
    autoIncrement: function() {
      var initialValue = arguments[0] !== (void 0) ? arguments[0] : 1;
      return (function() {
        return Number(initialValue++);
      });
    },
    custom: function(typecastFn) {
      return typecastFn;
    }
  }, {});
  var Relationship = function Relationship() {};
  ($traceurRuntime.createClass)(Relationship, {
    hasOne: function(foreignKey, collectionName) {
      return new RelationshipHasOne(foreignKey, collectionName);
    },
    hasMany: function(foreignKey, collectionName) {
      return new RelationshipHasMany(foreignKey, collectionName);
    }
  }, {});
  var RelationshipAbstract = function RelationshipAbstract(foreignKey, collectionName) {
    this.target = {
      collection: collectionName,
      key: foreignKey
    };
  };
  ($traceurRuntime.createClass)(RelationshipAbstract, {
    setValues: function(values) {
      this.values = this.value = values;
    },
    defineRelationship: function(collectionName, localKey, accessorFunctions) {
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
    assertForeignPropertyExists: function(collection, localKey) {
      if (typeof collection.blueprint.model[localKey] === 'undefined') {
        catwalk.throwException(("Unable to find property \"" + localKey + "\" in collection \"" + collection.name + "\""));
      }
    }
  }, {});
  var RelationshipHasMany = function RelationshipHasMany() {
    $traceurRuntime.defaultSuperCall(this, $RelationshipHasMany.prototype, arguments);
  };
  var $RelationshipHasMany = RelationshipHasMany;
  ($traceurRuntime.createClass)(RelationshipHasMany, {
    defineRelationship: function(collectionName, localKey) {
      return $traceurRuntime.superCall(this, $RelationshipHasMany.prototype, "defineRelationship", [collectionName, localKey, {
        get: this.getModels.bind(this),
        set: this.setModels.bind(this)
      }]);
    },
    getModels: function() {
      var $__0 = this;
      var loadModels = (function() {
        return foreignCollection.models.filter((function(foreignModel) {
          return $__0.values.indexOf(foreignModel[$__0.target.key]) !== -1;
        }));
      });
      var arrayDiff = (function(firstArray, secondArray) {
        return firstArray.filter((function(index) {
          return secondArray.indexOf(index) < 0;
        }));
      });
      var foreignCollection = catwalk.collection(this.target.collection),
          models = loadModels();
      this.assertForeignPropertyExists(foreignCollection, this.target.key);
      if (models.length !== this.values.length) {
        var loadedKeys = models.map((function(model) {
          return model[$__0.target.key];
        })),
            requiredKeys = arrayDiff(this.values, loadedKeys);
        requiredKeys.forEach((function(foreignKey) {
          var requiredModel = {};
          requiredModel[$__0.target.key] = foreignKey;
          foreignCollection.readModel(requiredModel);
        }));
        models = loadModels();
      }
      return models;
    },
    setModels: function(values) {
      this.values = values;
    }
  }, {}, RelationshipAbstract);
  var RelationshipHasOne = function RelationshipHasOne() {
    $traceurRuntime.defaultSuperCall(this, $RelationshipHasOne.prototype, arguments);
  };
  var $RelationshipHasOne = RelationshipHasOne;
  ($traceurRuntime.createClass)(RelationshipHasOne, {
    defineRelationship: function(collectionName, localKey) {
      return $traceurRuntime.superCall(this, $RelationshipHasOne.prototype, "defineRelationship", [collectionName, localKey, {
        get: this.getModel.bind(this),
        set: this.setModel.bind(this)
      }]);
    },
    getModel: function() {
      var $__0 = this;
      var loadModel = (function() {
        return foreignCollection.models.find((function(foreignModel) {
          return $__0.value === foreignModel[$__0.target.key];
        }));
      });
      var foreignCollection = catwalk.collection(this.target.collection),
          model = loadModel();
      this.assertForeignPropertyExists(foreignCollection, this.target.key);
      if (!model) {
        var requiredModel = {};
        requiredModel[this.target.key] = this.value;
        foreignCollection.readModel(requiredModel);
        model = loadModel();
      }
      return model;
    },
    setModel: function(value) {
      this.value = value;
    }
  }, {}, RelationshipAbstract);
  var Transaction = function Transaction() {
    var $__0 = this;
    this.models = [];
    this.resolveFn = (function() {});
    setTimeout((function() {
      return $__0.flush;
    }));
  };
  ($traceurRuntime.createClass)(Transaction, {
    add: function(model, promise) {
      this.models.push({
        model: model,
        promise: promise
      });
    },
    resolve: function(resolveFn) {
      this.resolveFn = resolveFn;
    },
    flush: function() {
      this.resolveFn(this.models);
    }
  }, {});
  $window.catwalk = new Catwalk();
  $window.catwalk.META = CATWALK_META_PROPERTY;
  $window.catwalk.STATES = CATWALK_STATES_PROPERTIES;
})(window);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNhdHdhbGsuanMiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMSIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci8yIiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzciLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvNCIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci82IiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzUiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFLQTtBQUFBLEFBQUMsUUFBUyxLQUFHLENBQUUsT0FBTTtBQUVqQixhQUFXLENBQUM7SUFNTixDQUFBLHFCQUFvQixFQUFJLFlBQVU7SUFNbEMsQ0FBQSx5QkFBd0IsRUFBSTtBQUFFLE1BQUUsQ0FBRyxFQUFBO0FBQUcsUUFBSSxDQUFHLEVBQUE7QUFBRyxRQUFJLENBQUcsRUFBQTtBQUFHLFVBQU0sQ0FBRyxFQUFBO0FBQUEsRUFBRTtBQ25CL0UsQUFBSSxJQUFBLFVEd0JBLFNBQU0sUUFBTSxDQU1HLEFBQUMsQ0FBRTtBQUNWLE9BQUcsT0FBTyxFQUFZLEdBQUMsQ0FBQztBQUN4QixPQUFHLFlBQVksRUFBTyxHQUFDLENBQUM7QUFDeEIsT0FBRyxhQUFhLEVBQU0sSUFBSSxhQUFXLEFBQUMsRUFBQyxDQUFDO0FBQ3hDLE9BQUcsU0FBUyxFQUFVLElBQUksU0FBTyxBQUFDLEVBQUMsQ0FBQztBQUNwQyxPQUFHLGVBQWUsRUFBSSxLQUFHLENBQUM7RUNuQ0UsQURvQ2hDLENDcENnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUY0Q3JCLG1CQUFlLENBQWYsVUFBaUIsSUFBRyxBQUFpQixDQUFHO1FBQWpCLFdBQVMsNkNBQUksR0FBQztBQUVqQyxTQUFHLEVBQUksQ0FBQSxNQUFLLEFBQUMsQ0FBQyxJ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dXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBtb2R1bGUgQ2F0d2Fsa1xuICogQGF1dGhvciBBZGFtIFRpbWJlcmxha2VcbiAqIEBsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9XaWxkaG9uZXkvQ2F0d2Fsay5qc1xuICovXG4oZnVuY3Rpb24gbWFpbigkd2luZG93KSB7XG5cbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIC8qKlxuICAgICAqIEBjb25zdGFudCBDQVRXQUxLX01FVEFfUFJPUEVSVFlcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIGNvbnN0IENBVFdBTEtfTUVUQV9QUk9QRVJUWSA9ICdfX2NhdHdhbGsnO1xuXG4gICAgLyoqXG4gICAgICogQGNvbnN0YW50IENBVFdBTEtfU1RBVEVfUFJPUEVSVElFU1xuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgY29uc3QgQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUyA9IHsgTkVXOiAxLCBESVJUWTogMiwgU0FWRUQ6IDQsIERFTEVURUQ6IDggfTtcblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBDYXR3YWxrXG4gICAgICovXG4gICAgY2xhc3MgQ2F0d2FsayB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcmV0dXJuIHtDYXR3YWxrfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50cyAgICAgICAgID0ge307XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25zICAgID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcCAgID0gbmV3IFJlbGF0aW9uc2hpcCgpO1xuICAgICAgICAgICAgdGhpcy50eXBlY2FzdCAgICAgICA9IG5ldyBUeXBlY2FzdCgpO1xuICAgICAgICAgICAgdGhpcy5yZXZlcnRUeXBlY2FzdCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVDb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBbcHJvcGVydGllcz17fV0ge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZUNvbGxlY3Rpb24obmFtZSwgcHJvcGVydGllcyA9IHt9KSB7XG5cbiAgICAgICAgICAgIG5hbWUgPSBTdHJpbmcobmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChuYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGhyb3dFeGNlcHRpb24oJ0NvbGxlY3Rpb24gbXVzdCBoYXZlIGFuIGFzc29jaWF0ZWQgbmFtZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMocHJvcGVydGllcykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50aHJvd0V4Y2VwdGlvbihgQ29sbGVjdGlvbiBcIiR7bmFtZX1cIiBtdXN0IGRlZmluZSBpdHMgYmx1ZXByaW50YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gbmV3IENvbGxlY3Rpb24obmFtZSwgcHJvcGVydGllcyk7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25zW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWxldGVDb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBkZWxldGVDb2xsZWN0aW9uKG5hbWUpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuY29sbGVjdGlvbnNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5jb2xsZWN0aW9uc1tuYW1lXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY29sbGVjdGlvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29sbGVjdGlvbihuYW1lKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5jb2xsZWN0aW9uc1tuYW1lXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRocm93RXhjZXB0aW9uKGBVbmFibGUgdG8gZmluZCBjb2xsZWN0aW9uIFwiJHtuYW1lfVwiYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb25zW25hbWVdO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVUcmFuc2FjdGlvblxuICAgICAgICAgKiBAcmV0dXJuIHtUcmFuc2FjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZVRyYW5zYWN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUcmFuc2FjdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmV2ZXJ0Q2FsbGJhY2tUeXBlY2FzdFxuICAgICAgICAgKiBAcGFyYW0gc2V0dGluZyB7Qm9vbGVhbn1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHJldmVydENhbGxiYWNrVHlwZWNhc3Qoc2V0dGluZykge1xuICAgICAgICAgICAgdGhpcy5yZXZlcnRUeXBlY2FzdCA9ICEhc2V0dGluZztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHRocm93RXhjZXB0aW9uXG4gICAgICAgICAqIEB0aHJvd3MgRXhjZXB0aW9uXG4gICAgICAgICAqIEBwYXJhbSBtZXNzYWdlIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICB0aHJvd0V4Y2VwdGlvbihtZXNzYWdlKSB7XG4gICAgICAgICAgICB0aHJvdyBgQ2F0d2FsazogJHttZXNzYWdlfS5gO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgb25cbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIFtldmVudEZuPSgpPT57fV0ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgb24obmFtZSwgZXZlbnRGbiA9ICgpID0+IHt9KSB7XG5cbiAgICAgICAgICAgIChuYW1lIHx8ICcnKS5zcGxpdCgvXFxzKy9nKS5mb3JFYWNoKGhvb2tOYW1lID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmV2ZW50c1tob29rTmFtZV0gPSBldmVudEZuO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIG9mZlxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgb2ZmKG5hbWUpIHtcblxuICAgICAgICAgICAgKG5hbWUgfHwgJycpLnNwbGl0KC9cXHMrL2cpLmZvckVhY2goaG9va05hbWUgPT4ge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50c1tob29rTmFtZV07XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIGNsYXNzIENvbGxlY3Rpb24ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKG5hbWUsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIHRoaXMuaWQgICAgICAgID0gMDtcbiAgICAgICAgICAgIHRoaXMubmFtZSAgICAgID0gbmFtZTtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzICAgID0gW107XG4gICAgICAgICAgICB0aGlzLnNpbGVudCAgICA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5ibHVlcHJpbnQgPSBuZXcgQmx1ZXByaW50TW9kZWwobmFtZSwgcHJvcGVydGllcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzaWxlbnRseVxuICAgICAgICAgKiBAcGFyYW0gc2lsZW50Rm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2lsZW50bHkoc2lsZW50Rm4pIHtcblxuICAgICAgICAgICAgdmFyIHNpbGVudEJlZm9yZSA9IHRoaXMuc2lsZW50O1xuICAgICAgICAgICAgdGhpcy5zaWxlbnQgICAgICA9IHRydWU7XG4gICAgICAgICAgICBzaWxlbnRGbi5hcHBseSh0aGlzKTtcblxuICAgICAgICAgICAgaWYgKCFzaWxlbnRCZWZvcmUpIHtcblxuICAgICAgICAgICAgICAgIC8vIE9ubHkgcmVtb3ZlIHRoZSBzaWxlbmNlIGlmIGl0IHdhc24ndCBzaWxlbnQgYmVmb3JlLCB3aGljaCBwcmV2ZW50cyBhZ2FpbnN0XG4gICAgICAgICAgICAgICAgLy8gbmVzdGluZyB0aGUgYHNpbGVudGx5YCBtZXRob2RzIGluc2lkZSBvbmUgYW5vdGhlci5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudCA9IGZhbHNlO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb252ZXJ0cyBlYWNoIG5vbi1leHRlbnNpYmxlIG1vZGVsIGludG8gYW4gZXh0ZW5zaWJsZSBtb2RlbCwgd2hpY2ggaXMgdXNlZnVsIGZvciBKYXZhU2NyaXB0IGZyYW1ld29ya3NcbiAgICAgICAgICogc3VjaCBhcyBBbmd1bGFyLmpzIHdoaWNoIGluc2lzdCBvbiBpbmplY3RpbmcgJCRoYXNoS2V5IGludG8gZWFjaCBvYmplY3QuIFBmZnQhXG4gICAgICAgICAqXG4gICAgICAgICAqIFRvZG86IFVzZSBhIGdlbmVyYXRvciBpbnN0ZWFkIG9mIGEgc2ltcGxlIHJldHVybiBzdGF0ZW1lbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgZXh0ZW5zaWJsZUl0ZXJhdGlvblxuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGV4dGVuc2libGVJdGVyYXRpb24oKSB7XG5cbiAgICAgICAgICAgIHZhciBleHRlbnNpYmxlTW9kZWxzID0gW107XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBtYWtlRXh0ZW5zaWJsZVxuICAgICAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBtYWtlRXh0ZW5zaWJsZSA9IChtb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dGVuc2libGVNb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICAgICAgLy8gQ29weSBhY3Jvc3MgdGhlIG1vZGVsIGludG8gYW4gZXh0ZW5zaWJsZSBvYmplY3QuXG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2goa2V5ID0+IGV4dGVuc2libGVNb2RlbFtrZXldID0gbW9kZWxba2V5XSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZXh0ZW5zaWJsZU1vZGVsO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVscy5mb3JFYWNoKG1vZGVsID0+IGV4dGVuc2libGVNb2RlbHMucHVzaChtYWtlRXh0ZW5zaWJsZShtb2RlbCkpKTtcblxuICAgICAgICAgICAgcmV0dXJuIGV4dGVuc2libGVNb2RlbHM7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFkZE1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGFkZE1vZGVsKHByb3BlcnRpZXMgPSB7fSkge1xuXG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB7fTtcblxuICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgbW9kZWwgPSB0aGlzLmNyZWF0ZU1vZGVsKHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5zaWxlbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbmRpdGlvbmFsbHlFbWl0RXZlbnQoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhZGRNb2RlbHNcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXNMaXN0IHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkTW9kZWxzKHByb3BlcnRpZXNMaXN0ID0gW10pIHtcblxuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByb3BlcnRpZXNMaXN0KSkge1xuICAgICAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oJ0FyZ3VtZW50IGZvciBgYWRkTW9kZWxzYCBtdXN0IGJlIGFuIGFycmF5IG9mIHByb3BlcnRpZXMnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIG1vZGVscyA9IFtdO1xuXG4gICAgICAgICAgICB0aGlzLnNpbGVudGx5KGZ1bmN0aW9uIHNpbGVudGx5KCkge1xuXG4gICAgICAgICAgICAgICAgcHJvcGVydGllc0xpc3QuZm9yRWFjaCgocHJvcGVydGllcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbHMucHVzaCh0aGlzLmFkZE1vZGVsKHByb3BlcnRpZXMpKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVscztcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3JlYXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIFtwcm9wZXJ0aWVzPXt9XSB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGVNb2RlbChwcm9wZXJ0aWVzID0ge30pIHtcblxuICAgICAgICAgICAgdGhpcy5pbmplY3RNZXRhKHByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIG1vZGVsIGNvbmZvcm1zIHRvIHRoZSBibHVlcHJpbnQuXG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLmJsdWVwcmludC5pdGVyYXRlQWxsKHByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICBPYmplY3Quc2VhbChtb2RlbCk7XG4gICAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuaXNzdWVQcm9taXNlKCdjcmVhdGUnLCBtb2RlbCwgbnVsbCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlYWRNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZWFkTW9kZWwocHJvcGVydGllcykge1xuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ3JlYWQnLCBwcm9wZXJ0aWVzLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0aWVzO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgdXBkYXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZU1vZGVsKG1vZGVsLCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIGNvcHkgb2YgdGhlIG9sZCBtb2RlbCBmb3Igcm9sbGluZyBiYWNrLlxuICAgICAgICAgICAgdmFyIHByZXZpb3VzTW9kZWwgPSB7fTtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHByZXZpb3VzTW9kZWxbcHJvcGVydHldID0gbW9kZWxbcHJvcGVydHldKTtcblxuICAgICAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgICAgIC8vIENvcHkgYWNyb3NzIHRoZSBkYXRhIGZyb20gdGhlIHByb3BlcnRpZXMuIFdlIHdyYXAgdGhlIGFzc2lnbm1lbnQgaW4gYSB0cnktY2F0Y2ggYmxvY2tcbiAgICAgICAgICAgICAgICAvLyBiZWNhdXNlIGlmIHRoZSB1c2VyIGhhcyBhZGRlZCBhbnkgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIHRoYXQgZG9uJ3QgYmVsb25nIGluIHRoZSBtb2RlbCxcbiAgICAgICAgICAgICAgICAvLyBhbiBleGNlcHRpb24gd2lsbCBiZSByYWlzZWQgYmVjYXVzZSB0aGUgb2JqZWN0IGlzIHNlYWxlZC5cbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKHByb3BlcnR5ID0+IG1vZGVsW3Byb3BlcnR5XSA9IHByb3BlcnRpZXNbcHJvcGVydHldKTtcblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGV4Y2VwdGlvbikge31cblxuICAgICAgICAgICAgLy8gVHlwZWNhc3QgdGhlIHVwZGF0ZWQgbW9kZWwgYW5kIGNvcHkgYWNyb3NzIGl0cyBwcm9wZXJ0aWVzIHRvIHRoZSBjdXJyZW50IG1vZGVsLCBzbyBhcyB3ZVxuICAgICAgICAgICAgLy8gZG9uJ3QgYnJlYWsgYW55IHJlZmVyZW5jZXMuXG4gICAgICAgICAgICB2YXIgdHlwZWNhc3RNb2RlbCA9IHRoaXMuYmx1ZXByaW50LnJlaXRlcmF0ZVByb3BlcnRpZXMobW9kZWwpO1xuICAgICAgICAgICAgT2JqZWN0LmtleXModHlwZWNhc3RNb2RlbCkuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gdHlwZWNhc3RNb2RlbFtwcm9wZXJ0eV1cblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNzdWVQcm9taXNlKCd1cGRhdGUnLCBtb2RlbCwgcHJldmlvdXNNb2RlbCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGdldE1vZGVsQnlJZFxuICAgICAgICAgKiBAcGFyYW0gaWQge051bWJlcn1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fG51bGx9XG4gICAgICAgICAqL1xuICAgICAgICBnZXRNb2RlbEJ5SWQoaWQpIHtcblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWxzLmZpbmQoKG1vZGVsKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQgPT09IGlkO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlbGV0ZU1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWxldGVNb2RlbChtb2RlbCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgcmVtb3ZlXG4gICAgICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICAgICAqIEBwYXJhbSBpbmRleCB7TnVtYmVyfVxuICAgICAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgcmVtb3ZlID0gKG1vZGVsLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuaXNzdWVQcm9taXNlKCdkZWxldGUnLCBudWxsLCBtb2RlbCk7XG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlbHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBtb2RlbCB3YXMgc3VjY2Vzc2Z1bGx5IGRlbGV0ZWQgd2l0aCBmaW5kaW5nIHRoZSBtb2RlbCBieSByZWZlcmVuY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHByb3BlcnR5IGRpZERlbGV0ZVZpYVJlZmVyZW5jZVxuICAgICAgICAgICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBkaWREZWxldGVWaWFSZWZlcmVuY2UgPSBmYWxzZTtcblxuICAgICAgICAgICAgKCgpID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBtb2RlbCBieSByZWZlcmVuY2UuXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5tb2RlbHMuaW5kZXhPZihtb2RlbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpZERlbGV0ZVZpYVJlZmVyZW5jZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZSh0aGlzLm1vZGVsc1tpbmRleF0sIGluZGV4KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pKCk7XG5cbiAgICAgICAgICAgIGlmICghZGlkRGVsZXRlVmlhUmVmZXJlbmNlKSB7XG5cbiAgICAgICAgICAgICAgICAoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgdGhlIG1vZGVsIGJ5IGl0cyBpbnRlcm5hbCBDYXR3YWxrIElELlxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5mb3JFYWNoKChjdXJyZW50TW9kZWwpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLmlkID09PSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGN1cnJlbnRNb2RlbCwgaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmRleCsrO1xuXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfSkoKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFkZEFzc29jaWF0aW9uXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydHkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge0FycmF5fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBhZGRBc3NvY2lhdGlvbihtb2RlbCwgcHJvcGVydHksIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgaWYgKCEodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkpIHtcbiAgICAgICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKCdVc2luZyBgYWRkQXNzb2NpYXRpb25gIHJlcXVpcmVzIGEgaGFzTWFueSByZWxhdGlvbnNoaXAnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGN1cnJlbnRQcm9wZXJ0aWVzID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldKCk7XG4gICAgICAgICAgICBjdXJyZW50UHJvcGVydGllcyAgICAgPSBjdXJyZW50UHJvcGVydGllcy5jb25jYXQocHJvcGVydGllcyk7XG4gICAgICAgICAgICB2YXIgdXBkYXRlRGF0YSAgICAgICAgPSB7fTtcbiAgICAgICAgICAgIHVwZGF0ZURhdGFbcHJvcGVydHldICA9IGN1cnJlbnRQcm9wZXJ0aWVzO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudXBkYXRlTW9kZWwobW9kZWwsIHVwZGF0ZURhdGEpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZW1vdmVBc3NvY2lhdGlvblxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnR5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtBcnJheX1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQXNzb2NpYXRpb24obW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIGlmICghKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc01hbnkpKSB7XG4gICAgICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignVXNpbmcgYHJlbW92ZUFzc29jaWF0aW9uYCByZXF1aXJlcyBhIGhhc01hbnkgcmVsYXRpb25zaGlwJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjdXJyZW50UHJvcGVydGllcyA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XSgpO1xuXG4gICAgICAgICAgICBwcm9wZXJ0aWVzLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gY3VycmVudFByb3BlcnRpZXMuaW5kZXhPZihwcm9wZXJ0eSk7XG4gICAgICAgICAgICAgICAgY3VycmVudFByb3BlcnRpZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2YXIgdXBkYXRlRGF0YSAgICAgICAgPSB7fTtcbiAgICAgICAgICAgIHVwZGF0ZURhdGFbcHJvcGVydHldICA9IGN1cnJlbnRQcm9wZXJ0aWVzO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudXBkYXRlTW9kZWwobW9kZWwsIHVwZGF0ZURhdGEpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBpbmplY3RNZXRhXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpbmplY3RNZXRhKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0gPSB7XG4gICAgICAgICAgICAgICAgaWQ6ICsrdGhpcy5pZCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuTkVXLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVmFsdWVzOiB7fSxcbiAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBWYWx1ZXM6IHt9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGlzc3VlUHJvbWlzZVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnROYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjdXJyZW50TW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByZXZpb3VzTW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGlzc3VlUHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5zaWxlbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2F0d2Fsay5ldmVudHNbZXZlbnROYW1lXSAhPT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgLy8gQ2FsbGJhY2sgaGFzIG5vdCBhY3R1YWxseSBiZWVuIHNldC11cCBhbmQgdGhlcmVmb3JlIG1vZGVscyB3aWxsIG5ldmVyIGJlXG4gICAgICAgICAgICAgICAgLy8gcGVyc2lzdGVkLlxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBJc3N1ZSB0aGUgcHJvbWlzZSBmb3IgYmFjay1lbmQgcGVyc2lzdGVuY2Ugb2YgdGhlIG1vZGVsLlxuICAgICAgICAgICAgICAgIGNhdHdhbGsuZXZlbnRzW2V2ZW50TmFtZV0uY2FsbCh0aGlzLCB0aGlzLmNsZWFuTW9kZWwoY3VycmVudE1vZGVsIHx8IHByZXZpb3VzTW9kZWwpLCB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmU6IHJlc29sdmUsIHJlamVjdDogcmVqZWN0XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH0pLnRoZW4oKHJlc29sdXRpb25QYXJhbXMpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkIVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlc29sdmVQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKShyZXNvbHV0aW9uUGFyYW1zKTtcblxuICAgICAgICAgICAgICAgIH0sIChyZXNvbHV0aW9uUGFyYW1zKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZCFcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWplY3RQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKShyZXNvbHV0aW9uUGFyYW1zKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXNvbHZlUHJvbWlzZVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnROYW1lIHtTdHJpbmd9IC0gRXZlbnQgbmFtZSBpcyBhY3R1YWxseSBub3QgcmVxdWlyZWQsIGJlY2F1c2Ugd2UgY2FuIGRlZHVjZSB0aGUgc3Vic2VxdWVudCBhY3Rpb25cbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb20gdGhlIHN0YXRlIG9mIHRoZSBgY3VycmVudE1vZGVsYCBhbmQgYHByZXZpb3VzTW9kZWxgLCBidXQgd2UgYWRkIGl0IHRvIGFkZFxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhcmlmaWNhdGlvbiB0byBvdXIgbG9naWNhbCBzdGVwcy5cbiAgICAgICAgICogQHBhcmFtIGN1cnJlbnRNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJldmlvdXNNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHJlc29sdmVQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKSB7XG5cbiAgICAgICAgICAgIGlmIChjdXJyZW50TW9kZWwgJiYgZXZlbnROYW1lID09PSAnY3JlYXRlJykge1xuXG4gICAgICAgICAgICAgICAgLy8gTW9kZWwgaGFzIGJlZW4gc3VjY2Vzc2Z1bGx5IHBlcnNpc3RlZCFcbiAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLlNBVkVEO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdoZW4gd2UncmUgaW4gdGhlIHByb2Nlc3Mgb2YgZGVsZXRpbmcgYSBtb2RlbCwgdGhlIGBjdXJyZW50TW9kZWxgIGlzIHVuc2V0OyBpbnN0ZWFkIHRoZVxuICAgICAgICAgICAgLy8gYHByZXZpb3VzTW9kZWxgIHdpbGwgYmUgZGVmaW5lZC5cbiAgICAgICAgICAgIGlmICgoY3VycmVudE1vZGVsID09PSBudWxsICYmIHByZXZpb3VzTW9kZWwpICYmIGV2ZW50TmFtZSA9PT0gJ2RlbGV0ZScpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1vZGVsIGhhcyBiZWVuIHN1Y2Nlc3NmdWxseSBkZWxldGVkIVxuICAgICAgICAgICAgICAgIHByZXZpb3VzTW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLkRFTEVURUQ7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIChwcm9wZXJ0aWVzKSA9PiB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydGllcyAmJiBldmVudE5hbWUgIT09ICdyZWFkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgIXByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkoQ0FUV0FMS19NRVRBX1BST1BFUlRZKSAmJiBldmVudE5hbWUgPT09ICdyZWFkJykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLmNyZWF0ZU1vZGVsKHByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIG1vZGVsIHRvIHJlZmxlY3QgdGhlIGNoYW5nZXMgb24gdGhlIG9iamVjdCB0aGF0IGByZWFkTW9kZWxgIHJldHVybi5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBtb2RlbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNvbmRpdGlvbmFsbHlFbWl0RXZlbnQoKTtcblxuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVqZWN0UHJvbWlzZVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnROYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjdXJyZW50TW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByZXZpb3VzTW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICByZWplY3RQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCByZWplY3RXaXRoXG4gICAgICAgICAgICAgKiBAcGFyYW0gZHVwbGljYXRlTW9kZWwge09iamVjdH1cbiAgICAgICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciByZWplY3RXaXRoID0gKGR1cGxpY2F0ZU1vZGVsKSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAoZHVwbGljYXRlTW9kZWwpIHtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50TmFtZSA9PT0gJ3VwZGF0ZScgJiYgZHVwbGljYXRlTW9kZWwuaGFzT3duUHJvcGVydHkoQ0FUV0FMS19NRVRBX1BST1BFUlRZKSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXNlciBwYXNzZWQgaW4gYSBtb2RlbCBhbmQgdGhlcmVmb3JlIHRoZSBwcmV2aW91cyBzaG91bGQgYmUgZGVsZXRlZCwgYnV0IG9ubHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3aGVuIHdlJ3JlIHVwZGF0aW5nIVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVsZXRlTW9kZWwocHJldmlvdXNNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuREVMRVRFRDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2UgdGhlIGR1cGxpY2F0ZSBtb2RlbCBhcyB0aGUgcmVmZXJlbmNlLlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIGR1cGxpY2F0ZU1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuU0FWRUQ7XG5cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNvbmRpdGlvbmFsbHlFbWl0RXZlbnQoKTtcblxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHByZXZpb3VzTW9kZWwgPT09IG51bGwgJiYgZXZlbnROYW1lID09PSAnY3JlYXRlJykge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUHJldmlvdXMgbW9kZWwgd2FzIGFjdHVhbGx5IE5VTEwgYW5kIHRoZXJlZm9yZSB3ZSdsbCBkZWxldGUgaXQuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGVsZXRlTW9kZWwoY3VycmVudE1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ERUxFVEVEO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0V2l0aDtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsID09PSBudWxsICYmIGV2ZW50TmFtZSA9PT0gJ2RlbGV0ZScgKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEZXZlbG9wZXIgZG9lc24ndCBhY3R1YWxseSB3YW50IHRvIGRlbGV0ZSB0aGUgbW9kZWwsIGFuZCB0aGVyZWZvcmUgd2UgbmVlZCB0byByZXZlcnQgaXQgdG9cbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIG1vZGVsIGl0IHdhcywgYW5kIHNldCBpdHMgZmxhZyBiYWNrIHRvIHdoYXQgaXQgd2FzLlxuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLnVwZGF0ZU1vZGVsKHt9LCBwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbHMucHVzaChtb2RlbCk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoKGN1cnJlbnRNb2RlbCAmJiBwcmV2aW91c01vZGVsKSAmJiBldmVudE5hbWUgPT09ICd1cGRhdGUnKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBCb3RoIG9mIHRoZSBjdXJyZW50IGFuZCBwcmV2aW91cyBtb2RlbHMgYXJlIHVwZGF0ZWQsIGFuZCB0aGVyZWZvcmUgd2UnbGwgc2ltcGx5XG4gICAgICAgICAgICAgICAgICAgIC8vIHJldmVydCB0aGUgY3VycmVudCBtb2RlbCB0byB0aGUgcHJldmlvdXMgbW9kZWwuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZWplY3RXaXRoO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjb25kaXRpb25hbGx5RW1pdEV2ZW50XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBjb25kaXRpb25hbGx5RW1pdEV2ZW50KCkge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhdHdhbGsuZXZlbnRzLnJlZnJlc2ggPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgIC8vIFdlJ3JlIGFsbCBkb25lIVxuICAgICAgICAgICAgICAgIGNhdHdhbGsuZXZlbnRzLnJlZnJlc2goKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjbGVhbk1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBjbGVhbk1vZGVsKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIHZhciBjbGVhbmVkTW9kZWwgPSB7fTtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSBDQVRXQUxLX01FVEFfUFJPUEVSVFkpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBDYXR3YWxrIG1ldGEgZGF0YSBzaG91bGQgbmV2ZXIgYmUgcGVyc2lzdGVkIHRvIHRoZSBiYWNrLWVuZC5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBwcm9wZXJ0eSBpcyBhY3R1YWxseSBhIHJlbGF0aW9uc2hpcCwgd2hpY2ggd2UgbmVlZCB0byByZXNvbHZlIHRvXG4gICAgICAgICAgICAgICAgLy8gaXRzIHByaW1pdGl2ZSB2YWx1ZShzKS5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwRnVuY3Rpb24gPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gcmVsYXRpb25zaGlwRnVuY3Rpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0gJiYgbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5vcmlnaW5hbFZhbHVlc1twcm9wZXJ0eV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBkaXNjb3ZlcmVkIGEgdHlwZWNhc3RlZCBwcm9wZXJ0eSB0aGF0IG5lZWRzIHRvIGJlIHJldmVydGVkIHRvIGl0cyBvcmlnaW5hbFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFsdWUgYmVmb3JlIGludm9raW5nIHRoZSBjYWxsYmFjay5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFuZWRNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLm9yaWdpbmFsVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gbW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGNsZWFuZWRNb2RlbDtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgQmx1ZXByaW50TW9kZWxcbiAgICAgKi9cbiAgICBjbGFzcyBCbHVlcHJpbnRNb2RlbCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gYmx1ZXByaW50IHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0JsdWVwcmludE1vZGVsfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IobmFtZSwgYmx1ZXByaW50KSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgID0gbmFtZTtcbiAgICAgICAgICAgIHRoaXMubW9kZWwgPSBPYmplY3QuZnJlZXplKGJsdWVwcmludCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29udmVuaWVuY2UgbWV0aG9kIHRoYXQgd3JhcHMgYGl0ZXJhdGVQcm9wZXJ0aWVzYCBhbmQgYGl0ZXJhdGVCbHVlcHJpbnRgIGludG8gYSBvbmUtbGluZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZUFsbFxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlQWxsKHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuaXRlcmF0ZVByb3BlcnRpZXMocHJvcGVydGllcyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pdGVyYXRlQmx1ZXByaW50KG1vZGVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgaXRlcmF0aW5nIG92ZXIgdGhlIHBhc3NlZCBpbiBtb2RlbCBwcm9wZXJ0aWVzIHRvIGVuc3VyZSB0aGV5J3JlIGluIHRoZSBibHVlcHJpbnQsXG4gICAgICAgICAqIGFuZCB0eXBlY2FzdGluZyB0aGUgcHJvcGVydGllcyBiYXNlZCBvbiB0aGUgZGVmaW5lIGJsdWVwcmludCBmb3IgdGhlIGN1cnJlbnQgY29sbGVjdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBpdGVyYXRlUHJvcGVydGllc1xuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlUHJvcGVydGllcyhwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSAgICAgICAgICAgPSBwcm9wZXJ0aWVzW3Byb3BlcnR5XSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgIT09IENBVFdBTEtfTUVUQV9QUk9QRVJUWSAmJiB0eXBlb2YgcHJvcGVydHlIYW5kbGVyID09PSAndW5kZWZpbmVkJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByb3BlcnR5IGRvZXNuJ3QgYmVsb25nIGluIHRoZSBtb2RlbCBiZWNhdXNlIGl0J3Mgbm90IGluIHRoZSBibHVlcHJpbnQuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMucmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0eUhhbmRsZXIuZGVmaW5lUmVsYXRpb25zaGlwKHRoaXMubmFtZSwgcHJvcGVydHkpKTtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyLnNldFZhbHVlcyhwcm9wZXJ0aWVzW3Byb3BlcnR5XSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnRpZXNbQ0FUV0FMS19NRVRBX1BST1BFUlRZXSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSB0aGUgb3JpZ2luYWwgdmFsdWUgb2YgdGhlIHJlbGF0aW9uc2hpcCB0byByZXNvbHZlIHdoZW4gY2xlYW5pbmcgdGhlIG1vZGVsLlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1tDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0gPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3BlcnR5SGFuZGxlci52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcHJvcGVydHlIYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVHlwZWNhc3QgcHJvcGVydHkgdG8gdGhlIGRlZmluZWQgdHlwZS5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG9yaWdpbmFsVmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBwcm9wZXJ0eUhhbmRsZXIodmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjYXR3YWxrLnJldmVydFR5cGVjYXN0ICYmIG9yaWdpbmFsVmFsdWUgIT09IHZhbHVlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBvcmlnaW5hbCB2YWx1ZSBzbyB0aGF0IHdlIGNhbiByZXZlcnQgaXQgZm9yIHdoZW4gaW52b2tpbmcgdGhlIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB3aXRoIHRoZSBgY2xlYW5Nb2RlbGAgbWV0aG9kLlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1tDQVRXQUxLX01FVEFfUFJPUEVSVFldLm9yaWdpbmFsVmFsdWVzW3Byb3BlcnR5XSA9IG9yaWdpbmFsVmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gdmFsdWU7XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgaXRlcmF0aW5nIG92ZXIgdGhlIGJsdWVwcmludCB0byBkZXRlcm1pbmUgaWYgYW55IHByb3BlcnRpZXMgYXJlIG1pc3NpbmdcbiAgICAgICAgICogZnJvbSB0aGUgY3VycmVudCBtb2RlbCwgdGhhdCBoYXZlIGJlZW4gZGVmaW5lZCBpbiB0aGUgYmx1ZXByaW50IGFuZCB0aGVyZWZvcmUgc2hvdWxkIGJlXG4gICAgICAgICAqIHByZXNlbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZUJsdWVwcmludFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZUJsdWVwcmludChtb2RlbCkge1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0aGlzLm1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbW9kZWxbcHJvcGVydHldID09PSAndW5kZWZpbmVkJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEVuc3VyZSB0aGF0IGl0IGlzIGRlZmluZWQuXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSAgICAgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLnJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbCwgcHJvcGVydHksIHByb3BlcnR5SGFuZGxlci5kZWZpbmVSZWxhdGlvbnNoaXAodGhpcy5uYW1lLCBwcm9wZXJ0eSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyLnNldFZhbHVlcyhbXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5tb2RlbFtwcm9wZXJ0eV0gPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBwcm9wZXJ0eSBoYXMgYSBwcm9wZXJ0eSBoYW5kbGVyIG1ldGhvZCB3aGljaCB3b3VsZCBiZSByZXNwb25zaWJsZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIHR5cGVjYXN0aW5nLCBhbmQgZGV0ZXJtaW5pbmcgdGhlIGRlZmF1bHQgdmFsdWUuXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSBwcm9wZXJ0eUhhbmRsZXIoKTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgcmVpdGVyYXRpbmcgb3ZlciB0aGUgbW9kZWwgdG8gb25jZSBhZ2FpbiB0eXBlY2FzdCB0aGUgdmFsdWVzOyB3aGljaCBpc1xuICAgICAgICAgKiBlc3BlY2lhbGx5IHVzZWZ1bCBmb3Igd2hlbiB0aGUgbW9kZWwgaGFzIGJlZW4gdXBkYXRlZCwgYnV0IHJlbGF0aW9uc2hpcHMgbmVlZCB0byBiZSBsZWZ0XG4gICAgICAgICAqIGFsb25lLiBTaW5jZSB0aGUgbW9kZWwgaXMgc2VhbGVkIHdlIGNhbiBhbHNvIGd1YXJhbnRlZSB0aGF0IG5vIG90aGVyIHByb3BlcnRpZXMgaGF2ZSBiZWVuXG4gICAgICAgICAqIGFkZGVkIGludG8gdGhlIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIHJlaXRlcmF0ZVByb3BlcnRpZXNcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlaXRlcmF0ZVByb3BlcnRpZXMobW9kZWwpIHtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSBwcm9wZXJ0eUhhbmRsZXIobW9kZWxbcHJvcGVydHldKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgaW5zdGFudGlhdGluZyBhIG5ldyByZWxhdGlvbnNoaXAgcGVyIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIHJlbGF0aW9uc2hpcEhhbmRsZXJcbiAgICAgICAgICogQHRocm93cyBFeGNlcHRpb25cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnR5SGFuZGxlciB7UmVsYXRpb25zaGlwQWJzdHJhY3R9XG4gICAgICAgICAqIEByZXR1cm4ge1JlbGF0aW9uc2hpcEFic3RyYWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgcmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpIHtcblxuICAgICAgICAgICAgdmFyIGluc3RhbnRpYXRlUHJvcGVydGllcyA9IFtwcm9wZXJ0eUhhbmRsZXIudGFyZ2V0LmtleSwgcHJvcGVydHlIYW5kbGVyLnRhcmdldC5jb2xsZWN0aW9uXTtcblxuICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc01hbnkoLi4uaW5zdGFudGlhdGVQcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc09uZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUmVsYXRpb25zaGlwSGFzT25lKC4uLmluc3RhbnRpYXRlUHJvcGVydGllcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNob3VsZCBiZSB1bnJlYWNoYWJsZS4uLlxuICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignSW52YWxpZCByZWxhdGlvbnNoaXAgdHlwZScpO1xuXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBUeXBlY2FzdFxuICAgICAqL1xuICAgIGNsYXNzIFR5cGVjYXN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXR1cm5WYWx1ZVxuICAgICAgICAgKiBAcGFyYW0gdHlwZWNhc3RDb25zdHJ1Y3RvciB7RnVuY3Rpb259XG4gICAgICAgICAqIEBwYXJhbSB2YWx1ZSB7Kn1cbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7Kn1cbiAgICAgICAgICogQHJldHVybiB7Kn1cbiAgICAgICAgICovXG4gICAgICAgIHJldHVyblZhbHVlKHR5cGVjYXN0Q29uc3RydWN0b3IsIHZhbHVlLCBkZWZhdWx0VmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlY2FzdENvbnN0cnVjdG9yKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgPyB2YWx1ZSA6IGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzdHJpbmdcbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHN0cmluZyhkZWZhdWx0VmFsdWUgPSAnJykge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoU3RyaW5nLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGJvb2xlYW5cbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7Qm9vbGVhbn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBib29sZWFuKGRlZmF1bHRWYWx1ZSA9IHRydWUpIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKEJvb2xlYW4sIHZhbHVlLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgbnVtYmVyXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge051bWJlcn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBudW1iZXIoZGVmYXVsdFZhbHVlID0gMCkge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoTnVtYmVyLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFycmF5XG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge0FycmF5fVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGFycmF5KGRlZmF1bHRWYWx1ZSA9IFtdKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShBcnJheSwgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogbWV0aG9kIGF1dG9JbmNyZW1lbnRcbiAgICAgICAgICogQHBhcmFtIGluaXRpYWxWYWx1ZSB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGF1dG9JbmNyZW1lbnQoaW5pdGlhbFZhbHVlID0gMSkge1xuXG4gICAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBOdW1iZXIoaW5pdGlhbFZhbHVlKyspO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3VzdG9tXG4gICAgICAgICAqIEBwYXJhbSB0eXBlY2FzdEZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjdXN0b20odHlwZWNhc3RGbikge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVjYXN0Rm47XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXAge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGhhc09uZVxuICAgICAgICAgKiBAcGFyYW0gZm9yZWlnbktleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7UmVsYXRpb25zaGlwSGFzT25lfVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzT25lKGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc09uZShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBoYXNNYW55XG4gICAgICAgICAqIEBwYXJhbSBmb3JlaWduS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBIYXNNYW55fVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzTWFueShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNNYW55KGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEFic3RyYWN0XG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIGZvcmVpZ25LZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3Rvcihmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuXG4gICAgICAgICAgICB0aGlzLnRhcmdldCA9IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBrZXk6IGZvcmVpZ25LZXlcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNldFZhbHVlc1xuICAgICAgICAgKiBAcGFyYW0gdmFsdWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRWYWx1ZXModmFsdWVzKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcyA9IHRoaXMudmFsdWUgPSB2YWx1ZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gYWNjZXNzb3JGdW5jdGlvbnMge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCBhY2Nlc3NvckZ1bmN0aW9ucykge1xuXG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBrZXk6IGxvY2FsS2V5XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGdldDogYWNjZXNzb3JGdW5jdGlvbnMuZ2V0LFxuICAgICAgICAgICAgICAgIHNldDogYWNjZXNzb3JGdW5jdGlvbnMuc2V0LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYXNzZXJ0Rm9yZWlnblByb3BlcnR5RXhpc3RzXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGFzc2VydEZvcmVpZ25Qcm9wZXJ0eUV4aXN0cyhjb2xsZWN0aW9uLCBsb2NhbEtleSkge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNvbGxlY3Rpb24uYmx1ZXByaW50Lm1vZGVsW2xvY2FsS2V5XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKGBVbmFibGUgdG8gZmluZCBwcm9wZXJ0eSBcIiR7bG9jYWxLZXl9XCIgaW4gY29sbGVjdGlvbiBcIiR7Y29sbGVjdGlvbi5uYW1lfVwiYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEhhc01hbnlcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXBIYXNNYW55IGV4dGVuZHMgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlZmluZVJlbGF0aW9uc2hpcFxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXkpIHtcblxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXksIHtcbiAgICAgICAgICAgICAgICBnZXQ6IHRoaXMuZ2V0TW9kZWxzLmJpbmQodGhpcyksXG4gICAgICAgICAgICAgICAgc2V0OiB0aGlzLnNldE1vZGVscy5iaW5kKHRoaXMpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZ2V0TW9kZWxzXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TW9kZWxzKCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgbG9hZE1vZGVsc1xuICAgICAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBsb2FkTW9kZWxzID0gKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcmVpZ25Db2xsZWN0aW9uLm1vZGVscy5maWx0ZXIoKGZvcmVpZ25Nb2RlbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZXMuaW5kZXhPZihmb3JlaWduTW9kZWxbdGhpcy50YXJnZXQua2V5XSkgIT09IC0xO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgYXJyYXlEaWZmXG4gICAgICAgICAgICAgKiBAcGFyYW0gZmlyc3RBcnJheSB7QXJyYXl9XG4gICAgICAgICAgICAgKiBAcGFyYW0gc2Vjb25kQXJyYXkge0FycmF5fVxuICAgICAgICAgICAgICogQHJldHVybiB7Kn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGFycmF5RGlmZiA9IChmaXJzdEFycmF5LCBzZWNvbmRBcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaXJzdEFycmF5LmZpbHRlcigoaW5kZXgpID0+IHNlY29uZEFycmF5LmluZGV4T2YoaW5kZXgpIDwgMClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBmb3JlaWduQ29sbGVjdGlvbiA9IGNhdHdhbGsuY29sbGVjdGlvbih0aGlzLnRhcmdldC5jb2xsZWN0aW9uKSxcbiAgICAgICAgICAgICAgICBtb2RlbHMgICAgICAgICAgICA9IGxvYWRNb2RlbHMoKTtcblxuICAgICAgICAgICAgLy8gQXNzZXJ0IHRoYXQgdGhlIGZvcmVpZ24gcHJvcGVydHkgZXhpc3RzIGluIHRoZSBjb2xsZWN0aW9uLlxuICAgICAgICAgICAgdGhpcy5hc3NlcnRGb3JlaWduUHJvcGVydHlFeGlzdHMoZm9yZWlnbkNvbGxlY3Rpb24sIHRoaXMudGFyZ2V0LmtleSk7XG5cbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGlzIGEgZGlzY3JlcGFuY3kgYmV0d2VlbiB0aGUgY291bnRzLCB0aGVuIHdlIGtub3cgYWxsIHRoZSBtb2RlbHMgaGF2ZW4ndCBiZWVuIGxvYWRlZC5cbiAgICAgICAgICAgIGlmIChtb2RlbHMubGVuZ3RoICE9PSB0aGlzLnZhbHVlcy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgICAgIC8vIERpc2NvdmVyIHRoZSBrZXlzIHRoYXQgYXJlIGN1cnJlbnRseSBub3QgbG9hZGVkLlxuICAgICAgICAgICAgICAgIHZhciBsb2FkZWRLZXlzICAgPSBtb2RlbHMubWFwKG1vZGVsID0+IG1vZGVsW3RoaXMudGFyZ2V0LmtleV0pLFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZEtleXMgPSBhcnJheURpZmYodGhpcy52YWx1ZXMsIGxvYWRlZEtleXMpO1xuXG4gICAgICAgICAgICAgICAgcmVxdWlyZWRLZXlzLmZvckVhY2goKGZvcmVpZ25LZXkpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVxdWlyZWRNb2RlbCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZE1vZGVsW3RoaXMudGFyZ2V0LmtleV0gPSBmb3JlaWduS2V5O1xuICAgICAgICAgICAgICAgICAgICBmb3JlaWduQ29sbGVjdGlvbi5yZWFkTW9kZWwocmVxdWlyZWRNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVhZCB0aGUgbW9kZWxzIGFnYWluIGltbWVkaWF0ZWx5LlxuICAgICAgICAgICAgICAgIG1vZGVscyA9IGxvYWRNb2RlbHMoKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWxzO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzZXRNb2RlbHNcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNldE1vZGVscyh2YWx1ZXMpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWVzID0gdmFsdWVzO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwSGFzT25lXG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwSGFzT25lIGV4dGVuZHMgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlZmluZVJlbGF0aW9uc2hpcFxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXkpIHtcblxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXksIHtcbiAgICAgICAgICAgICAgICBnZXQ6IHRoaXMuZ2V0TW9kZWwuYmluZCh0aGlzKSxcbiAgICAgICAgICAgICAgICBzZXQ6IHRoaXMuc2V0TW9kZWwuYmluZCh0aGlzKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGdldE1vZGVsXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGdldE1vZGVsKCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgbG9hZE1vZGVsXG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBsb2FkTW9kZWwgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcmVpZ25Db2xsZWN0aW9uLm1vZGVscy5maW5kKChmb3JlaWduTW9kZWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWUgPT09IGZvcmVpZ25Nb2RlbFt0aGlzLnRhcmdldC5rZXldO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIGZvcmVpZ25Db2xsZWN0aW9uID0gY2F0d2Fsay5jb2xsZWN0aW9uKHRoaXMudGFyZ2V0LmNvbGxlY3Rpb24pLFxuICAgICAgICAgICAgICAgIG1vZGVsICAgICAgICAgICAgID0gbG9hZE1vZGVsKCk7XG5cbiAgICAgICAgICAgIC8vIEFzc2VydCB0aGF0IHRoZSBmb3JlaWduIHByb3BlcnR5IGV4aXN0cyBpbiB0aGUgY29sbGVjdGlvbi5cbiAgICAgICAgICAgIHRoaXMuYXNzZXJ0Rm9yZWlnblByb3BlcnR5RXhpc3RzKGZvcmVpZ25Db2xsZWN0aW9uLCB0aGlzLnRhcmdldC5rZXkpO1xuXG4gICAgICAgICAgICBpZiAoIW1vZGVsKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBjYW5ub3QgYmUgZm91bmQgYW5kIHRoZXJlZm9yZSB3ZSdsbCBhdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVsIGludG8gdGhlIGNvbGxlY3Rpb24uXG4gICAgICAgICAgICAgICAgdmFyIHJlcXVpcmVkTW9kZWwgICA9IHt9O1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkTW9kZWxbdGhpcy50YXJnZXQua2V5XSA9IHRoaXMudmFsdWU7XG4gICAgICAgICAgICAgICAgZm9yZWlnbkNvbGxlY3Rpb24ucmVhZE1vZGVsKHJlcXVpcmVkTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZWFkIHRoZSBtb2RlbCBhZ2FpbiBpbW1lZGlhdGVseS5cbiAgICAgICAgICAgICAgICBtb2RlbCA9IGxvYWRNb2RlbCgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2V0TW9kZWxcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNldE1vZGVsKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBUcmFuc2FjdGlvblxuICAgICAqL1xuICAgIGNsYXNzIFRyYW5zYWN0aW9uIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEByZXR1cm4ge1RyYW5zYWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWxzICAgID0gW107XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVGbiA9ICgpID0+IHt9O1xuXG4gICAgICAgICAgICAvLyBGbHVzaCB0aGUgcHJvbWlzZXMgaW4gdGhlIHN1YnNlcXVlbnQgcnVuLWxvb3AuXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZmx1c2gpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhZGRcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9taXNlIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBhZGQobW9kZWwsIHByb21pc2UpIHtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2goeyBtb2RlbDogbW9kZWwsIHByb21pc2U6IHByb21pc2UgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXNvbHZlXG4gICAgICAgICAqIEBwYXJhbSByZXNvbHZlRm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgcmVzb2x2ZShyZXNvbHZlRm4pIHtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZUZuID0gcmVzb2x2ZUZuO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZmx1c2hcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGZsdXNoKCkge1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlRm4odGhpcy5tb2RlbHMpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBJbnN0YW50aWF0ZSB0aGUgQ2F0d2FsayBjbGFzcy5cbiAgICAkd2luZG93LmNhdHdhbGsgICAgICAgID0gbmV3IENhdHdhbGsoKTtcbiAgICAkd2luZG93LmNhdHdhbGsuTUVUQSAgID0gQ0FUV0FMS19NRVRBX1BST1BFUlRZO1xuICAgICR3aW5kb3cuY2F0d2Fsay5TVEFURVMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTO1xuXG59KSh3aW5kb3cpOyIsInZhciAkX19wbGFjZWhvbGRlcl9fMCA9ICRfX3BsYWNlaG9sZGVyX18xIiwiKCR0cmFjZXVyUnVudGltZS5jcmVhdGVDbGFzcykoJF9fcGxhY2Vob2xkZXJfXzAsICRfX3BsYWNlaG9sZGVyX18xLCAkX19wbGFjZWhvbGRlcl9fMikiLCIkdHJhY2V1clJ1bnRpbWUuc3ByZWFkKCRfX3BsYWNlaG9sZGVyX18wKSIsIiR0cmFjZXVyUnVudGltZS5kZWZhdWx0U3VwZXJDYWxsKHRoaXMsXG4gICAgICAgICAgICAgICAgJF9fcGxhY2Vob2xkZXJfXzAucHJvdG90eXBlLCBhcmd1bWVudHMpIiwidmFyICRfX3BsYWNlaG9sZGVyX18wID0gJF9fcGxhY2Vob2xkZXJfXzEiLCIoJHRyYWNldXJSdW50aW1lLmNyZWF0ZUNsYXNzKSgkX19wbGFjZWhvbGRlcl9fMCwgJF9fcGxhY2Vob2xkZXJfXzEsICRfX3BsYWNlaG9sZGVyX18yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJF9fcGxhY2Vob2xkZXJfXzMpIiwiJHRyYWNldXJSdW50aW1lLnN1cGVyQ2FsbCgkX19wbGFjZWhvbGRlcl9fMCwgJF9fcGxhY2Vob2xkZXJfXzEsICRfX3BsYWNlaG9sZGVyX18yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMykiXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=