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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNhdHdhbGsuanMiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMSIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci8yIiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzciLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvNCIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci82IiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzUiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFLQTtBQUFBLEFBQUMsUUFBUyxLQUFHLENBQUUsT0FBTTtBQUVqQixhQUFXLENBQUM7SUFNTixDQUFBLHFCQUFvQixFQUFJLFlBQVU7SUFNbEMsQ0FBQSx5QkFBd0IsRUFBSTtBQUFFLE1BQUUsQ0FBRyxFQUFBO0FBQUcsUUFBSSxDQUFHLEVBQUE7QUFBRyxRQUFJLENBQUcsRUFBQTtBQUFHLFVBQU0sQ0FBRyxFQUFBO0FBQUEsRUFBRTtBQ25CL0UsQUFBSSxJQUFBLFVEd0JBLFNBQU0sUUFBTSxDQU1HLEFBQUMsQ0FBRTtBQUNWLE9BQUcsT0FBTyxFQUFZLEdBQUMsQ0FBQztBQUN4QixPQUFHLFlBQVksRUFBTyxHQUFDLENBQUM7QUFDeEIsT0FBRyxhQUFhLEVBQU0sSUFBSSxhQUFXLEFBQUMsRUFBQyxDQUFDO0FBQ3hDLE9BQUcsU0FBUyxFQUFVLElBQUksU0FBTyxBQUFDLEVBQUMsQ0FBQztBQUNwQyxPQUFHLGVBQWUsRUFBSSxLQUFHLENBQUM7RUNuQ0UsQURvQ2hDLENDcENnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUY0Q3JCLG1CQUFlLENBQWYsVUFBaUIsSUFBRyxBQUFpQixDQUFHO1FBQWpCLFdBQVMsNkNBQUksR0FBQztBQUVqQyxTQUFHLEVBQUksQ0FBQSxNQUFLLEFBQUMsQ0FBQyxJ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d0NvQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUY0dUNyQixNQUFFLENBQUYsVUFBSSxLQUFJLENBQUcsQ0FBQSxPQUFNLENBQUc7QUFDaEIsU0FBRyxPQUFPLEtBQUssQUFBQyxDQUFDO0FBQUUsWUFBSSxDQUFHLE1BQUk7QUFBRyxjQUFNLENBQUcsUUFBTTtBQUFBLE1BQUUsQ0FBQyxDQUFDO0lBQ3hEO0FBT0EsVUFBTSxDQUFOLFVBQVEsU0FBUSxDQUFHO0FBQ2YsU0FBRyxVQUFVLEVBQUksVUFBUSxDQUFDO0lBQzlCO0FBTUEsUUFBSSxDQUFKLFVBQUssQUFBQyxDQUFFO0FBQ0osU0FBRyxVQUFVLEFBQUMsQ0FBQyxJQUFHLE9BQU8sQ0FBQyxDQUFDO0lBQy9CO0FBQUEsT0UvdkM2RTtBRm93Q2pGLFFBQU0sUUFBUSxFQUFXLElBQUksUUFBTSxBQUFDLEVBQUMsQ0FBQztBQUN0QyxRQUFNLFFBQVEsS0FBSyxFQUFNLHNCQUFvQixDQUFDO0FBQzlDLFFBQU0sUUFBUSxPQUFPLEVBQUksMEJBQXdCLENBQUM7QUFFdEQsQ0FBQyxBQUFDLENBQUMsTUFBSyxDQUFDLENBQUM7QUFBQSIsImZpbGUiOiJjYXR3YWxrLmVzNS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQG1vZHVsZSBDYXR3YWxrXG4gKiBAYXV0aG9yIEFkYW0gVGltYmVybGFrZVxuICogQGxpbmsgaHR0cHM6Ly9naXRodWIuY29tL1dpbGRob25leS9DYXR3YWxrLmpzXG4gKi9cbihmdW5jdGlvbiBtYWluKCR3aW5kb3cpIHtcblxuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLyoqXG4gICAgICogQGNvbnN0YW50IENBVFdBTEtfTUVUQV9QUk9QRVJUWVxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgY29uc3QgQ0FUV0FMS19NRVRBX1BST1BFUlRZID0gJ19fY2F0d2Fsayc7XG5cbiAgICAvKipcbiAgICAgKiBAY29uc3RhbnQgQ0FUV0FMS19TVEFURV9QUk9QRVJUSUVTXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICBjb25zdCBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTID0geyBORVc6IDEsIERJUlRZOiAyLCBTQVZFRDogNCwgREVMRVRFRDogOCB9O1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIENhdHdhbGtcbiAgICAgKi9cbiAgICBjbGFzcyBDYXR3YWxrIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEByZXR1cm4ge0NhdHdhbGt9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzICAgICAgICAgPSB7fTtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbnMgICAgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwICAgPSBuZXcgUmVsYXRpb25zaGlwKCk7XG4gICAgICAgICAgICB0aGlzLnR5cGVjYXN0ICAgICAgID0gbmV3IFR5cGVjYXN0KCk7XG4gICAgICAgICAgICB0aGlzLnJldmVydFR5cGVjYXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNyZWF0ZUNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIFtwcm9wZXJ0aWVzPXt9XSB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlQ29sbGVjdGlvbihuYW1lLCBwcm9wZXJ0aWVzID0ge30pIHtcblxuICAgICAgICAgICAgbmFtZSA9IFN0cmluZyhuYW1lKTtcblxuICAgICAgICAgICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50aHJvd0V4Y2VwdGlvbignQ29sbGVjdGlvbiBtdXN0IGhhdmUgYW4gYXNzb2NpYXRlZCBuYW1lJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRocm93RXhjZXB0aW9uKGBDb2xsZWN0aW9uIFwiJHtuYW1lfVwiIG11c3QgZGVmaW5lIGl0cyBibHVlcHJpbnRgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBuZXcgQ29sbGVjdGlvbihuYW1lLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbnNbbmFtZV0gPSBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb247XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlbGV0ZUNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGRlbGV0ZUNvbGxlY3Rpb24obmFtZSkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5jb2xsZWN0aW9uc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbGxlY3Rpb25zW25hbWVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjb2xsZWN0aW9uKG5hbWUpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNvbGxlY3Rpb25zW25hbWVdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHRoaXMudGhyb3dFeGNlcHRpb24oYFVuYWJsZSB0byBmaW5kIGNvbGxlY3Rpb24gXCIke25hbWV9XCJgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbnNbbmFtZV07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNyZWF0ZVRyYW5zYWN0aW9uXG4gICAgICAgICAqIEByZXR1cm4ge1RyYW5zYWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlVHJhbnNhY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRyYW5zYWN0aW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXZlcnRDYWxsYmFja1R5cGVjYXN0XG4gICAgICAgICAqIEBwYXJhbSBzZXR0aW5nIHtCb29sZWFufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgcmV2ZXJ0Q2FsbGJhY2tUeXBlY2FzdChzZXR0aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnJldmVydFR5cGVjYXN0ID0gISFzZXR0aW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgdGhyb3dFeGNlcHRpb25cbiAgICAgICAgICogQHRocm93cyBFeGNlcHRpb25cbiAgICAgICAgICogQHBhcmFtIG1lc3NhZ2Uge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHRocm93RXhjZXB0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHRocm93IGBDYXR3YWxrOiAke21lc3NhZ2V9LmA7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnRGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBvbihuYW1lLCBldmVudEZuKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50c1tuYW1lXSA9IGV2ZW50Rm47XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBvZmZcbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIG9mZihuYW1lKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudHNbbmFtZV07XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgY2xhc3MgQ29sbGVjdGlvbiB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IobmFtZSwgcHJvcGVydGllcykge1xuICAgICAgICAgICAgdGhpcy5pZCAgICAgICAgPSAwO1xuICAgICAgICAgICAgdGhpcy5uYW1lICAgICAgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tb2RlbHMgICAgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuc2lsZW50ICAgID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmJsdWVwcmludCA9IG5ldyBCbHVlcHJpbnRNb2RlbChuYW1lLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNpbGVudGx5XG4gICAgICAgICAqIEBwYXJhbSBzaWxlbnRGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzaWxlbnRseShzaWxlbnRGbikge1xuXG4gICAgICAgICAgICB2YXIgc2lsZW50QmVmb3JlID0gdGhpcy5zaWxlbnQ7XG4gICAgICAgICAgICB0aGlzLnNpbGVudCAgICAgID0gdHJ1ZTtcbiAgICAgICAgICAgIHNpbGVudEZuLmFwcGx5KHRoaXMpO1xuXG4gICAgICAgICAgICBpZiAoIXNpbGVudEJlZm9yZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gT25seSByZW1vdmUgdGhlIHNpbGVuY2UgaWYgaXQgd2Fzbid0IHNpbGVudCBiZWZvcmUsIHdoaWNoIHByZXZlbnRzIGFnYWluc3RcbiAgICAgICAgICAgICAgICAvLyBuZXN0aW5nIHRoZSBgc2lsZW50bHlgIG1ldGhvZHMgaW5zaWRlIG9uZSBhbm90aGVyLlxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50ID0gZmFsc2U7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnZlcnRzIGVhY2ggbm9uLWV4dGVuc2libGUgbW9kZWwgaW50byBhbiBleHRlbnNpYmxlIG1vZGVsLCB3aGljaCBpcyB1c2VmdWwgZm9yIEphdmFTY3JpcHQgZnJhbWV3b3Jrc1xuICAgICAgICAgKiBzdWNoIGFzIEFuZ3VsYXIuanMgd2hpY2ggaW5zaXN0IG9uIGluamVjdGluZyAkJGhhc2hLZXkgaW50byBlYWNoIG9iamVjdC4gUGZmdCFcbiAgICAgICAgICpcbiAgICAgICAgICogVG9kbzogVXNlIGEgZ2VuZXJhdG9yIGluc3RlYWQgb2YgYSBzaW1wbGUgcmV0dXJuIHN0YXRlbWVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBleHRlbnNpYmxlSXRlcmF0aW9uXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgZXh0ZW5zaWJsZUl0ZXJhdGlvbigpIHtcblxuICAgICAgICAgICAgdmFyIGV4dGVuc2libGVNb2RlbHMgPSBbXTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIG1ha2VFeHRlbnNpYmxlXG4gICAgICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIG1ha2VFeHRlbnNpYmxlID0gKG1vZGVsKSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0ZW5zaWJsZU1vZGVsID0ge307XG5cbiAgICAgICAgICAgICAgICAvLyBDb3B5IGFjcm9zcyB0aGUgbW9kZWwgaW50byBhbiBleHRlbnNpYmxlIG9iamVjdC5cbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbCkuZm9yRWFjaChrZXkgPT4gZXh0ZW5zaWJsZU1vZGVsW2tleV0gPSBtb2RlbFtrZXldKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBleHRlbnNpYmxlTW9kZWw7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWxzLmZvckVhY2gobW9kZWwgPT4gZXh0ZW5zaWJsZU1vZGVscy5wdXNoKG1ha2VFeHRlbnNpYmxlKG1vZGVsKSkpO1xuXG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5zaWJsZU1vZGVscztcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYWRkTW9kZWxcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkTW9kZWwocHJvcGVydGllcyA9IHt9KSB7XG5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwocHJvcGVydGllcyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNpbGVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFkZE1vZGVsc1xuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllc0xpc3Qge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBhZGRNb2RlbHMocHJvcGVydGllc0xpc3QgPSBbXSkge1xuXG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJvcGVydGllc0xpc3QpKSB7XG4gICAgICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignQXJndW1lbnQgZm9yIGBhZGRNb2RlbHNgIG11c3QgYmUgYW4gYXJyYXkgb2YgcHJvcGVydGllcycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgbW9kZWxzID0gW107XG5cbiAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoZnVuY3Rpb24gc2lsZW50bHkoKSB7XG5cbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzTGlzdC5mb3JFYWNoKChwcm9wZXJ0aWVzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVscy5wdXNoKHRoaXMuYWRkTW9kZWwocHJvcGVydGllcykpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5RW1pdEV2ZW50KCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWxzO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gW3Byb3BlcnRpZXM9e31dIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZU1vZGVsKHByb3BlcnRpZXMgPSB7fSkge1xuXG4gICAgICAgICAgICB0aGlzLmluamVjdE1ldGEocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgbW9kZWwgY29uZm9ybXMgdG8gdGhlIGJsdWVwcmludC5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuYmx1ZXByaW50Lml0ZXJhdGVBbGwocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgIE9iamVjdC5zZWFsKG1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2NyZWF0ZScsIG1vZGVsLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVhZE1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlYWRNb2RlbChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB0aGlzLmlzc3VlUHJvbWlzZSgncmVhZCcsIHByb3BlcnRpZXMsIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIHByb3BlcnRpZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCB1cGRhdGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlTW9kZWwobW9kZWwsIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgY29weSBvZiB0aGUgb2xkIG1vZGVsIGZvciByb2xsaW5nIGJhY2suXG4gICAgICAgICAgICB2YXIgcHJldmlvdXNNb2RlbCA9IHt9O1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4gcHJldmlvdXNNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtwcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICB0cnkge1xuXG4gICAgICAgICAgICAgICAgLy8gQ29weSBhY3Jvc3MgdGhlIGRhdGEgZnJvbSB0aGUgcHJvcGVydGllcy4gV2Ugd3JhcCB0aGUgYXNzaWdubWVudCBpbiBhIHRyeS1jYXRjaCBibG9ja1xuICAgICAgICAgICAgICAgIC8vIGJlY2F1c2UgaWYgdGhlIHVzZXIgaGFzIGFkZGVkIGFueSBhZGRpdGlvbmFsIHByb3BlcnRpZXMgdGhhdCBkb24ndCBiZWxvbmcgaW4gdGhlIG1vZGVsLFxuICAgICAgICAgICAgICAgIC8vIGFuIGV4Y2VwdGlvbiB3aWxsIGJlIHJhaXNlZCBiZWNhdXNlIHRoZSBvYmplY3QgaXMgc2VhbGVkLlxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZvckVhY2gocHJvcGVydHkgPT4gbW9kZWxbcHJvcGVydHldID0gcHJvcGVydGllc1twcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXhjZXB0aW9uKSB7fVxuXG4gICAgICAgICAgICAvLyBUeXBlY2FzdCB0aGUgdXBkYXRlZCBtb2RlbCBhbmQgY29weSBhY3Jvc3MgaXRzIHByb3BlcnRpZXMgdG8gdGhlIGN1cnJlbnQgbW9kZWwsIHNvIGFzIHdlXG4gICAgICAgICAgICAvLyBkb24ndCBicmVhayBhbnkgcmVmZXJlbmNlcy5cbiAgICAgICAgICAgIHZhciB0eXBlY2FzdE1vZGVsID0gdGhpcy5ibHVlcHJpbnQucmVpdGVyYXRlUHJvcGVydGllcyhtb2RlbCk7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0eXBlY2FzdE1vZGVsKS5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSB0eXBlY2FzdE1vZGVsW3Byb3BlcnR5XVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ3VwZGF0ZScsIG1vZGVsLCBwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVsZXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlbGV0ZU1vZGVsKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCByZW1vdmVcbiAgICAgICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgICAgICogQHBhcmFtIGluZGV4IHtOdW1iZXJ9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciByZW1vdmUgPSAobW9kZWwsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2RlbGV0ZScsIG51bGwsIG1vZGVsKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIG1vZGVsIHdhcyBzdWNjZXNzZnVsbHkgZGVsZXRlZCB3aXRoIGZpbmRpbmcgdGhlIG1vZGVsIGJ5IHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAcHJvcGVydHkgZGlkRGVsZXRlVmlhUmVmZXJlbmNlXG4gICAgICAgICAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGRpZERlbGV0ZVZpYVJlZmVyZW5jZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgdGhlIG1vZGVsIGJ5IHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSB0aGlzLm1vZGVscy5pbmRleE9mKG1vZGVsKTtcblxuICAgICAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlkRGVsZXRlVmlhUmVmZXJlbmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKHRoaXMubW9kZWxzW2luZGV4XSwgaW5kZXgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSkoKTtcblxuICAgICAgICAgICAgaWYgKCFkaWREZWxldGVWaWFSZWZlcmVuY2UpIHtcblxuICAgICAgICAgICAgICAgICgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gMDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZmluZCB0aGUgbW9kZWwgYnkgaXRzIGludGVybmFsIENhdHdhbGsgSUQuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLmZvckVhY2goKGN1cnJlbnRNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQgPT09IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUoY3VycmVudE1vZGVsLCBpbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYWRkQXNzb2NpYXRpb25cbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7QXJyYXl9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGFkZEFzc29jaWF0aW9uKG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydGllcykge1xuXG4gICAgICAgICAgICBpZiAoISh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNNYW55KSkge1xuICAgICAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oJ1VzaW5nIGBhZGRBc3NvY2lhdGlvbmAgcmVxdWlyZXMgYSBoYXNNYW55IHJlbGF0aW9uc2hpcCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY3VycmVudFByb3BlcnRpZXMgPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0oKTtcbiAgICAgICAgICAgIGN1cnJlbnRQcm9wZXJ0aWVzICAgICA9IGN1cnJlbnRQcm9wZXJ0aWVzLmNvbmNhdChwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIHZhciB1cGRhdGVEYXRhICAgICAgICA9IHt9O1xuICAgICAgICAgICAgdXBkYXRlRGF0YVtwcm9wZXJ0eV0gID0gY3VycmVudFByb3BlcnRpZXM7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51cGRhdGVNb2RlbChtb2RlbCwgdXBkYXRlRGF0YSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlbW92ZUFzc29jaWF0aW9uXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydHkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge0FycmF5fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmVBc3NvY2lhdGlvbihtb2RlbCwgcHJvcGVydHksIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgaWYgKCEodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkpIHtcbiAgICAgICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKCdVc2luZyBgcmVtb3ZlQXNzb2NpYXRpb25gIHJlcXVpcmVzIGEgaGFzTWFueSByZWxhdGlvbnNoaXAnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGN1cnJlbnRQcm9wZXJ0aWVzID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldKCk7XG5cbiAgICAgICAgICAgIHByb3BlcnRpZXMuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBjdXJyZW50UHJvcGVydGllcy5pbmRleE9mKHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICBjdXJyZW50UHJvcGVydGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZhciB1cGRhdGVEYXRhICAgICAgICA9IHt9O1xuICAgICAgICAgICAgdXBkYXRlRGF0YVtwcm9wZXJ0eV0gID0gY3VycmVudFByb3BlcnRpZXM7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51cGRhdGVNb2RlbChtb2RlbCwgdXBkYXRlRGF0YSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGluamVjdE1ldGFcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGluamVjdE1ldGEobW9kZWwpIHtcblxuICAgICAgICAgICAgbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXSA9IHtcbiAgICAgICAgICAgICAgICBpZDogKyt0aGlzLmlkLFxuICAgICAgICAgICAgICAgIHN0YXR1czogQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ORVcsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxWYWx1ZXM6IHt9LFxuICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcFZhbHVlczoge31cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaXNzdWVQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGN1cnJlbnRNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJldmlvdXNNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgaXNzdWVQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNpbGVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYXR3YWxrLmV2ZW50c1tldmVudE5hbWVdICE9PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxsYmFjayBoYXMgbm90IGFjdHVhbGx5IGJlZW4gc2V0LXVwIGFuZCB0aGVyZWZvcmUgbW9kZWxzIHdpbGwgbmV2ZXIgYmVcbiAgICAgICAgICAgICAgICAvLyBwZXJzaXN0ZWQuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIElzc3VlIHRoZSBwcm9taXNlIGZvciBiYWNrLWVuZCBwZXJzaXN0ZW5jZSBvZiB0aGUgbW9kZWwuXG4gICAgICAgICAgICAgICAgY2F0d2Fsay5ldmVudHNbZXZlbnROYW1lXS5jYWxsKHRoaXMsIHRoaXMuY2xlYW5Nb2RlbChjdXJyZW50TW9kZWwgfHwgcHJldmlvdXNNb2RlbCksIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZTogcmVzb2x2ZSwgcmVqZWN0OiByZWplY3RcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSkudGhlbigocmVzb2x1dGlvblBhcmFtcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQhXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzb2x2ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpKHJlc29sdXRpb25QYXJhbXMpO1xuXG4gICAgICAgICAgICAgICAgfSwgKHJlc29sdXRpb25QYXJhbXMpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkIVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlamVjdFByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpKHJlc29sdXRpb25QYXJhbXMpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlc29sdmVQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ30gLSBFdmVudCBuYW1lIGlzIGFjdHVhbGx5IG5vdCByZXF1aXJlZCwgYmVjYXVzZSB3ZSBjYW4gZGVkdWNlIHRoZSBzdWJzZXF1ZW50IGFjdGlvblxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbSB0aGUgc3RhdGUgb2YgdGhlIGBjdXJyZW50TW9kZWxgIGFuZCBgcHJldmlvdXNNb2RlbGAsIGJ1dCB3ZSBhZGQgaXQgdG8gYWRkXG4gICAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFyaWZpY2F0aW9uIHRvIG91ciBsb2dpY2FsIHN0ZXBzLlxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgcmVzb2x2ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgaWYgKGN1cnJlbnRNb2RlbCAmJiBldmVudE5hbWUgPT09ICdjcmVhdGUnKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgcGVyc2lzdGVkIVxuICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuU0FWRUQ7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2hlbiB3ZSdyZSBpbiB0aGUgcHJvY2VzcyBvZiBkZWxldGluZyBhIG1vZGVsLCB0aGUgYGN1cnJlbnRNb2RlbGAgaXMgdW5zZXQ7IGluc3RlYWQgdGhlXG4gICAgICAgICAgICAvLyBgcHJldmlvdXNNb2RlbGAgd2lsbCBiZSBkZWZpbmVkLlxuICAgICAgICAgICAgaWYgKChjdXJyZW50TW9kZWwgPT09IG51bGwgJiYgcHJldmlvdXNNb2RlbCkgJiYgZXZlbnROYW1lID09PSAnZGVsZXRlJykge1xuXG4gICAgICAgICAgICAgICAgLy8gTW9kZWwgaGFzIGJlZW4gc3VjY2Vzc2Z1bGx5IGRlbGV0ZWQhXG4gICAgICAgICAgICAgICAgcHJldmlvdXNNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuREVMRVRFRDtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gKHByb3BlcnRpZXMpID0+IHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzICYmIGV2ZW50TmFtZSAhPT0gJ3JlYWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgcHJvcGVydGllcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydGllcyAmJiAhcHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShDQVRXQUxLX01FVEFfUFJPUEVSVFkpICYmIGV2ZW50TmFtZSA9PT0gJ3JlYWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbW9kZWwgdG8gcmVmbGVjdCB0aGUgY2hhbmdlcyBvbiB0aGUgb2JqZWN0IHRoYXQgYHJlYWRNb2RlbGAgcmV0dXJuLlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIG1vZGVsKTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZWplY3RQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGN1cnJlbnRNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJldmlvdXNNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHJlamVjdFByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIHJlamVjdFdpdGhcbiAgICAgICAgICAgICAqIEBwYXJhbSBkdXBsaWNhdGVNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIHJlamVjdFdpdGggPSAoZHVwbGljYXRlTW9kZWwpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmIChkdXBsaWNhdGVNb2RlbCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnROYW1lID09PSAndXBkYXRlJyAmJiBkdXBsaWNhdGVNb2RlbC5oYXNPd25Qcm9wZXJ0eShDQVRXQUxLX01FVEFfUFJPUEVSVFkpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VyIHBhc3NlZCBpbiBhIG1vZGVsIGFuZCB0aGVyZWZvcmUgdGhlIHByZXZpb3VzIHNob3VsZCBiZSBkZWxldGVkLCBidXQgb25seVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdoZW4gd2UncmUgdXBkYXRpbmchXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxldGVNb2RlbChwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91c01vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ERUxFVEVEO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVzZSB0aGUgZHVwbGljYXRlIG1vZGVsIGFzIHRoZSByZWZlcmVuY2UuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgZHVwbGljYXRlTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5TQVZFRDtcblxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAocHJldmlvdXNNb2RlbCA9PT0gbnVsbCAmJiBldmVudE5hbWUgPT09ICdjcmVhdGUnKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcmV2aW91cyBtb2RlbCB3YXMgYWN0dWFsbHkgTlVMTCBhbmQgdGhlcmVmb3JlIHdlJ2xsIGRlbGV0ZSBpdC5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxldGVNb2RlbChjdXJyZW50TW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLkRFTEVURUQ7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RXaXRoO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjdXJyZW50TW9kZWwgPT09IG51bGwgJiYgZXZlbnROYW1lID09PSAnZGVsZXRlJyApIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIERldmVsb3BlciBkb2Vzbid0IGFjdHVhbGx5IHdhbnQgdG8gZGVsZXRlIHRoZSBtb2RlbCwgYW5kIHRoZXJlZm9yZSB3ZSBuZWVkIHRvIHJldmVydCBpdCB0b1xuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgbW9kZWwgaXQgd2FzLCBhbmQgc2V0IGl0cyBmbGFnIGJhY2sgdG8gd2hhdCBpdCB3YXMuXG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMudXBkYXRlTW9kZWwoe30sIHByZXZpb3VzTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgoY3VycmVudE1vZGVsICYmIHByZXZpb3VzTW9kZWwpICYmIGV2ZW50TmFtZSA9PT0gJ3VwZGF0ZScpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEJvdGggb2YgdGhlIGN1cnJlbnQgYW5kIHByZXZpb3VzIG1vZGVscyBhcmUgdXBkYXRlZCwgYW5kIHRoZXJlZm9yZSB3ZSdsbCBzaW1wbHlcbiAgICAgICAgICAgICAgICAgICAgLy8gcmV2ZXJ0IHRoZSBjdXJyZW50IG1vZGVsIHRvIHRoZSBwcmV2aW91cyBtb2RlbC5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdFdpdGg7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNvbmRpdGlvbmFsbHlFbWl0RXZlbnRcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGNvbmRpdGlvbmFsbHlFbWl0RXZlbnQoKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2F0d2Fsay5ldmVudHMucmVmcmVzaCA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgLy8gV2UncmUgYWxsIGRvbmUhXG4gICAgICAgICAgICAgICAgY2F0d2Fsay5ldmVudHMucmVmcmVzaCgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNsZWFuTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGNsZWFuTW9kZWwobW9kZWwpIHtcblxuICAgICAgICAgICAgdmFyIGNsZWFuZWRNb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbCkuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgPT09IENBVFdBTEtfTUVUQV9QUk9QRVJUWSkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIENhdHdhbGsgbWV0YSBkYXRhIHNob3VsZCBuZXZlciBiZSBwZXJzaXN0ZWQgdG8gdGhlIGJhY2stZW5kLlxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgaWYgdGhlIHByb3BlcnR5IGlzIGFjdHVhbGx5IGEgcmVsYXRpb25zaGlwLCB3aGljaCB3ZSBuZWVkIHRvIHJlc29sdmUgdG9cbiAgICAgICAgICAgICAgICAvLyBpdHMgcHJpbWl0aXZlIHZhbHVlKHMpLlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBGdW5jdGlvbiA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFuZWRNb2RlbFtwcm9wZXJ0eV0gPSByZWxhdGlvbnNoaXBGdW5jdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXSAmJiBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLm9yaWdpbmFsVmFsdWVzW3Byb3BlcnR5XSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIGRpc2NvdmVyZWQgYSB0eXBlY2FzdGVkIHByb3BlcnR5IHRoYXQgbmVlZHMgdG8gYmUgcmV2ZXJ0ZWQgdG8gaXRzIG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB2YWx1ZSBiZWZvcmUgaW52b2tpbmcgdGhlIGNhbGxiYWNrLlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYW5lZE1vZGVsW3Byb3BlcnR5XSA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ub3JpZ2luYWxWYWx1ZXNbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNsZWFuZWRNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gY2xlYW5lZE1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBCbHVlcHJpbnRNb2RlbFxuICAgICAqL1xuICAgIGNsYXNzIEJsdWVwcmludE1vZGVsIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBibHVlcHJpbnQge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7Qmx1ZXByaW50TW9kZWx9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcihuYW1lLCBibHVlcHJpbnQpIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSAgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tb2RlbCA9IE9iamVjdC5mcmVlemUoYmx1ZXByaW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb252ZW5pZW5jZSBtZXRob2QgdGhhdCB3cmFwcyBgaXRlcmF0ZVByb3BlcnRpZXNgIGFuZCBgaXRlcmF0ZUJsdWVwcmludGAgaW50byBhIG9uZS1saW5lci5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBpdGVyYXRlQWxsXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGl0ZXJhdGVBbGwocHJvcGVydGllcykge1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5pdGVyYXRlUHJvcGVydGllcyhwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLml0ZXJhdGVCbHVlcHJpbnQobW9kZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciBpdGVyYXRpbmcgb3ZlciB0aGUgcGFzc2VkIGluIG1vZGVsIHByb3BlcnRpZXMgdG8gZW5zdXJlIHRoZXkncmUgaW4gdGhlIGJsdWVwcmludCxcbiAgICAgICAgICogYW5kIHR5cGVjYXN0aW5nIHRoZSBwcm9wZXJ0aWVzIGJhc2VkIG9uIHRoZSBkZWZpbmUgYmx1ZXByaW50IGZvciB0aGUgY3VycmVudCBjb2xsZWN0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIGl0ZXJhdGVQcm9wZXJ0aWVzXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGl0ZXJhdGVQcm9wZXJ0aWVzKHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgdmFyIG1vZGVsID0ge307XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlICAgICAgICAgICA9IHByb3BlcnRpZXNbcHJvcGVydHldLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSAhPT0gQ0FUV0FMS19NRVRBX1BST1BFUlRZICYmIHR5cGVvZiBwcm9wZXJ0eUhhbmRsZXIgPT09ICd1bmRlZmluZWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUHJvcGVydHkgZG9lc24ndCBiZWxvbmcgaW4gdGhlIG1vZGVsIGJlY2F1c2UgaXQncyBub3QgaW4gdGhlIGJsdWVwcmludC5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5yZWxhdGlvbnNoaXBIYW5kbGVyKHByb3BlcnR5SGFuZGxlcik7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbCwgcHJvcGVydHksIHByb3BlcnR5SGFuZGxlci5kZWZpbmVSZWxhdGlvbnNoaXAodGhpcy5uYW1lLCBwcm9wZXJ0eSkpO1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIuc2V0VmFsdWVzKHByb3BlcnRpZXNbcHJvcGVydHldKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydGllc1tDQVRXQUxLX01FVEFfUFJPUEVSVFldKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBvcmlnaW5hbCB2YWx1ZSBvZiB0aGUgcmVsYXRpb25zaGlwIHRvIHJlc29sdmUgd2hlbiBjbGVhbmluZyB0aGUgbW9kZWwuXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcGVydHlIYW5kbGVyLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eUhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBUeXBlY2FzdCBwcm9wZXJ0eSB0byB0aGUgZGVmaW5lZCB0eXBlLlxuICAgICAgICAgICAgICAgICAgICB2YXIgb3JpZ2luYWxWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHByb3BlcnR5SGFuZGxlcih2YWx1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhdHdhbGsucmV2ZXJ0VHlwZWNhc3QgJiYgb3JpZ2luYWxWYWx1ZSAhPT0gdmFsdWUpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIG9yaWdpbmFsIHZhbHVlIHNvIHRoYXQgd2UgY2FuIHJldmVydCBpdCBmb3Igd2hlbiBpbnZva2luZyB0aGUgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdpdGggdGhlIGBjbGVhbk1vZGVsYCBtZXRob2QuXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ub3JpZ2luYWxWYWx1ZXNbcHJvcGVydHldID0gb3JpZ2luYWxWYWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSB2YWx1ZTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciBpdGVyYXRpbmcgb3ZlciB0aGUgYmx1ZXByaW50IHRvIGRldGVybWluZSBpZiBhbnkgcHJvcGVydGllcyBhcmUgbWlzc2luZ1xuICAgICAgICAgKiBmcm9tIHRoZSBjdXJyZW50IG1vZGVsLCB0aGF0IGhhdmUgYmVlbiBkZWZpbmVkIGluIHRoZSBibHVlcHJpbnQgYW5kIHRoZXJlZm9yZSBzaG91bGQgYmVcbiAgICAgICAgICogcHJlc2VudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBpdGVyYXRlQmx1ZXByaW50XG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlQmx1ZXByaW50KG1vZGVsKSB7XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHRoaXMubW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtb2RlbFtwcm9wZXJ0eV0gPT09ICd1bmRlZmluZWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRW5zdXJlIHRoYXQgaXQgaXMgZGVmaW5lZC5cbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldICAgICA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMucmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydHlIYW5kbGVyLmRlZmluZVJlbGF0aW9uc2hpcCh0aGlzLm5hbWUsIHByb3BlcnR5KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIuc2V0VmFsdWVzKFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm1vZGVsW3Byb3BlcnR5XSA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgaWYgdGhlIHByb3BlcnR5IGhhcyBhIHByb3BlcnR5IGhhbmRsZXIgbWV0aG9kIHdoaWNoIHdvdWxkIGJlIHJlc3BvbnNpYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgdHlwZWNhc3RpbmcsIGFuZCBkZXRlcm1pbmluZyB0aGUgZGVmYXVsdCB2YWx1ZS5cbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSA9IHByb3BlcnR5SGFuZGxlcigpO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciByZWl0ZXJhdGluZyBvdmVyIHRoZSBtb2RlbCB0byBvbmNlIGFnYWluIHR5cGVjYXN0IHRoZSB2YWx1ZXM7IHdoaWNoIGlzXG4gICAgICAgICAqIGVzcGVjaWFsbHkgdXNlZnVsIGZvciB3aGVuIHRoZSBtb2RlbCBoYXMgYmVlbiB1cGRhdGVkLCBidXQgcmVsYXRpb25zaGlwcyBuZWVkIHRvIGJlIGxlZnRcbiAgICAgICAgICogYWxvbmUuIFNpbmNlIHRoZSBtb2RlbCBpcyBzZWFsZWQgd2UgY2FuIGFsc28gZ3VhcmFudGVlIHRoYXQgbm8gb3RoZXIgcHJvcGVydGllcyBoYXZlIGJlZW5cbiAgICAgICAgICogYWRkZWQgaW50byB0aGUgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgcmVpdGVyYXRlUHJvcGVydGllc1xuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgcmVpdGVyYXRlUHJvcGVydGllcyhtb2RlbCkge1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbCkuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcblxuICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcHJvcGVydHlIYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSA9IHByb3BlcnR5SGFuZGxlcihtb2RlbFtwcm9wZXJ0eV0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciBpbnN0YW50aWF0aW5nIGEgbmV3IHJlbGF0aW9uc2hpcCBwZXIgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgcmVsYXRpb25zaGlwSGFuZGxlclxuICAgICAgICAgKiBAdGhyb3dzIEV4Y2VwdGlvblxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydHlIYW5kbGVyIHtSZWxhdGlvbnNoaXBBYnN0cmFjdH1cbiAgICAgICAgICogQHJldHVybiB7UmVsYXRpb25zaGlwQWJzdHJhY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZWxhdGlvbnNoaXBIYW5kbGVyKHByb3BlcnR5SGFuZGxlcikge1xuXG4gICAgICAgICAgICB2YXIgaW5zdGFudGlhdGVQcm9wZXJ0aWVzID0gW3Byb3BlcnR5SGFuZGxlci50YXJnZXQua2V5LCBwcm9wZXJ0eUhhbmRsZXIudGFyZ2V0LmNvbGxlY3Rpb25dO1xuXG4gICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUmVsYXRpb25zaGlwSGFzTWFueSguLi5pbnN0YW50aWF0ZVByb3BlcnRpZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzT25lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNPbmUoLi4uaW5zdGFudGlhdGVQcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2hvdWxkIGJlIHVucmVhY2hhYmxlLi4uXG4gICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKCdJbnZhbGlkIHJlbGF0aW9uc2hpcCB0eXBlJyk7XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFR5cGVjYXN0XG4gICAgICovXG4gICAgY2xhc3MgVHlwZWNhc3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJldHVyblZhbHVlXG4gICAgICAgICAqIEBwYXJhbSB0eXBlY2FzdENvbnN0cnVjdG9yIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHBhcmFtIHZhbHVlIHsqfVxuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHsqfVxuICAgICAgICAgKiBAcmV0dXJuIHsqfVxuICAgICAgICAgKi9cbiAgICAgICAgcmV0dXJuVmFsdWUodHlwZWNhc3RDb25zdHJ1Y3RvciwgdmFsdWUsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVjYXN0Q29uc3RydWN0b3IodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJyA/IHZhbHVlIDogZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHN0cmluZ1xuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgc3RyaW5nKGRlZmF1bHRWYWx1ZSA9ICcnKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShTdHJpbmcsIHZhbHVlLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYm9vbGVhblxuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHtCb29sZWFufVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGJvb2xlYW4oZGVmYXVsdFZhbHVlID0gdHJ1ZSkge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoQm9vbGVhbiwgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBudW1iZXJcbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIG51bWJlcihkZWZhdWx0VmFsdWUgPSAwKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShOdW1iZXIsIHZhbHVlLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYXJyYXlcbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7QXJyYXl9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgYXJyYXkoZGVmYXVsdFZhbHVlID0gW10pIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKEFycmF5LCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBtZXRob2QgYXV0b0luY3JlbWVudFxuICAgICAgICAgKiBAcGFyYW0gaW5pdGlhbFZhbHVlIHtOdW1iZXJ9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgYXV0b0luY3JlbWVudChpbml0aWFsVmFsdWUgPSAxKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE51bWJlcihpbml0aWFsVmFsdWUrKyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjdXN0b21cbiAgICAgICAgICogQHBhcmFtIHR5cGVjYXN0Rm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGN1c3RvbSh0eXBlY2FzdEZuKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZWNhc3RGbjtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcFxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaGFzT25lXG4gICAgICAgICAqIEBwYXJhbSBmb3JlaWduS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBIYXNPbmV9XG4gICAgICAgICAqL1xuICAgICAgICBoYXNPbmUoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUmVsYXRpb25zaGlwSGFzT25lKGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGhhc01hbnlcbiAgICAgICAgICogQHBhcmFtIGZvcmVpZ25LZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge1JlbGF0aW9uc2hpcEhhc01hbnl9XG4gICAgICAgICAqL1xuICAgICAgICBoYXNNYW55KGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc01hbnkoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwQWJzdHJhY3RcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXBBYnN0cmFjdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gZm9yZWlnbktleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKSB7XG5cbiAgICAgICAgICAgIHRoaXMudGFyZ2V0ID0ge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIGtleTogZm9yZWlnbktleVxuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2V0VmFsdWVzXG4gICAgICAgICAqIEBwYXJhbSB2YWx1ZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNldFZhbHVlcyh2YWx1ZXMpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWVzID0gdGhpcy52YWx1ZSA9IHZhbHVlcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlZmluZVJlbGF0aW9uc2hpcFxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBhY2Nlc3NvckZ1bmN0aW9ucyB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXksIGFjY2Vzc29yRnVuY3Rpb25zKSB7XG5cbiAgICAgICAgICAgIHRoaXMuc291cmNlID0ge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIGtleTogbG9jYWxLZXlcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBhY2Nlc3NvckZ1bmN0aW9ucy5nZXQsXG4gICAgICAgICAgICAgICAgc2V0OiBhY2Nlc3NvckZ1bmN0aW9ucy5zZXQsXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhc3NlcnRGb3JlaWduUHJvcGVydHlFeGlzdHNcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb24ge0NvbGxlY3Rpb259XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgYXNzZXJ0Rm9yZWlnblByb3BlcnR5RXhpc3RzKGNvbGxlY3Rpb24sIGxvY2FsS2V5KSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgY29sbGVjdGlvbi5ibHVlcHJpbnQubW9kZWxbbG9jYWxLZXldID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oYFVuYWJsZSB0byBmaW5kIHByb3BlcnR5IFwiJHtsb2NhbEtleX1cIiBpbiBjb2xsZWN0aW9uIFwiJHtjb2xsZWN0aW9uLm5hbWV9XCJgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwSGFzTWFueVxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcEhhc01hbnkgZXh0ZW5kcyBSZWxhdGlvbnNoaXBBYnN0cmFjdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVmaW5lUmVsYXRpb25zaGlwXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSkge1xuXG4gICAgICAgICAgICByZXR1cm4gc3VwZXIuZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSwge1xuICAgICAgICAgICAgICAgIGdldDogdGhpcy5nZXRNb2RlbHMuYmluZCh0aGlzKSxcbiAgICAgICAgICAgICAgICBzZXQ6IHRoaXMuc2V0TW9kZWxzLmJpbmQodGhpcylcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBnZXRNb2RlbHNcbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBnZXRNb2RlbHMoKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBsb2FkTW9kZWxzXG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGxvYWRNb2RlbHMgPSAoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZm9yZWlnbkNvbGxlY3Rpb24ubW9kZWxzLmZpbHRlcigoZm9yZWlnbk1vZGVsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlcy5pbmRleE9mKGZvcmVpZ25Nb2RlbFt0aGlzLnRhcmdldC5rZXldKSAhPT0gLTE7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBhcnJheURpZmZcbiAgICAgICAgICAgICAqIEBwYXJhbSBmaXJzdEFycmF5IHtBcnJheX1cbiAgICAgICAgICAgICAqIEBwYXJhbSBzZWNvbmRBcnJheSB7QXJyYXl9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHsqfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgYXJyYXlEaWZmID0gKGZpcnN0QXJyYXksIHNlY29uZEFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpcnN0QXJyYXkuZmlsdGVyKChpbmRleCkgPT4gc2Vjb25kQXJyYXkuaW5kZXhPZihpbmRleCkgPCAwKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIGZvcmVpZ25Db2xsZWN0aW9uID0gY2F0d2Fsay5jb2xsZWN0aW9uKHRoaXMudGFyZ2V0LmNvbGxlY3Rpb24pLFxuICAgICAgICAgICAgICAgIG1vZGVscyAgICAgICAgICAgID0gbG9hZE1vZGVscygpO1xuXG4gICAgICAgICAgICAvLyBBc3NlcnQgdGhhdCB0aGUgZm9yZWlnbiBwcm9wZXJ0eSBleGlzdHMgaW4gdGhlIGNvbGxlY3Rpb24uXG4gICAgICAgICAgICB0aGlzLmFzc2VydEZvcmVpZ25Qcm9wZXJ0eUV4aXN0cyhmb3JlaWduQ29sbGVjdGlvbiwgdGhpcy50YXJnZXQua2V5KTtcblxuICAgICAgICAgICAgLy8gSWYgdGhlcmUgaXMgYSBkaXNjcmVwYW5jeSBiZXR3ZWVuIHRoZSBjb3VudHMsIHRoZW4gd2Uga25vdyBhbGwgdGhlIG1vZGVscyBoYXZlbid0IGJlZW4gbG9hZGVkLlxuICAgICAgICAgICAgaWYgKG1vZGVscy5sZW5ndGggIT09IHRoaXMudmFsdWVzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAgICAgLy8gRGlzY292ZXIgdGhlIGtleXMgdGhhdCBhcmUgY3VycmVudGx5IG5vdCBsb2FkZWQuXG4gICAgICAgICAgICAgICAgdmFyIGxvYWRlZEtleXMgICA9IG1vZGVscy5tYXAobW9kZWwgPT4gbW9kZWxbdGhpcy50YXJnZXQua2V5XSksXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkS2V5cyA9IGFycmF5RGlmZih0aGlzLnZhbHVlcywgbG9hZGVkS2V5cyk7XG5cbiAgICAgICAgICAgICAgICByZXF1aXJlZEtleXMuZm9yRWFjaCgoZm9yZWlnbktleSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXF1aXJlZE1vZGVsID0ge307XG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkTW9kZWxbdGhpcy50YXJnZXQua2V5XSA9IGZvcmVpZ25LZXk7XG4gICAgICAgICAgICAgICAgICAgIGZvcmVpZ25Db2xsZWN0aW9uLnJlYWRNb2RlbChyZXF1aXJlZE1vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZWFkIHRoZSBtb2RlbHMgYWdhaW4gaW1tZWRpYXRlbHkuXG4gICAgICAgICAgICAgICAgbW9kZWxzID0gbG9hZE1vZGVscygpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbHM7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNldE1vZGVsc1xuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0TW9kZWxzKHZhbHVlcykge1xuICAgICAgICAgICAgdGhpcy52YWx1ZXMgPSB2YWx1ZXM7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBIYXNPbmVcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXBIYXNPbmUgZXh0ZW5kcyBSZWxhdGlvbnNoaXBBYnN0cmFjdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVmaW5lUmVsYXRpb25zaGlwXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSkge1xuXG4gICAgICAgICAgICByZXR1cm4gc3VwZXIuZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSwge1xuICAgICAgICAgICAgICAgIGdldDogdGhpcy5nZXRNb2RlbC5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgICAgIHNldDogdGhpcy5zZXRNb2RlbC5iaW5kKHRoaXMpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZ2V0TW9kZWxcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TW9kZWwoKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBsb2FkTW9kZWxcbiAgICAgICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGxvYWRNb2RlbCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm9yZWlnbkNvbGxlY3Rpb24ubW9kZWxzLmZpbmQoKGZvcmVpZ25Nb2RlbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZSA9PT0gZm9yZWlnbk1vZGVsW3RoaXMudGFyZ2V0LmtleV07XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgZm9yZWlnbkNvbGxlY3Rpb24gPSBjYXR3YWxrLmNvbGxlY3Rpb24odGhpcy50YXJnZXQuY29sbGVjdGlvbiksXG4gICAgICAgICAgICAgICAgbW9kZWwgICAgICAgICAgICAgPSBsb2FkTW9kZWwoKTtcblxuICAgICAgICAgICAgLy8gQXNzZXJ0IHRoYXQgdGhlIGZvcmVpZ24gcHJvcGVydHkgZXhpc3RzIGluIHRoZSBjb2xsZWN0aW9uLlxuICAgICAgICAgICAgdGhpcy5hc3NlcnRGb3JlaWduUHJvcGVydHlFeGlzdHMoZm9yZWlnbkNvbGxlY3Rpb24sIHRoaXMudGFyZ2V0LmtleSk7XG5cbiAgICAgICAgICAgIGlmICghbW9kZWwpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1vZGVsIGNhbm5vdCBiZSBmb3VuZCBhbmQgdGhlcmVmb3JlIHdlJ2xsIGF0dGVtcHQgdG8gcmVhZCB0aGUgbW9kZWwgaW50byB0aGUgY29sbGVjdGlvbi5cbiAgICAgICAgICAgICAgICB2YXIgcmVxdWlyZWRNb2RlbCAgID0ge307XG4gICAgICAgICAgICAgICAgcmVxdWlyZWRNb2RlbFt0aGlzLnRhcmdldC5rZXldID0gdGhpcy52YWx1ZTtcbiAgICAgICAgICAgICAgICBmb3JlaWduQ29sbGVjdGlvbi5yZWFkTW9kZWwocmVxdWlyZWRNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICAvLyBBdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVsIGFnYWluIGltbWVkaWF0ZWx5LlxuICAgICAgICAgICAgICAgIG1vZGVsID0gbG9hZE1vZGVsKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzZXRNb2RlbFxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0TW9kZWwodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFRyYW5zYWN0aW9uXG4gICAgICovXG4gICAgY2xhc3MgVHJhbnNhY3Rpb24ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHJldHVybiB7VHJhbnNhY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcblxuICAgICAgICAgICAgdGhpcy5tb2RlbHMgICAgPSBbXTtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZUZuID0gKCkgPT4ge307XG5cbiAgICAgICAgICAgIC8vIEZsdXNoIHRoZSBwcm9taXNlcyBpbiB0aGUgc3Vic2VxdWVudCBydW4tbG9vcC5cbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5mbHVzaCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFkZFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb21pc2Uge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGFkZChtb2RlbCwgcHJvbWlzZSkge1xuICAgICAgICAgICAgdGhpcy5tb2RlbHMucHVzaCh7IG1vZGVsOiBtb2RlbCwgcHJvbWlzZTogcHJvbWlzZSB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlc29sdmVcbiAgICAgICAgICogQHBhcmFtIHJlc29sdmVGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICByZXNvbHZlKHJlc29sdmVGbikge1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlRm4gPSByZXNvbHZlRm47XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBmbHVzaFxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgZmx1c2goKSB7XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVGbih0aGlzLm1vZGVscyk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8vIEluc3RhbnRpYXRlIHRoZSBDYXR3YWxrIGNsYXNzLlxuICAgICR3aW5kb3cuY2F0d2FsayAgICAgICAgPSBuZXcgQ2F0d2FsaygpO1xuICAgICR3aW5kb3cuY2F0d2Fsay5NRVRBICAgPSBDQVRXQUxLX01FVEFfUFJPUEVSVFk7XG4gICAgJHdpbmRvdy5jYXR3YWxrLlNUQVRFUyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVM7XG5cbn0pKHdpbmRvdyk7IiwidmFyICRfX3BsYWNlaG9sZGVyX18wID0gJF9fcGxhY2Vob2xkZXJfXzEiLCIoJHRyYWNldXJSdW50aW1lLmNyZWF0ZUNsYXNzKSgkX19wbGFjZWhvbGRlcl9fMCwgJF9fcGxhY2Vob2xkZXJfXzEsICRfX3BsYWNlaG9sZGVyX18yKSIsIiR0cmFjZXVyUnVudGltZS5zcHJlYWQoJF9fcGxhY2Vob2xkZXJfXzApIiwiJHRyYWNldXJSdW50aW1lLmRlZmF1bHRTdXBlckNhbGwodGhpcyxcbiAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMC5wcm90b3R5cGUsIGFyZ3VtZW50cykiLCJ2YXIgJF9fcGxhY2Vob2xkZXJfXzAgPSAkX19wbGFjZWhvbGRlcl9fMSIsIigkdHJhY2V1clJ1bnRpbWUuY3JlYXRlQ2xhc3MpKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMykiLCIkdHJhY2V1clJ1bnRpbWUuc3VwZXJDYWxsKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRfX3BsYWNlaG9sZGVyX18zKSJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==