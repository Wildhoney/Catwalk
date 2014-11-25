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
    on: function(name, eventFn) {
      this.events[name] = eventFn;
    },
    off: function(name) {
      delete this.events[name];
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
      return model;
    },
    addModels: function() {
      var propertiesList = arguments[0] !== (void 0) ? arguments[0] : [];
      var $__0 = this;
      if (!Array.isArray(propertiesList)) {
        catwalk.throwException('Argument for `addModels` must be an array of properties');
      }
      var models = [];
      propertiesList.forEach((function(properties) {
        models.push($__0.addModel(properties));
      }));
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNhdHdhbGsuanMiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMSIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci8yIiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzciLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvNCIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci82IiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzUiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFLQTtBQUFBLEFBQUMsUUFBUyxLQUFHLENBQUUsT0FBTTtBQUVqQixhQUFXLENBQUM7SUFNTixDQUFBLHFCQUFvQixFQUFJLFlBQVU7SUFNbEMsQ0FBQSx5QkFBd0IsRUFBSTtBQUFFLE1BQUUsQ0FBRyxFQUFBO0FBQUcsUUFBSSxDQUFHLEVBQUE7QUFBRyxRQUFJLENBQUcsRUFBQTtBQUFHLFVBQU0sQ0FBRyxFQUFBO0FBQUEsRUFBRTtBQ25CL0UsQUFBSSxJQUFBLFVEd0JBLFNBQU0sUUFBTSxDQU1HLEFBQUMsQ0FBRTtBQUNWLE9BQUcsT0FBTyxFQUFZLEdBQUMsQ0FBQztBQUN4QixPQUFHLFlBQVksRUFBTyxHQUFDLENBQUM7QUFDeEIsT0FBRyxhQUFhLEVBQU0sSUFBSSxhQUFXLEFBQUMsRUFBQyxDQUFDO0FBQ3hDLE9BQUcsU0FBUyxFQUFVLElBQUksU0FBTyxBQUFDLEVBQUMsQ0FBQztBQUNwQyxPQUFHLGVBQWUsRUFBSSxLQUFHLENBQUM7RUNuQ0UsQURvQ2hDLENDcENnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUY0Q3JCLG1CQUFlLENBQWYsVUFBaUIsSUFBRyxBQUFpQixDQUFHO1FBQWpCLFdBQVMsNkNBQUksR0FBQztBQUVqQyxTQUFHLEVBQUksQ0FBQSxNQUFLLEFBQUMsQ0FBQyxJ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QUMsQ0FBQztJQUN4RDtBQU9BLFVBQU0sQ0FBTixVQUFRLFNBQVEsQ0FBRztBQUNmLFNBQUcsVUFBVSxFQUFJLFVBQVEsQ0FBQztJQUM5QjtBQU1BLFFBQUksQ0FBSixVQUFLLEFBQUMsQ0FBRTtBQUNKLFNBQUcsVUFBVSxBQUFDLENBQUMsSUFBRyxPQUFPLENBQUMsQ0FBQztJQUMvQjtBQUFBLE9FdHZDNkU7QUYydkNqRixRQUFNLFFBQVEsRUFBVyxJQUFJLFFBQU0sQUFBQyxFQUFDLENBQUM7QUFDdEMsUUFBTSxRQUFRLEtBQUssRUFBTSxzQkFBb0IsQ0FBQztBQUM5QyxRQUFNLFFBQVEsT0FBTyxFQUFJLDBCQUF3QixDQUFDO0FBRXRELENBQUMsQUFBQyxDQUFDLE1BQUssQ0FBQyxDQUFDO0FBQUEiLCJmaWxlIjoiY2F0d2Fsay5lczUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBtb2R1bGUgQ2F0d2Fsa1xuICogQGF1dGhvciBBZGFtIFRpbWJlcmxha2VcbiAqIEBsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9XaWxkaG9uZXkvQ2F0d2Fsay5qc1xuICovXG4oZnVuY3Rpb24gbWFpbigkd2luZG93KSB7XG5cbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIC8qKlxuICAgICAqIEBjb25zdGFudCBDQVRXQUxLX01FVEFfUFJPUEVSVFlcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIGNvbnN0IENBVFdBTEtfTUVUQV9QUk9QRVJUWSA9ICdfX2NhdHdhbGsnO1xuXG4gICAgLyoqXG4gICAgICogQGNvbnN0YW50IENBVFdBTEtfU1RBVEVfUFJPUEVSVElFU1xuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgY29uc3QgQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUyA9IHsgTkVXOiAxLCBESVJUWTogMiwgU0FWRUQ6IDQsIERFTEVURUQ6IDggfTtcblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBDYXR3YWxrXG4gICAgICovXG4gICAgY2xhc3MgQ2F0d2FsayB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcmV0dXJuIHtDYXR3YWxrfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50cyAgICAgICAgID0ge307XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25zICAgID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcCAgID0gbmV3IFJlbGF0aW9uc2hpcCgpO1xuICAgICAgICAgICAgdGhpcy50eXBlY2FzdCAgICAgICA9IG5ldyBUeXBlY2FzdCgpO1xuICAgICAgICAgICAgdGhpcy5yZXZlcnRUeXBlY2FzdCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVDb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBbcHJvcGVydGllcz17fV0ge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZUNvbGxlY3Rpb24obmFtZSwgcHJvcGVydGllcyA9IHt9KSB7XG5cbiAgICAgICAgICAgIG5hbWUgPSBTdHJpbmcobmFtZSk7XG5cbiAgICAgICAgICAgIGlmIChuYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGhyb3dFeGNlcHRpb24oJ0NvbGxlY3Rpb24gbXVzdCBoYXZlIGFuIGFzc29jaWF0ZWQgbmFtZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMocHJvcGVydGllcykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50aHJvd0V4Y2VwdGlvbihgQ29sbGVjdGlvbiBcIiR7bmFtZX1cIiBtdXN0IGRlZmluZSBpdHMgYmx1ZXByaW50YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gbmV3IENvbGxlY3Rpb24obmFtZSwgcHJvcGVydGllcyk7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25zW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWxldGVDb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBkZWxldGVDb2xsZWN0aW9uKG5hbWUpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuY29sbGVjdGlvbnNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5jb2xsZWN0aW9uc1tuYW1lXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY29sbGVjdGlvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29sbGVjdGlvbihuYW1lKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5jb2xsZWN0aW9uc1tuYW1lXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRocm93RXhjZXB0aW9uKGBVbmFibGUgdG8gZmluZCBjb2xsZWN0aW9uIFwiJHtuYW1lfVwiYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb25zW25hbWVdO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVUcmFuc2FjdGlvblxuICAgICAgICAgKiBAcmV0dXJuIHtUcmFuc2FjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZVRyYW5zYWN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUcmFuc2FjdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmV2ZXJ0Q2FsbGJhY2tUeXBlY2FzdFxuICAgICAgICAgKiBAcGFyYW0gc2V0dGluZyB7Qm9vbGVhbn1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHJldmVydENhbGxiYWNrVHlwZWNhc3Qoc2V0dGluZykge1xuICAgICAgICAgICAgdGhpcy5yZXZlcnRUeXBlY2FzdCA9ICEhc2V0dGluZztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHRocm93RXhjZXB0aW9uXG4gICAgICAgICAqIEB0aHJvd3MgRXhjZXB0aW9uXG4gICAgICAgICAqIEBwYXJhbSBtZXNzYWdlIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICB0aHJvd0V4Y2VwdGlvbihtZXNzYWdlKSB7XG4gICAgICAgICAgICB0aHJvdyBgQ2F0d2FsazogJHttZXNzYWdlfS5gO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgb25cbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGV2ZW50Rm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgb24obmFtZSwgZXZlbnRGbikge1xuICAgICAgICAgICAgdGhpcy5ldmVudHNbbmFtZV0gPSBldmVudEZuO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgb2ZmXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBvZmYobmFtZSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRzW25hbWVdO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgQ29sbGVjdGlvblxuICAgICAqL1xuICAgIGNsYXNzIENvbGxlY3Rpb24ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKG5hbWUsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIHRoaXMuaWQgICAgICAgID0gMDtcbiAgICAgICAgICAgIHRoaXMubmFtZSAgICAgID0gbmFtZTtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzICAgID0gW107XG4gICAgICAgICAgICB0aGlzLnNpbGVudCAgICA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5ibHVlcHJpbnQgPSBuZXcgQmx1ZXByaW50TW9kZWwobmFtZSwgcHJvcGVydGllcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzaWxlbnRseVxuICAgICAgICAgKiBAcGFyYW0gc2lsZW50Rm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2lsZW50bHkoc2lsZW50Rm4pIHtcblxuICAgICAgICAgICAgdmFyIHNpbGVudEJlZm9yZSA9IHRoaXMuc2lsZW50O1xuICAgICAgICAgICAgdGhpcy5zaWxlbnQgICAgICA9IHRydWU7XG4gICAgICAgICAgICBzaWxlbnRGbi5hcHBseSh0aGlzKTtcblxuICAgICAgICAgICAgaWYgKCFzaWxlbnRCZWZvcmUpIHtcblxuICAgICAgICAgICAgICAgIC8vIE9ubHkgcmVtb3ZlIHRoZSBzaWxlbmNlIGlmIGl0IHdhc24ndCBzaWxlbnQgYmVmb3JlLCB3aGljaCBwcmV2ZW50cyBhZ2FpbnN0XG4gICAgICAgICAgICAgICAgLy8gbmVzdGluZyB0aGUgYHNpbGVudGx5YCBtZXRob2RzIGluc2lkZSBvbmUgYW5vdGhlci5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudCA9IGZhbHNlO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb252ZXJ0cyBlYWNoIG5vbi1leHRlbnNpYmxlIG1vZGVsIGludG8gYW4gZXh0ZW5zaWJsZSBtb2RlbCwgd2hpY2ggaXMgdXNlZnVsIGZvciBKYXZhU2NyaXB0IGZyYW1ld29ya3NcbiAgICAgICAgICogc3VjaCBhcyBBbmd1bGFyLmpzIHdoaWNoIGluc2lzdCBvbiBpbmplY3RpbmcgJCRoYXNoS2V5IGludG8gZWFjaCBvYmplY3QuIFBmZnQhXG4gICAgICAgICAqXG4gICAgICAgICAqIFRvZG86IFVzZSBhIGdlbmVyYXRvciBpbnN0ZWFkIG9mIGEgc2ltcGxlIHJldHVybiBzdGF0ZW1lbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgZXh0ZW5zaWJsZUl0ZXJhdGlvblxuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGV4dGVuc2libGVJdGVyYXRpb24oKSB7XG5cbiAgICAgICAgICAgIHZhciBleHRlbnNpYmxlTW9kZWxzID0gW107XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBtYWtlRXh0ZW5zaWJsZVxuICAgICAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBtYWtlRXh0ZW5zaWJsZSA9IChtb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dGVuc2libGVNb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICAgICAgLy8gQ29weSBhY3Jvc3MgdGhlIG1vZGVsIGludG8gYW4gZXh0ZW5zaWJsZSBvYmplY3QuXG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2goa2V5ID0+IGV4dGVuc2libGVNb2RlbFtrZXldID0gbW9kZWxba2V5XSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZXh0ZW5zaWJsZU1vZGVsO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVscy5mb3JFYWNoKG1vZGVsID0+IGV4dGVuc2libGVNb2RlbHMucHVzaChtYWtlRXh0ZW5zaWJsZShtb2RlbCkpKTtcblxuICAgICAgICAgICAgcmV0dXJuIGV4dGVuc2libGVNb2RlbHM7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFkZE1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGFkZE1vZGVsKHByb3BlcnRpZXMgPSB7fSkge1xuXG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB7fTtcblxuICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG4gICAgICAgICAgICAgICAgbW9kZWwgPSB0aGlzLmNyZWF0ZU1vZGVsKHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYWRkTW9kZWxzXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzTGlzdCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGFkZE1vZGVscyhwcm9wZXJ0aWVzTGlzdCA9IFtdKSB7XG5cbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcm9wZXJ0aWVzTGlzdCkpIHtcbiAgICAgICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKCdBcmd1bWVudCBmb3IgYGFkZE1vZGVsc2AgbXVzdCBiZSBhbiBhcnJheSBvZiBwcm9wZXJ0aWVzJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBtb2RlbHMgPSBbXTtcblxuICAgICAgICAgICAgcHJvcGVydGllc0xpc3QuZm9yRWFjaCgocHJvcGVydGllcykgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGVscy5wdXNoKHRoaXMuYWRkTW9kZWwocHJvcGVydGllcykpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbHM7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNyZWF0ZU1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBbcHJvcGVydGllcz17fV0ge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlTW9kZWwocHJvcGVydGllcyA9IHt9KSB7XG5cbiAgICAgICAgICAgIHRoaXMuaW5qZWN0TWV0YShwcm9wZXJ0aWVzKTtcblxuICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSBtb2RlbCBjb25mb3JtcyB0byB0aGUgYmx1ZXByaW50LlxuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5ibHVlcHJpbnQuaXRlcmF0ZUFsbChwcm9wZXJ0aWVzKTtcblxuICAgICAgICAgICAgT2JqZWN0LnNlYWwobW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5tb2RlbHMucHVzaChtb2RlbCk7XG4gICAgICAgICAgICB0aGlzLmlzc3VlUHJvbWlzZSgnY3JlYXRlJywgbW9kZWwsIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZWFkTW9kZWxcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgcmVhZE1vZGVsKHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIHRoaXMuaXNzdWVQcm9taXNlKCdyZWFkJywgcHJvcGVydGllcywgbnVsbCk7XG4gICAgICAgICAgICByZXR1cm4gcHJvcGVydGllcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHVwZGF0ZU1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICB1cGRhdGVNb2RlbChtb2RlbCwgcHJvcGVydGllcykge1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBjb3B5IG9mIHRoZSBvbGQgbW9kZWwgZm9yIHJvbGxpbmcgYmFjay5cbiAgICAgICAgICAgIHZhciBwcmV2aW91c01vZGVsID0ge307XG4gICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbCkuZm9yRWFjaChwcm9wZXJ0eSA9PiBwcmV2aW91c01vZGVsW3Byb3BlcnR5XSA9IG1vZGVsW3Byb3BlcnR5XSk7XG5cbiAgICAgICAgICAgIHRyeSB7XG5cbiAgICAgICAgICAgICAgICAvLyBDb3B5IGFjcm9zcyB0aGUgZGF0YSBmcm9tIHRoZSBwcm9wZXJ0aWVzLiBXZSB3cmFwIHRoZSBhc3NpZ25tZW50IGluIGEgdHJ5LWNhdGNoIGJsb2NrXG4gICAgICAgICAgICAgICAgLy8gYmVjYXVzZSBpZiB0aGUgdXNlciBoYXMgYWRkZWQgYW55IGFkZGl0aW9uYWwgcHJvcGVydGllcyB0aGF0IGRvbid0IGJlbG9uZyBpbiB0aGUgbW9kZWwsXG4gICAgICAgICAgICAgICAgLy8gYW4gZXhjZXB0aW9uIHdpbGwgYmUgcmFpc2VkIGJlY2F1c2UgdGhlIG9iamVjdCBpcyBzZWFsZWQuXG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMocHJvcGVydGllcykuZm9yRWFjaChwcm9wZXJ0eSA9PiBtb2RlbFtwcm9wZXJ0eV0gPSBwcm9wZXJ0aWVzW3Byb3BlcnR5XSk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChleGNlcHRpb24pIHt9XG5cbiAgICAgICAgICAgIC8vIFR5cGVjYXN0IHRoZSB1cGRhdGVkIG1vZGVsIGFuZCBjb3B5IGFjcm9zcyBpdHMgcHJvcGVydGllcyB0byB0aGUgY3VycmVudCBtb2RlbCwgc28gYXMgd2VcbiAgICAgICAgICAgIC8vIGRvbid0IGJyZWFrIGFueSByZWZlcmVuY2VzLlxuICAgICAgICAgICAgdmFyIHR5cGVjYXN0TW9kZWwgPSB0aGlzLmJsdWVwcmludC5yZWl0ZXJhdGVQcm9wZXJ0aWVzKG1vZGVsKTtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHR5cGVjYXN0TW9kZWwpLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSA9IHR5cGVjYXN0TW9kZWxbcHJvcGVydHldXG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLmlzc3VlUHJvbWlzZSgndXBkYXRlJywgbW9kZWwsIHByZXZpb3VzTW9kZWwpO1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWxldGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZGVsZXRlTW9kZWwobW9kZWwpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIHJlbW92ZVxuICAgICAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAgICAgKiBAcGFyYW0gaW5kZXgge051bWJlcn1cbiAgICAgICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIHJlbW92ZSA9IChtb2RlbCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmlzc3VlUHJvbWlzZSgnZGVsZXRlJywgbnVsbCwgbW9kZWwpO1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIERldGVybWluZXMgd2hldGhlciB0aGUgbW9kZWwgd2FzIHN1Y2Nlc3NmdWxseSBkZWxldGVkIHdpdGggZmluZGluZyB0aGUgbW9kZWwgYnkgcmVmZXJlbmNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEBwcm9wZXJ0eSBkaWREZWxldGVWaWFSZWZlcmVuY2VcbiAgICAgICAgICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgZGlkRGVsZXRlVmlhUmVmZXJlbmNlID0gZmFsc2U7XG5cbiAgICAgICAgICAgICgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZmluZCB0aGUgbW9kZWwgYnkgcmVmZXJlbmNlLlxuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMubW9kZWxzLmluZGV4T2YobW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBkaWREZWxldGVWaWFSZWZlcmVuY2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmUodGhpcy5tb2RlbHNbaW5kZXhdLCBpbmRleCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICBpZiAoIWRpZERlbGV0ZVZpYVJlZmVyZW5jZSkge1xuXG4gICAgICAgICAgICAgICAgKCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBtb2RlbCBieSBpdHMgaW50ZXJuYWwgQ2F0d2FsayBJRC5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbHMuZm9yRWFjaCgoY3VycmVudE1vZGVsKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5pZCA9PT0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5pZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShjdXJyZW50TW9kZWwsIGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXgrKztcblxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIH0pKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhZGRBc3NvY2lhdGlvblxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnR5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtBcnJheX1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkQXNzb2NpYXRpb24obW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIGlmICghKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc01hbnkpKSB7XG4gICAgICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignVXNpbmcgYGFkZEFzc29jaWF0aW9uYCByZXF1aXJlcyBhIGhhc01hbnkgcmVsYXRpb25zaGlwJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjdXJyZW50UHJvcGVydGllcyA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XSgpO1xuICAgICAgICAgICAgY3VycmVudFByb3BlcnRpZXMgICAgID0gY3VycmVudFByb3BlcnRpZXMuY29uY2F0KHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgdmFyIHVwZGF0ZURhdGEgICAgICAgID0ge307XG4gICAgICAgICAgICB1cGRhdGVEYXRhW3Byb3BlcnR5XSAgPSBjdXJyZW50UHJvcGVydGllcztcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVwZGF0ZU1vZGVsKG1vZGVsLCB1cGRhdGVEYXRhKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVtb3ZlQXNzb2NpYXRpb25cbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7QXJyYXl9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZUFzc29jaWF0aW9uKG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydGllcykge1xuXG4gICAgICAgICAgICBpZiAoISh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNNYW55KSkge1xuICAgICAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oJ1VzaW5nIGByZW1vdmVBc3NvY2lhdGlvbmAgcmVxdWlyZXMgYSBoYXNNYW55IHJlbGF0aW9uc2hpcCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY3VycmVudFByb3BlcnRpZXMgPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0oKTtcblxuICAgICAgICAgICAgcHJvcGVydGllcy5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRQcm9wZXJ0aWVzLmluZGV4T2YocHJvcGVydHkpO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRQcm9wZXJ0aWVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIHVwZGF0ZURhdGEgICAgICAgID0ge307XG4gICAgICAgICAgICB1cGRhdGVEYXRhW3Byb3BlcnR5XSAgPSBjdXJyZW50UHJvcGVydGllcztcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVwZGF0ZU1vZGVsKG1vZGVsLCB1cGRhdGVEYXRhKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaW5qZWN0TWV0YVxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaW5qZWN0TWV0YShtb2RlbCkge1xuXG4gICAgICAgICAgICBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldID0ge1xuICAgICAgICAgICAgICAgIGlkOiArK3RoaXMuaWQsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLk5FVyxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFZhbHVlczoge30sXG4gICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwVmFsdWVzOiB7fVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBpc3N1ZVByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBpc3N1ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc2lsZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhdHdhbGsuZXZlbnRzW2V2ZW50TmFtZV0gIT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgIC8vIENhbGxiYWNrIGhhcyBub3QgYWN0dWFsbHkgYmVlbiBzZXQtdXAgYW5kIHRoZXJlZm9yZSBtb2RlbHMgd2lsbCBuZXZlciBiZVxuICAgICAgICAgICAgICAgIC8vIHBlcnNpc3RlZC5cbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgdGhlIHByb21pc2UgZm9yIGJhY2stZW5kIHBlcnNpc3RlbmNlIG9mIHRoZSBtb2RlbC5cbiAgICAgICAgICAgICAgICBjYXR3YWxrLmV2ZW50c1tldmVudE5hbWVdLmNhbGwodGhpcywgdGhpcy5jbGVhbk1vZGVsKGN1cnJlbnRNb2RlbCB8fCBwcmV2aW91c01vZGVsKSwge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlOiByZXNvbHZlLCByZWplY3Q6IHJlamVjdFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9KS50aGVuKChyZXNvbHV0aW9uUGFyYW1zKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUHJvbWlzZSBoYXMgYmVlbiByZXNvbHZlZCFcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXNvbHZlUHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkocmVzb2x1dGlvblBhcmFtcyk7XG5cbiAgICAgICAgICAgICAgICB9LCAocmVzb2x1dGlvblBhcmFtcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWQhXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVqZWN0UHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkocmVzb2x1dGlvblBhcmFtcyk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVzb2x2ZVByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfSAtIEV2ZW50IG5hbWUgaXMgYWN0dWFsbHkgbm90IHJlcXVpcmVkLCBiZWNhdXNlIHdlIGNhbiBkZWR1Y2UgdGhlIHN1YnNlcXVlbnQgYWN0aW9uXG4gICAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tIHRoZSBzdGF0ZSBvZiB0aGUgYGN1cnJlbnRNb2RlbGAgYW5kIGBwcmV2aW91c01vZGVsYCwgYnV0IHdlIGFkZCBpdCB0byBhZGRcbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXJpZmljYXRpb24gdG8gb3VyIGxvZ2ljYWwgc3RlcHMuXG4gICAgICAgICAqIEBwYXJhbSBjdXJyZW50TW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByZXZpb3VzTW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICByZXNvbHZlUHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkge1xuXG4gICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsICYmIGV2ZW50TmFtZSA9PT0gJ2NyZWF0ZScpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1vZGVsIGhhcyBiZWVuIHN1Y2Nlc3NmdWxseSBwZXJzaXN0ZWQhXG4gICAgICAgICAgICAgICAgY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5TQVZFRDtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXaGVuIHdlJ3JlIGluIHRoZSBwcm9jZXNzIG9mIGRlbGV0aW5nIGEgbW9kZWwsIHRoZSBgY3VycmVudE1vZGVsYCBpcyB1bnNldDsgaW5zdGVhZCB0aGVcbiAgICAgICAgICAgIC8vIGBwcmV2aW91c01vZGVsYCB3aWxsIGJlIGRlZmluZWQuXG4gICAgICAgICAgICBpZiAoKGN1cnJlbnRNb2RlbCA9PT0gbnVsbCAmJiBwcmV2aW91c01vZGVsKSAmJiBldmVudE5hbWUgPT09ICdkZWxldGUnKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgZGVsZXRlZCFcbiAgICAgICAgICAgICAgICBwcmV2aW91c01vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ERUxFVEVEO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAocHJvcGVydGllcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgZXZlbnROYW1lICE9PSAncmVhZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzICYmICFwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KENBVFdBTEtfTUVUQV9QUk9QRVJUWSkgJiYgZXZlbnROYW1lID09PSAncmVhZCcpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5jcmVhdGVNb2RlbChwcm9wZXJ0aWVzKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBtb2RlbCB0byByZWZsZWN0IHRoZSBjaGFuZ2VzIG9uIHRoZSBvYmplY3QgdGhhdCBgcmVhZE1vZGVsYCByZXR1cm4uXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgbW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5RW1pdEV2ZW50KCk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlamVjdFByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgcmVqZWN0UHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgcmVqZWN0V2l0aFxuICAgICAgICAgICAgICogQHBhcmFtIGR1cGxpY2F0ZU1vZGVsIHtPYmplY3R9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgcmVqZWN0V2l0aCA9IChkdXBsaWNhdGVNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKGR1cGxpY2F0ZU1vZGVsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChldmVudE5hbWUgPT09ICd1cGRhdGUnICYmIGR1cGxpY2F0ZU1vZGVsLmhhc093blByb3BlcnR5KENBVFdBTEtfTUVUQV9QUk9QRVJUWSkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVzZXIgcGFzc2VkIGluIGEgbW9kZWwgYW5kIHRoZXJlZm9yZSB0aGUgcHJldmlvdXMgc2hvdWxkIGJlIGRlbGV0ZWQsIGJ1dCBvbmx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2hlbiB3ZSdyZSB1cGRhdGluZyFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlbGV0ZU1vZGVsKHByZXZpb3VzTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzTW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLkRFTEVURUQ7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXNlIHRoZSBkdXBsaWNhdGUgbW9kZWwgYXMgdGhlIHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBkdXBsaWNhdGVNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLlNBVkVEO1xuXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5RW1pdEV2ZW50KCk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChwcmV2aW91c01vZGVsID09PSBudWxsICYmIGV2ZW50TmFtZSA9PT0gJ2NyZWF0ZScpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByZXZpb3VzIG1vZGVsIHdhcyBhY3R1YWxseSBOVUxMIGFuZCB0aGVyZWZvcmUgd2UnbGwgZGVsZXRlIGl0LlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlbGV0ZU1vZGVsKGN1cnJlbnRNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuREVMRVRFRDtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFdpdGg7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGN1cnJlbnRNb2RlbCA9PT0gbnVsbCAmJiBldmVudE5hbWUgPT09ICdkZWxldGUnICkge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRGV2ZWxvcGVyIGRvZXNuJ3QgYWN0dWFsbHkgd2FudCB0byBkZWxldGUgdGhlIG1vZGVsLCBhbmQgdGhlcmVmb3JlIHdlIG5lZWQgdG8gcmV2ZXJ0IGl0IHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBtb2RlbCBpdCB3YXMsIGFuZCBzZXQgaXRzIGZsYWcgYmFjayB0byB3aGF0IGl0IHdhcy5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy51cGRhdGVNb2RlbCh7fSwgcHJldmlvdXNNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKChjdXJyZW50TW9kZWwgJiYgcHJldmlvdXNNb2RlbCkgJiYgZXZlbnROYW1lID09PSAndXBkYXRlJykge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQm90aCBvZiB0aGUgY3VycmVudCBhbmQgcHJldmlvdXMgbW9kZWxzIGFyZSB1cGRhdGVkLCBhbmQgdGhlcmVmb3JlIHdlJ2xsIHNpbXBseVxuICAgICAgICAgICAgICAgICAgICAvLyByZXZlcnQgdGhlIGN1cnJlbnQgbW9kZWwgdG8gdGhlIHByZXZpb3VzIG1vZGVsLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0V2l0aDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY29uZGl0aW9uYWxseUVtaXRFdmVudFxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uZGl0aW9uYWxseUVtaXRFdmVudCgpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYXR3YWxrLmV2ZW50cy5yZWZyZXNoID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSdyZSBhbGwgZG9uZSFcbiAgICAgICAgICAgICAgICBjYXR3YWxrLmV2ZW50cy5yZWZyZXNoKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY2xlYW5Nb2RlbFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgY2xlYW5Nb2RlbChtb2RlbCkge1xuXG4gICAgICAgICAgICB2YXIgY2xlYW5lZE1vZGVsID0ge307XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gQ0FUV0FMS19NRVRBX1BST1BFUlRZKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ2F0d2FsayBtZXRhIGRhdGEgc2hvdWxkIG5ldmVyIGJlIHBlcnNpc3RlZCB0byB0aGUgYmFjay1lbmQuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpZiB0aGUgcHJvcGVydHkgaXMgYWN0dWFsbHkgYSByZWxhdGlvbnNoaXAsIHdoaWNoIHdlIG5lZWQgdG8gcmVzb2x2ZSB0b1xuICAgICAgICAgICAgICAgIC8vIGl0cyBwcmltaXRpdmUgdmFsdWUocykuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcEZ1bmN0aW9uID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYW5lZE1vZGVsW3Byb3BlcnR5XSA9IHJlbGF0aW9uc2hpcEZ1bmN0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldICYmIG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ub3JpZ2luYWxWYWx1ZXNbcHJvcGVydHldKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgZGlzY292ZXJlZCBhIHR5cGVjYXN0ZWQgcHJvcGVydHkgdGhhdCBuZWVkcyB0byBiZSByZXZlcnRlZCB0byBpdHMgb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhbHVlIGJlZm9yZSBpbnZva2luZyB0aGUgY2FsbGJhY2suXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5vcmlnaW5hbFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY2xlYW5lZE1vZGVsW3Byb3BlcnR5XSA9IG1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBjbGVhbmVkTW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIEJsdWVwcmludE1vZGVsXG4gICAgICovXG4gICAgY2xhc3MgQmx1ZXByaW50TW9kZWwge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGJsdWVwcmludCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtCbHVlcHJpbnRNb2RlbH1cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKG5hbWUsIGJsdWVwcmludCkge1xuICAgICAgICAgICAgdGhpcy5uYW1lICA9IG5hbWU7XG4gICAgICAgICAgICB0aGlzLm1vZGVsID0gT2JqZWN0LmZyZWV6ZShibHVlcHJpbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnZlbmllbmNlIG1ldGhvZCB0aGF0IHdyYXBzIGBpdGVyYXRlUHJvcGVydGllc2AgYW5kIGBpdGVyYXRlQmx1ZXByaW50YCBpbnRvIGEgb25lLWxpbmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIGl0ZXJhdGVBbGxcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZUFsbChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLml0ZXJhdGVQcm9wZXJ0aWVzKHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXRlcmF0ZUJsdWVwcmludChtb2RlbCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIGl0ZXJhdGluZyBvdmVyIHRoZSBwYXNzZWQgaW4gbW9kZWwgcHJvcGVydGllcyB0byBlbnN1cmUgdGhleSdyZSBpbiB0aGUgYmx1ZXByaW50LFxuICAgICAgICAgKiBhbmQgdHlwZWNhc3RpbmcgdGhlIHByb3BlcnRpZXMgYmFzZWQgb24gdGhlIGRlZmluZSBibHVlcHJpbnQgZm9yIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZVByb3BlcnRpZXNcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZVByb3BlcnRpZXMocHJvcGVydGllcykge1xuXG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB7fTtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMocHJvcGVydGllcykuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgICAgICAgICAgID0gcHJvcGVydGllc1twcm9wZXJ0eV0sXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5ICE9PSBDQVRXQUxLX01FVEFfUFJPUEVSVFkgJiYgdHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ3VuZGVmaW5lZCcpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcm9wZXJ0eSBkb2Vzbid0IGJlbG9uZyBpbiB0aGUgbW9kZWwgYmVjYXVzZSBpdCdzIG5vdCBpbiB0aGUgYmx1ZXByaW50LlxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLnJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydHlIYW5kbGVyLmRlZmluZVJlbGF0aW9uc2hpcCh0aGlzLm5hbWUsIHByb3BlcnR5KSk7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlci5zZXRWYWx1ZXMocHJvcGVydGllc1twcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIG9yaWdpbmFsIHZhbHVlIG9mIHRoZSByZWxhdGlvbnNoaXAgdG8gcmVzb2x2ZSB3aGVuIGNsZWFuaW5nIHRoZSBtb2RlbC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0eUhhbmRsZXIudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFR5cGVjYXN0IHByb3BlcnR5IHRvIHRoZSBkZWZpbmVkIHR5cGUuXG4gICAgICAgICAgICAgICAgICAgIHZhciBvcmlnaW5hbFZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydHlIYW5kbGVyKHZhbHVlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2F0d2Fsay5yZXZlcnRUeXBlY2FzdCAmJiBvcmlnaW5hbFZhbHVlICE9PSB2YWx1ZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSB0aGUgb3JpZ2luYWwgdmFsdWUgc28gdGhhdCB3ZSBjYW4gcmV2ZXJ0IGl0IGZvciB3aGVuIGludm9raW5nIHRoZSBjYWxsYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2l0aCB0aGUgYGNsZWFuTW9kZWxgIG1ldGhvZC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5vcmlnaW5hbFZhbHVlc1twcm9wZXJ0eV0gPSBvcmlnaW5hbFZhbHVlO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSA9IHZhbHVlO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIGl0ZXJhdGluZyBvdmVyIHRoZSBibHVlcHJpbnQgdG8gZGV0ZXJtaW5lIGlmIGFueSBwcm9wZXJ0aWVzIGFyZSBtaXNzaW5nXG4gICAgICAgICAqIGZyb20gdGhlIGN1cnJlbnQgbW9kZWwsIHRoYXQgaGF2ZSBiZWVuIGRlZmluZWQgaW4gdGhlIGJsdWVwcmludCBhbmQgdGhlcmVmb3JlIHNob3VsZCBiZVxuICAgICAgICAgKiBwcmVzZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIGl0ZXJhdGVCbHVlcHJpbnRcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGl0ZXJhdGVCbHVlcHJpbnQobW9kZWwpIHtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXModGhpcy5tb2RlbCkuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1vZGVsW3Byb3BlcnR5XSA9PT0gJ3VuZGVmaW5lZCcpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBFbnN1cmUgdGhhdCBpdCBpcyBkZWZpbmVkLlxuICAgICAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gICAgID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5yZWxhdGlvbnNoaXBIYW5kbGVyKHByb3BlcnR5SGFuZGxlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0eUhhbmRsZXIuZGVmaW5lUmVsYXRpb25zaGlwKHRoaXMubmFtZSwgcHJvcGVydHkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlci5zZXRWYWx1ZXMoW10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMubW9kZWxbcHJvcGVydHldID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpZiB0aGUgcHJvcGVydHkgaGFzIGEgcHJvcGVydHkgaGFuZGxlciBtZXRob2Qgd2hpY2ggd291bGQgYmUgcmVzcG9uc2libGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZvciB0eXBlY2FzdGluZywgYW5kIGRldGVybWluaW5nIHRoZSBkZWZhdWx0IHZhbHVlLlxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gcHJvcGVydHlIYW5kbGVyKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIHJlaXRlcmF0aW5nIG92ZXIgdGhlIG1vZGVsIHRvIG9uY2UgYWdhaW4gdHlwZWNhc3QgdGhlIHZhbHVlczsgd2hpY2ggaXNcbiAgICAgICAgICogZXNwZWNpYWxseSB1c2VmdWwgZm9yIHdoZW4gdGhlIG1vZGVsIGhhcyBiZWVuIHVwZGF0ZWQsIGJ1dCByZWxhdGlvbnNoaXBzIG5lZWQgdG8gYmUgbGVmdFxuICAgICAgICAgKiBhbG9uZS4gU2luY2UgdGhlIG1vZGVsIGlzIHNlYWxlZCB3ZSBjYW4gYWxzbyBndWFyYW50ZWUgdGhhdCBubyBvdGhlciBwcm9wZXJ0aWVzIGhhdmUgYmVlblxuICAgICAgICAgKiBhZGRlZCBpbnRvIHRoZSBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCByZWl0ZXJhdGVQcm9wZXJ0aWVzXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZWl0ZXJhdGVQcm9wZXJ0aWVzKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eUhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gcHJvcGVydHlIYW5kbGVyKG1vZGVsW3Byb3BlcnR5XSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIGluc3RhbnRpYXRpbmcgYSBuZXcgcmVsYXRpb25zaGlwIHBlciBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCByZWxhdGlvbnNoaXBIYW5kbGVyXG4gICAgICAgICAqIEB0aHJvd3MgRXhjZXB0aW9uXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eUhhbmRsZXIge1JlbGF0aW9uc2hpcEFic3RyYWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBBYnN0cmFjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKSB7XG5cbiAgICAgICAgICAgIHZhciBpbnN0YW50aWF0ZVByb3BlcnRpZXMgPSBbcHJvcGVydHlIYW5kbGVyLnRhcmdldC5rZXksIHByb3BlcnR5SGFuZGxlci50YXJnZXQuY29sbGVjdGlvbl07XG5cbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNNYW55KC4uLmluc3RhbnRpYXRlUHJvcGVydGllcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNPbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc09uZSguLi5pbnN0YW50aWF0ZVByb3BlcnRpZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTaG91bGQgYmUgdW5yZWFjaGFibGUuLi5cbiAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oJ0ludmFsaWQgcmVsYXRpb25zaGlwIHR5cGUnKTtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgVHlwZWNhc3RcbiAgICAgKi9cbiAgICBjbGFzcyBUeXBlY2FzdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmV0dXJuVmFsdWVcbiAgICAgICAgICogQHBhcmFtIHR5cGVjYXN0Q29uc3RydWN0b3Ige0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcGFyYW0gdmFsdWUgeyp9XG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUgeyp9XG4gICAgICAgICAqIEByZXR1cm4geyp9XG4gICAgICAgICAqL1xuICAgICAgICByZXR1cm5WYWx1ZSh0eXBlY2FzdENvbnN0cnVjdG9yLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZWNhc3RDb25zdHJ1Y3Rvcih0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnID8gdmFsdWUgOiBkZWZhdWx0VmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc3RyaW5nXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBzdHJpbmcoZGVmYXVsdFZhbHVlID0gJycpIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKFN0cmluZywgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBib29sZWFuXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge0Jvb2xlYW59XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgYm9vbGVhbihkZWZhdWx0VmFsdWUgPSB0cnVlKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShCb29sZWFuLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIG51bWJlclxuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHtOdW1iZXJ9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgbnVtYmVyKGRlZmF1bHRWYWx1ZSA9IDApIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKE51bWJlciwgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhcnJheVxuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHtBcnJheX1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBhcnJheShkZWZhdWx0VmFsdWUgPSBbXSkge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoQXJyYXksIHZhbHVlLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIG1ldGhvZCBhdXRvSW5jcmVtZW50XG4gICAgICAgICAqIEBwYXJhbSBpbml0aWFsVmFsdWUge051bWJlcn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBhdXRvSW5jcmVtZW50KGluaXRpYWxWYWx1ZSA9IDEpIHtcblxuICAgICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKGluaXRpYWxWYWx1ZSsrKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGN1c3RvbVxuICAgICAgICAgKiBAcGFyYW0gdHlwZWNhc3RGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY3VzdG9tKHR5cGVjYXN0Rm4pIHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlY2FzdEZuO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwXG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBoYXNPbmVcbiAgICAgICAgICogQHBhcmFtIGZvcmVpZ25LZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge1JlbGF0aW9uc2hpcEhhc09uZX1cbiAgICAgICAgICovXG4gICAgICAgIGhhc09uZShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNPbmUoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaGFzTWFueVxuICAgICAgICAgKiBAcGFyYW0gZm9yZWlnbktleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7UmVsYXRpb25zaGlwSGFzTWFueX1cbiAgICAgICAgICovXG4gICAgICAgIGhhc01hbnkoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUmVsYXRpb25zaGlwSGFzTWFueShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBBYnN0cmFjdFxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcEFic3RyYWN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEBwYXJhbSBmb3JlaWduS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpIHtcblxuICAgICAgICAgICAgdGhpcy50YXJnZXQgPSB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAga2V5OiBmb3JlaWduS2V5XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzZXRWYWx1ZXNcbiAgICAgICAgICogQHBhcmFtIHZhbHVlcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0VmFsdWVzKHZhbHVlcykge1xuICAgICAgICAgICAgdGhpcy52YWx1ZXMgPSB0aGlzLnZhbHVlID0gdmFsdWVzO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVmaW5lUmVsYXRpb25zaGlwXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGFjY2Vzc29yRnVuY3Rpb25zIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSwgYWNjZXNzb3JGdW5jdGlvbnMpIHtcblxuICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAga2V5OiBsb2NhbEtleVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGFjY2Vzc29yRnVuY3Rpb25zLmdldCxcbiAgICAgICAgICAgICAgICBzZXQ6IGFjY2Vzc29yRnVuY3Rpb25zLnNldCxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFzc2VydEZvcmVpZ25Qcm9wZXJ0eUV4aXN0c1xuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBhc3NlcnRGb3JlaWduUHJvcGVydHlFeGlzdHMoY29sbGVjdGlvbiwgbG9jYWxLZXkpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2xsZWN0aW9uLmJsdWVwcmludC5tb2RlbFtsb2NhbEtleV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbihgVW5hYmxlIHRvIGZpbmQgcHJvcGVydHkgXCIke2xvY2FsS2V5fVwiIGluIGNvbGxlY3Rpb24gXCIke2NvbGxlY3Rpb24ubmFtZX1cImApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBIYXNNYW55XG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwSGFzTWFueSBleHRlbmRzIFJlbGF0aW9uc2hpcEFic3RyYWN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5KSB7XG5cbiAgICAgICAgICAgIHJldHVybiBzdXBlci5kZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCB7XG4gICAgICAgICAgICAgICAgZ2V0OiB0aGlzLmdldE1vZGVscy5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgICAgIHNldDogdGhpcy5zZXRNb2RlbHMuYmluZCh0aGlzKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGdldE1vZGVsc1xuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGdldE1vZGVscygpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIGxvYWRNb2RlbHNcbiAgICAgICAgICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgbG9hZE1vZGVscyA9ICgpID0+IHtcblxuICAgICAgICAgICAgICAgIHJldHVybiBmb3JlaWduQ29sbGVjdGlvbi5tb2RlbHMuZmlsdGVyKChmb3JlaWduTW9kZWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWVzLmluZGV4T2YoZm9yZWlnbk1vZGVsW3RoaXMudGFyZ2V0LmtleV0pICE9PSAtMTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIGFycmF5RGlmZlxuICAgICAgICAgICAgICogQHBhcmFtIGZpcnN0QXJyYXkge0FycmF5fVxuICAgICAgICAgICAgICogQHBhcmFtIHNlY29uZEFycmF5IHtBcnJheX1cbiAgICAgICAgICAgICAqIEByZXR1cm4geyp9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBhcnJheURpZmYgPSAoZmlyc3RBcnJheSwgc2Vjb25kQXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlyc3RBcnJheS5maWx0ZXIoKGluZGV4KSA9PiBzZWNvbmRBcnJheS5pbmRleE9mKGluZGV4KSA8IDApXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgZm9yZWlnbkNvbGxlY3Rpb24gPSBjYXR3YWxrLmNvbGxlY3Rpb24odGhpcy50YXJnZXQuY29sbGVjdGlvbiksXG4gICAgICAgICAgICAgICAgbW9kZWxzICAgICAgICAgICAgPSBsb2FkTW9kZWxzKCk7XG5cbiAgICAgICAgICAgIC8vIEFzc2VydCB0aGF0IHRoZSBmb3JlaWduIHByb3BlcnR5IGV4aXN0cyBpbiB0aGUgY29sbGVjdGlvbi5cbiAgICAgICAgICAgIHRoaXMuYXNzZXJ0Rm9yZWlnblByb3BlcnR5RXhpc3RzKGZvcmVpZ25Db2xsZWN0aW9uLCB0aGlzLnRhcmdldC5rZXkpO1xuXG4gICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBhIGRpc2NyZXBhbmN5IGJldHdlZW4gdGhlIGNvdW50cywgdGhlbiB3ZSBrbm93IGFsbCB0aGUgbW9kZWxzIGhhdmVuJ3QgYmVlbiBsb2FkZWQuXG4gICAgICAgICAgICBpZiAobW9kZWxzLmxlbmd0aCAhPT0gdGhpcy52YWx1ZXMubGVuZ3RoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBEaXNjb3ZlciB0aGUga2V5cyB0aGF0IGFyZSBjdXJyZW50bHkgbm90IGxvYWRlZC5cbiAgICAgICAgICAgICAgICB2YXIgbG9hZGVkS2V5cyAgID0gbW9kZWxzLm1hcChtb2RlbCA9PiBtb2RlbFt0aGlzLnRhcmdldC5rZXldKSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRLZXlzID0gYXJyYXlEaWZmKHRoaXMudmFsdWVzLCBsb2FkZWRLZXlzKTtcblxuICAgICAgICAgICAgICAgIHJlcXVpcmVkS2V5cy5mb3JFYWNoKChmb3JlaWduS2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcXVpcmVkTW9kZWwgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRNb2RlbFt0aGlzLnRhcmdldC5rZXldID0gZm9yZWlnbktleTtcbiAgICAgICAgICAgICAgICAgICAgZm9yZWlnbkNvbGxlY3Rpb24ucmVhZE1vZGVsKHJlcXVpcmVkTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBBdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVscyBhZ2FpbiBpbW1lZGlhdGVseS5cbiAgICAgICAgICAgICAgICBtb2RlbHMgPSBsb2FkTW9kZWxzKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVscztcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2V0TW9kZWxzXG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRNb2RlbHModmFsdWVzKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEhhc09uZVxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcEhhc09uZSBleHRlbmRzIFJlbGF0aW9uc2hpcEFic3RyYWN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5KSB7XG5cbiAgICAgICAgICAgIHJldHVybiBzdXBlci5kZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCB7XG4gICAgICAgICAgICAgICAgZ2V0OiB0aGlzLmdldE1vZGVsLmJpbmQodGhpcyksXG4gICAgICAgICAgICAgICAgc2V0OiB0aGlzLnNldE1vZGVsLmJpbmQodGhpcylcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBnZXRNb2RlbFxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBnZXRNb2RlbCgpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIGxvYWRNb2RlbFxuICAgICAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgbG9hZE1vZGVsID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBmb3JlaWduQ29sbGVjdGlvbi5tb2RlbHMuZmluZCgoZm9yZWlnbk1vZGVsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlID09PSBmb3JlaWduTW9kZWxbdGhpcy50YXJnZXQua2V5XTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBmb3JlaWduQ29sbGVjdGlvbiA9IGNhdHdhbGsuY29sbGVjdGlvbih0aGlzLnRhcmdldC5jb2xsZWN0aW9uKSxcbiAgICAgICAgICAgICAgICBtb2RlbCAgICAgICAgICAgICA9IGxvYWRNb2RlbCgpO1xuXG4gICAgICAgICAgICAvLyBBc3NlcnQgdGhhdCB0aGUgZm9yZWlnbiBwcm9wZXJ0eSBleGlzdHMgaW4gdGhlIGNvbGxlY3Rpb24uXG4gICAgICAgICAgICB0aGlzLmFzc2VydEZvcmVpZ25Qcm9wZXJ0eUV4aXN0cyhmb3JlaWduQ29sbGVjdGlvbiwgdGhpcy50YXJnZXQua2V5KTtcblxuICAgICAgICAgICAgaWYgKCFtb2RlbCkge1xuXG4gICAgICAgICAgICAgICAgLy8gTW9kZWwgY2Fubm90IGJlIGZvdW5kIGFuZCB0aGVyZWZvcmUgd2UnbGwgYXR0ZW1wdCB0byByZWFkIHRoZSBtb2RlbCBpbnRvIHRoZSBjb2xsZWN0aW9uLlxuICAgICAgICAgICAgICAgIHZhciByZXF1aXJlZE1vZGVsICAgPSB7fTtcbiAgICAgICAgICAgICAgICByZXF1aXJlZE1vZGVsW3RoaXMudGFyZ2V0LmtleV0gPSB0aGlzLnZhbHVlO1xuICAgICAgICAgICAgICAgIGZvcmVpZ25Db2xsZWN0aW9uLnJlYWRNb2RlbChyZXF1aXJlZE1vZGVsKTtcblxuICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVhZCB0aGUgbW9kZWwgYWdhaW4gaW1tZWRpYXRlbHkuXG4gICAgICAgICAgICAgICAgbW9kZWwgPSBsb2FkTW9kZWwoKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNldE1vZGVsXG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRNb2RlbCh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgVHJhbnNhY3Rpb25cbiAgICAgKi9cbiAgICBjbGFzcyBUcmFuc2FjdGlvbiB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcmV0dXJuIHtUcmFuc2FjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVscyAgICA9IFtdO1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlRm4gPSAoKSA9PiB7fTtcblxuICAgICAgICAgICAgLy8gRmx1c2ggdGhlIHByb21pc2VzIGluIHRoZSBzdWJzZXF1ZW50IHJ1bi1sb29wLlxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmZsdXNoKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYWRkXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJvbWlzZSB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkKG1vZGVsLCBwcm9taXNlKSB7XG4gICAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKHsgbW9kZWw6IG1vZGVsLCBwcm9taXNlOiBwcm9taXNlIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVzb2x2ZVxuICAgICAgICAgKiBAcGFyYW0gcmVzb2x2ZUZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHJlc29sdmUocmVzb2x2ZUZuKSB7XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVGbiA9IHJlc29sdmVGbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGZsdXNoXG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBmbHVzaCgpIHtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZUZuKHRoaXMubW9kZWxzKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy8gSW5zdGFudGlhdGUgdGhlIENhdHdhbGsgY2xhc3MuXG4gICAgJHdpbmRvdy5jYXR3YWxrICAgICAgICA9IG5ldyBDYXR3YWxrKCk7XG4gICAgJHdpbmRvdy5jYXR3YWxrLk1FVEEgICA9IENBVFdBTEtfTUVUQV9QUk9QRVJUWTtcbiAgICAkd2luZG93LmNhdHdhbGsuU1RBVEVTID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUztcblxufSkod2luZG93KTsiLCJ2YXIgJF9fcGxhY2Vob2xkZXJfXzAgPSAkX19wbGFjZWhvbGRlcl9fMSIsIigkdHJhY2V1clJ1bnRpbWUuY3JlYXRlQ2xhc3MpKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIpIiwiJHRyYWNldXJSdW50aW1lLnNwcmVhZCgkX19wbGFjZWhvbGRlcl9fMCkiLCIkdHJhY2V1clJ1bnRpbWUuZGVmYXVsdFN1cGVyQ2FsbCh0aGlzLFxuICAgICAgICAgICAgICAgICRfX3BsYWNlaG9sZGVyX18wLnByb3RvdHlwZSwgYXJndW1lbnRzKSIsInZhciAkX19wbGFjZWhvbGRlcl9fMCA9ICRfX3BsYWNlaG9sZGVyX18xIiwiKCR0cmFjZXVyUnVudGltZS5jcmVhdGVDbGFzcykoJF9fcGxhY2Vob2xkZXJfXzAsICRfX3BsYWNlaG9sZGVyX18xLCAkX19wbGFjZWhvbGRlcl9fMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRfX3BsYWNlaG9sZGVyX18zKSIsIiR0cmFjZXVyUnVudGltZS5zdXBlckNhbGwoJF9fcGxhY2Vob2xkZXJfXzAsICRfX3BsYWNlaG9sZGVyX18xLCAkX19wbGFjZWhvbGRlcl9fMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJF9fcGxhY2Vob2xkZXJfXzMpIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9