"use strict";
(function main($window, $document) {
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
        this.awakenFramework().angular();
      }
    },
    awakenFramework: function() {
      return {angular: function angular() {
          if (typeof $window.angular !== 'undefined') {
            var appElement = $window.angular.element($document.querySelector('*[ng-app]'));
            if ('scope' in appElement) {
              var scope = appElement.scope();
              if (!scope.$$phase) {
                scope.$apply();
              }
            }
          }
        }};
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
})(window, window.document);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNhdHdhbGsuanMiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMSIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci8yIiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzciLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvNCIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci82IiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzUiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFLQTtBQUFBLEFBQUMsUUFBUyxLQUFHLENBQUUsT0FBTSxDQUFHLENBQUEsU0FBUTtBQUU1QixhQUFXLENBQUM7SUFNTixDQUFBLHFCQUFvQixFQUFJLFlBQVU7SUFNbEMsQ0FBQSx5QkFBd0IsRUFBSTtBQUFFLE1BQUUsQ0FBRyxFQUFBO0FBQUcsUUFBSSxDQUFHLEVBQUE7QUFBRyxRQUFJLENBQUcsRUFBQTtBQUFHLFVBQU0sQ0FBRyxFQUFBO0FBQUEsRUFBRTtBQ25CL0UsQUFBSSxJQUFBLFVEd0JBLFNBQU0sUUFBTSxDQU1HLEFBQUMsQ0FBRTtBQUNWLE9BQUcsT0FBTyxFQUFZLEdBQUMsQ0FBQztBQUN4QixPQUFHLFlBQVksRUFBTyxHQUFDLENBQUM7QUFDeEIsT0FBRyxhQUFhLEVBQU0sSUFBSSxhQUFXLEFBQUMsRUFBQyxDQUFDO0FBQ3hDLE9BQUcsU0FBUyxFQUFVLElBQUksU0FBTyxBQUFDLEVBQUMsQ0FBQztBQUNwQyxPQUFHLGVBQWUsRUFBSSxLQUFHLENBQUM7RUNuQ0UsQURvQ2hDLENDcENnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUY0Q3JCLG1CQUFlLENBQWYsVUFBaUIsSUFBRyxBQUFpQixDQUFHO1FBQWpCLFdBQVMsNkNBQUksR0FBQztBQUVqQyxTQUFHLEVBQUksQ0FBQSxN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QUM7QUYweUNyQixNQUFFLENBQUYsVUFBSSxLQUFJLENBQUcsQ0FBQSxPQUFNLENBQUc7QUFDaEIsU0FBRyxPQUFPLEtBQUssQUFBQyxDQUFDO0FBQUUsWUFBSSxDQUFHLE1BQUk7QUFBRyxjQUFNLENBQUcsUUFBTTtBQUFBLE1BQUUsQ0FBQyxDQUFDO0lBQ3hEO0FBT0EsVUFBTSxDQUFOLFVBQVEsU0FBUSxDQUFHO0FBQ2YsU0FBRyxVQUFVLEVBQUksVUFBUSxDQUFDO0lBQzlCO0FBTUEsUUFBSSxDQUFKLFVBQUssQUFBQyxDQUFFO0FBQ0osU0FBRyxVQUFVLEFBQUMsQ0FBQyxJQUFHLE9BQU8sQ0FBQyxDQUFDO0lBQy9CO0FBQUEsT0U3ekM2RTtBRmswQ2pGLFFBQU0sUUFBUSxFQUFXLElBQUksUUFBTSxBQUFDLEVBQUMsQ0FBQztBQUN0QyxRQUFNLFFBQVEsS0FBSyxFQUFNLHNCQUFvQixDQUFDO0FBQzlDLFFBQU0sUUFBUSxPQUFPLEVBQUksMEJBQXdCLENBQUM7QUFFdEQsQ0FBQyxBQUFDLENBQUMsTUFBSyxDQUFHLENBQUEsTUFBSyxTQUFTLENBQUMsQ0FBQztBQUFBIiwiZmlsZSI6ImNhdHdhbGsuZXM1LnRyYWNldXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBtb2R1bGUgQ2F0d2Fsa1xuICogQGF1dGhvciBBZGFtIFRpbWJlcmxha2VcbiAqIEBsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9XaWxkaG9uZXkvQ2F0d2Fsay5qc1xuICovXG4oZnVuY3Rpb24gbWFpbigkd2luZG93LCAkZG9jdW1lbnQpIHtcblxuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLyoqXG4gICAgICogQGNvbnN0YW50IENBVFdBTEtfTUVUQV9QUk9QRVJUWVxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgY29uc3QgQ0FUV0FMS19NRVRBX1BST1BFUlRZID0gJ19fY2F0d2Fsayc7XG5cbiAgICAvKipcbiAgICAgKiBAY29uc3RhbnQgQ0FUV0FMS19TVEFURV9QUk9QRVJUSUVTXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICBjb25zdCBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTID0geyBORVc6IDEsIERJUlRZOiAyLCBTQVZFRDogNCwgREVMRVRFRDogOCB9O1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIENhdHdhbGtcbiAgICAgKi9cbiAgICBjbGFzcyBDYXR3YWxrIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEByZXR1cm4ge0NhdHdhbGt9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzICAgICAgICAgPSB7fTtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbnMgICAgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwICAgPSBuZXcgUmVsYXRpb25zaGlwKCk7XG4gICAgICAgICAgICB0aGlzLnR5cGVjYXN0ICAgICAgID0gbmV3IFR5cGVjYXN0KCk7XG4gICAgICAgICAgICB0aGlzLnJldmVydFR5cGVjYXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNyZWF0ZUNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIFtwcm9wZXJ0aWVzPXt9XSB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlQ29sbGVjdGlvbihuYW1lLCBwcm9wZXJ0aWVzID0ge30pIHtcblxuICAgICAgICAgICAgbmFtZSA9IFN0cmluZyhuYW1lKTtcblxuICAgICAgICAgICAgaWYgKG5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50aHJvd0V4Y2VwdGlvbignQ29sbGVjdGlvbiBtdXN0IGhhdmUgYW4gYXNzb2NpYXRlZCBuYW1lJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRocm93RXhjZXB0aW9uKGBDb2xsZWN0aW9uIFwiJHtuYW1lfVwiIG11c3QgZGVmaW5lIGl0cyBibHVlcHJpbnRgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBuZXcgQ29sbGVjdGlvbihuYW1lLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbnNbbmFtZV0gPSBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb247XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlbGV0ZUNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGRlbGV0ZUNvbGxlY3Rpb24obmFtZSkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5jb2xsZWN0aW9uc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbGxlY3Rpb25zW25hbWVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjb2xsZWN0aW9uKG5hbWUpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNvbGxlY3Rpb25zW25hbWVdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHRoaXMudGhyb3dFeGNlcHRpb24oYFVuYWJsZSB0byBmaW5kIGNvbGxlY3Rpb24gXCIke25hbWV9XCJgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbnNbbmFtZV07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNyZWF0ZVRyYW5zYWN0aW9uXG4gICAgICAgICAqIEByZXR1cm4ge1RyYW5zYWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlVHJhbnNhY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRyYW5zYWN0aW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXZlcnRDYWxsYmFja1R5cGVjYXN0XG4gICAgICAgICAqIEBwYXJhbSBzZXR0aW5nIHtCb29sZWFufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgcmV2ZXJ0Q2FsbGJhY2tUeXBlY2FzdChzZXR0aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnJldmVydFR5cGVjYXN0ID0gISFzZXR0aW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgdGhyb3dFeGNlcHRpb25cbiAgICAgICAgICogQHRocm93cyBFeGNlcHRpb25cbiAgICAgICAgICogQHBhcmFtIG1lc3NhZ2Uge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHRocm93RXhjZXB0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHRocm93IGBDYXR3YWxrOiAke21lc3NhZ2V9LmA7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gW2V2ZW50Rm49KCk9Pnt9XSB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBvbihuYW1lLCBldmVudEZuID0gKCkgPT4ge30pIHtcblxuICAgICAgICAgICAgKG5hbWUgfHwgJycpLnNwbGl0KC9cXHMrL2cpLmZvckVhY2goaG9va05hbWUgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZXZlbnRzW2hvb2tOYW1lXSA9IGV2ZW50Rm47XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgb2ZmXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBvZmYobmFtZSkge1xuXG4gICAgICAgICAgICAobmFtZSB8fCAnJykuc3BsaXQoL1xccysvZykuZm9yRWFjaChob29rTmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRzW2hvb2tOYW1lXTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgY2xhc3MgQ29sbGVjdGlvbiB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IobmFtZSwgcHJvcGVydGllcykge1xuICAgICAgICAgICAgdGhpcy5pZCAgICAgICAgPSAwO1xuICAgICAgICAgICAgdGhpcy5uYW1lICAgICAgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tb2RlbHMgICAgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuc2lsZW50ICAgID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmJsdWVwcmludCA9IG5ldyBCbHVlcHJpbnRNb2RlbChuYW1lLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNpbGVudGx5XG4gICAgICAgICAqIEBwYXJhbSBzaWxlbnRGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzaWxlbnRseShzaWxlbnRGbikge1xuXG4gICAgICAgICAgICB2YXIgc2lsZW50QmVmb3JlID0gdGhpcy5zaWxlbnQ7XG4gICAgICAgICAgICB0aGlzLnNpbGVudCAgICAgID0gdHJ1ZTtcbiAgICAgICAgICAgIHNpbGVudEZuLmFwcGx5KHRoaXMpO1xuXG4gICAgICAgICAgICBpZiAoIXNpbGVudEJlZm9yZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gT25seSByZW1vdmUgdGhlIHNpbGVuY2UgaWYgaXQgd2Fzbid0IHNpbGVudCBiZWZvcmUsIHdoaWNoIHByZXZlbnRzIGFnYWluc3RcbiAgICAgICAgICAgICAgICAvLyBuZXN0aW5nIHRoZSBgc2lsZW50bHlgIG1ldGhvZHMgaW5zaWRlIG9uZSBhbm90aGVyLlxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50ID0gZmFsc2U7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnZlcnRzIGVhY2ggbm9uLWV4dGVuc2libGUgbW9kZWwgaW50byBhbiBleHRlbnNpYmxlIG1vZGVsLCB3aGljaCBpcyB1c2VmdWwgZm9yIEphdmFTY3JpcHQgZnJhbWV3b3Jrc1xuICAgICAgICAgKiBzdWNoIGFzIEFuZ3VsYXIuanMgd2hpY2ggaW5zaXN0IG9uIGluamVjdGluZyAkJGhhc2hLZXkgaW50byBlYWNoIG9iamVjdC4gUGZmdCFcbiAgICAgICAgICpcbiAgICAgICAgICogVG9kbzogVXNlIGEgZ2VuZXJhdG9yIGluc3RlYWQgb2YgYSBzaW1wbGUgcmV0dXJuIHN0YXRlbWVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBleHRlbnNpYmxlSXRlcmF0aW9uXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgZXh0ZW5zaWJsZUl0ZXJhdGlvbigpIHtcblxuICAgICAgICAgICAgdmFyIGV4dGVuc2libGVNb2RlbHMgPSBbXTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIG1ha2VFeHRlbnNpYmxlXG4gICAgICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIG1ha2VFeHRlbnNpYmxlID0gKG1vZGVsKSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0ZW5zaWJsZU1vZGVsID0ge307XG5cbiAgICAgICAgICAgICAgICAvLyBDb3B5IGFjcm9zcyB0aGUgbW9kZWwgaW50byBhbiBleHRlbnNpYmxlIG9iamVjdC5cbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbCkuZm9yRWFjaChrZXkgPT4gZXh0ZW5zaWJsZU1vZGVsW2tleV0gPSBtb2RlbFtrZXldKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBleHRlbnNpYmxlTW9kZWw7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWxzLmZvckVhY2gobW9kZWwgPT4gZXh0ZW5zaWJsZU1vZGVscy5wdXNoKG1ha2VFeHRlbnNpYmxlKG1vZGVsKSkpO1xuXG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5zaWJsZU1vZGVscztcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYWRkTW9kZWxcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkTW9kZWwocHJvcGVydGllcyA9IHt9KSB7XG5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcbiAgICAgICAgICAgICAgICBtb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwocHJvcGVydGllcyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNpbGVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFkZE1vZGVsc1xuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllc0xpc3Qge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBhZGRNb2RlbHMocHJvcGVydGllc0xpc3QgPSBbXSkge1xuXG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJvcGVydGllc0xpc3QpKSB7XG4gICAgICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignQXJndW1lbnQgZm9yIGBhZGRNb2RlbHNgIG11c3QgYmUgYW4gYXJyYXkgb2YgcHJvcGVydGllcycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgbW9kZWxzID0gW107XG5cbiAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoZnVuY3Rpb24gc2lsZW50bHkoKSB7XG5cbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzTGlzdC5mb3JFYWNoKChwcm9wZXJ0aWVzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVscy5wdXNoKHRoaXMuYWRkTW9kZWwocHJvcGVydGllcykpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5RW1pdEV2ZW50KCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWxzO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gW3Byb3BlcnRpZXM9e31dIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZU1vZGVsKHByb3BlcnRpZXMgPSB7fSkge1xuXG4gICAgICAgICAgICB0aGlzLmluamVjdE1ldGEocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgbW9kZWwgY29uZm9ybXMgdG8gdGhlIGJsdWVwcmludC5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuYmx1ZXByaW50Lml0ZXJhdGVBbGwocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgIE9iamVjdC5zZWFsKG1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2NyZWF0ZScsIG1vZGVsLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVhZE1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlYWRNb2RlbChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB0aGlzLmlzc3VlUHJvbWlzZSgncmVhZCcsIHByb3BlcnRpZXMsIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIHByb3BlcnRpZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCB1cGRhdGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlTW9kZWwobW9kZWwsIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgY29weSBvZiB0aGUgb2xkIG1vZGVsIGZvciByb2xsaW5nIGJhY2suXG4gICAgICAgICAgICB2YXIgcHJldmlvdXNNb2RlbCA9IHt9O1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4gcHJldmlvdXNNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtwcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICB0cnkge1xuXG4gICAgICAgICAgICAgICAgLy8gQ29weSBhY3Jvc3MgdGhlIGRhdGEgZnJvbSB0aGUgcHJvcGVydGllcy4gV2Ugd3JhcCB0aGUgYXNzaWdubWVudCBpbiBhIHRyeS1jYXRjaCBibG9ja1xuICAgICAgICAgICAgICAgIC8vIGJlY2F1c2UgaWYgdGhlIHVzZXIgaGFzIGFkZGVkIGFueSBhZGRpdGlvbmFsIHByb3BlcnRpZXMgdGhhdCBkb24ndCBiZWxvbmcgaW4gdGhlIG1vZGVsLFxuICAgICAgICAgICAgICAgIC8vIGFuIGV4Y2VwdGlvbiB3aWxsIGJlIHJhaXNlZCBiZWNhdXNlIHRoZSBvYmplY3QgaXMgc2VhbGVkLlxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZvckVhY2gocHJvcGVydHkgPT4gbW9kZWxbcHJvcGVydHldID0gcHJvcGVydGllc1twcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXhjZXB0aW9uKSB7fVxuXG4gICAgICAgICAgICAvLyBUeXBlY2FzdCB0aGUgdXBkYXRlZCBtb2RlbCBhbmQgY29weSBhY3Jvc3MgaXRzIHByb3BlcnRpZXMgdG8gdGhlIGN1cnJlbnQgbW9kZWwsIHNvIGFzIHdlXG4gICAgICAgICAgICAvLyBkb24ndCBicmVhayBhbnkgcmVmZXJlbmNlcy5cbiAgICAgICAgICAgIHZhciB0eXBlY2FzdE1vZGVsID0gdGhpcy5ibHVlcHJpbnQucmVpdGVyYXRlUHJvcGVydGllcyhtb2RlbCk7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0eXBlY2FzdE1vZGVsKS5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSB0eXBlY2FzdE1vZGVsW3Byb3BlcnR5XVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ3VwZGF0ZScsIG1vZGVsLCBwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZ2V0TW9kZWxCeUlkXG4gICAgICAgICAqIEBwYXJhbSBpZCB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH1cbiAgICAgICAgICovXG4gICAgICAgIGdldE1vZGVsQnlJZChpZCkge1xuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tb2RlbHMuZmluZCgobW9kZWwpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5pZCA9PT0gaWQ7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVsZXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlbGV0ZU1vZGVsKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCByZW1vdmVcbiAgICAgICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgICAgICogQHBhcmFtIGluZGV4IHtOdW1iZXJ9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciByZW1vdmUgPSAobW9kZWwsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2RlbGV0ZScsIG51bGwsIG1vZGVsKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIG1vZGVsIHdhcyBzdWNjZXNzZnVsbHkgZGVsZXRlZCB3aXRoIGZpbmRpbmcgdGhlIG1vZGVsIGJ5IHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAcHJvcGVydHkgZGlkRGVsZXRlVmlhUmVmZXJlbmNlXG4gICAgICAgICAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGRpZERlbGV0ZVZpYVJlZmVyZW5jZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgdGhlIG1vZGVsIGJ5IHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSB0aGlzLm1vZGVscy5pbmRleE9mKG1vZGVsKTtcblxuICAgICAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlkRGVsZXRlVmlhUmVmZXJlbmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKHRoaXMubW9kZWxzW2luZGV4XSwgaW5kZXgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSkoKTtcblxuICAgICAgICAgICAgaWYgKCFkaWREZWxldGVWaWFSZWZlcmVuY2UpIHtcblxuICAgICAgICAgICAgICAgICgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gMDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZmluZCB0aGUgbW9kZWwgYnkgaXRzIGludGVybmFsIENhdHdhbGsgSUQuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLmZvckVhY2goKGN1cnJlbnRNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQgPT09IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUoY3VycmVudE1vZGVsLCBpbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYWRkQXNzb2NpYXRpb25cbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7QXJyYXl9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGFkZEFzc29jaWF0aW9uKG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydGllcykge1xuXG4gICAgICAgICAgICBpZiAoISh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNNYW55KSkge1xuICAgICAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oJ1VzaW5nIGBhZGRBc3NvY2lhdGlvbmAgcmVxdWlyZXMgYSBoYXNNYW55IHJlbGF0aW9uc2hpcCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY3VycmVudFByb3BlcnRpZXMgPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0oKTtcbiAgICAgICAgICAgIGN1cnJlbnRQcm9wZXJ0aWVzICAgICA9IGN1cnJlbnRQcm9wZXJ0aWVzLmNvbmNhdChwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIHZhciB1cGRhdGVEYXRhICAgICAgICA9IHt9O1xuICAgICAgICAgICAgdXBkYXRlRGF0YVtwcm9wZXJ0eV0gID0gY3VycmVudFByb3BlcnRpZXM7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51cGRhdGVNb2RlbChtb2RlbCwgdXBkYXRlRGF0YSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlbW92ZUFzc29jaWF0aW9uXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydHkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge0FycmF5fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmVBc3NvY2lhdGlvbihtb2RlbCwgcHJvcGVydHksIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgaWYgKCEodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkpIHtcbiAgICAgICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKCdVc2luZyBgcmVtb3ZlQXNzb2NpYXRpb25gIHJlcXVpcmVzIGEgaGFzTWFueSByZWxhdGlvbnNoaXAnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGN1cnJlbnRQcm9wZXJ0aWVzID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldKCk7XG5cbiAgICAgICAgICAgIHByb3BlcnRpZXMuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBjdXJyZW50UHJvcGVydGllcy5pbmRleE9mKHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICBjdXJyZW50UHJvcGVydGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZhciB1cGRhdGVEYXRhICAgICAgICA9IHt9O1xuICAgICAgICAgICAgdXBkYXRlRGF0YVtwcm9wZXJ0eV0gID0gY3VycmVudFByb3BlcnRpZXM7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51cGRhdGVNb2RlbChtb2RlbCwgdXBkYXRlRGF0YSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGluamVjdE1ldGFcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGluamVjdE1ldGEobW9kZWwpIHtcblxuICAgICAgICAgICAgbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXSA9IHtcbiAgICAgICAgICAgICAgICBpZDogKyt0aGlzLmlkLFxuICAgICAgICAgICAgICAgIHN0YXR1czogQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ORVcsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxWYWx1ZXM6IHt9LFxuICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcFZhbHVlczoge31cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaXNzdWVQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGN1cnJlbnRNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJldmlvdXNNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgaXNzdWVQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNpbGVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYXR3YWxrLmV2ZW50c1tldmVudE5hbWVdICE9PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxsYmFjayBoYXMgbm90IGFjdHVhbGx5IGJlZW4gc2V0LXVwIGFuZCB0aGVyZWZvcmUgbW9kZWxzIHdpbGwgbmV2ZXIgYmVcbiAgICAgICAgICAgICAgICAvLyBwZXJzaXN0ZWQuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIElzc3VlIHRoZSBwcm9taXNlIGZvciBiYWNrLWVuZCBwZXJzaXN0ZW5jZSBvZiB0aGUgbW9kZWwuXG4gICAgICAgICAgICAgICAgY2F0d2Fsay5ldmVudHNbZXZlbnROYW1lXS5jYWxsKHRoaXMsIHRoaXMuY2xlYW5Nb2RlbChjdXJyZW50TW9kZWwgfHwgcHJldmlvdXNNb2RlbCksIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZTogcmVzb2x2ZSwgcmVqZWN0OiByZWplY3RcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSkudGhlbigocmVzb2x1dGlvblBhcmFtcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQhXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVzb2x2ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpKHJlc29sdXRpb25QYXJhbXMpO1xuXG4gICAgICAgICAgICAgICAgfSwgKHJlc29sdXRpb25QYXJhbXMpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkIVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlamVjdFByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpKHJlc29sdXRpb25QYXJhbXMpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlc29sdmVQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ30gLSBFdmVudCBuYW1lIGlzIGFjdHVhbGx5IG5vdCByZXF1aXJlZCwgYmVjYXVzZSB3ZSBjYW4gZGVkdWNlIHRoZSBzdWJzZXF1ZW50IGFjdGlvblxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbSB0aGUgc3RhdGUgb2YgdGhlIGBjdXJyZW50TW9kZWxgIGFuZCBgcHJldmlvdXNNb2RlbGAsIGJ1dCB3ZSBhZGQgaXQgdG8gYWRkXG4gICAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFyaWZpY2F0aW9uIHRvIG91ciBsb2dpY2FsIHN0ZXBzLlxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgcmVzb2x2ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgaWYgKGN1cnJlbnRNb2RlbCAmJiBldmVudE5hbWUgPT09ICdjcmVhdGUnKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgcGVyc2lzdGVkIVxuICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuU0FWRUQ7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2hlbiB3ZSdyZSBpbiB0aGUgcHJvY2VzcyBvZiBkZWxldGluZyBhIG1vZGVsLCB0aGUgYGN1cnJlbnRNb2RlbGAgaXMgdW5zZXQ7IGluc3RlYWQgdGhlXG4gICAgICAgICAgICAvLyBgcHJldmlvdXNNb2RlbGAgd2lsbCBiZSBkZWZpbmVkLlxuICAgICAgICAgICAgaWYgKChjdXJyZW50TW9kZWwgPT09IG51bGwgJiYgcHJldmlvdXNNb2RlbCkgJiYgZXZlbnROYW1lID09PSAnZGVsZXRlJykge1xuXG4gICAgICAgICAgICAgICAgLy8gTW9kZWwgaGFzIGJlZW4gc3VjY2Vzc2Z1bGx5IGRlbGV0ZWQhXG4gICAgICAgICAgICAgICAgcHJldmlvdXNNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuREVMRVRFRDtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gKHByb3BlcnRpZXMpID0+IHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzICYmIGV2ZW50TmFtZSAhPT0gJ3JlYWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgcHJvcGVydGllcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydGllcyAmJiAhcHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShDQVRXQUxLX01FVEFfUFJPUEVSVFkpICYmIGV2ZW50TmFtZSA9PT0gJ3JlYWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbW9kZWwgdG8gcmVmbGVjdCB0aGUgY2hhbmdlcyBvbiB0aGUgb2JqZWN0IHRoYXQgYHJlYWRNb2RlbGAgcmV0dXJuLlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIG1vZGVsKTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZWplY3RQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGN1cnJlbnRNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJldmlvdXNNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHJlamVjdFByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIHJlamVjdFdpdGhcbiAgICAgICAgICAgICAqIEBwYXJhbSBkdXBsaWNhdGVNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIHJlamVjdFdpdGggPSAoZHVwbGljYXRlTW9kZWwpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmIChkdXBsaWNhdGVNb2RlbCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnROYW1lID09PSAndXBkYXRlJyAmJiBkdXBsaWNhdGVNb2RlbC5oYXNPd25Qcm9wZXJ0eShDQVRXQUxLX01FVEFfUFJPUEVSVFkpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VyIHBhc3NlZCBpbiBhIG1vZGVsIGFuZCB0aGVyZWZvcmUgdGhlIHByZXZpb3VzIHNob3VsZCBiZSBkZWxldGVkLCBidXQgb25seVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdoZW4gd2UncmUgdXBkYXRpbmchXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxldGVNb2RlbChwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91c01vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ERUxFVEVEO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVzZSB0aGUgZHVwbGljYXRlIG1vZGVsIGFzIHRoZSByZWZlcmVuY2UuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgZHVwbGljYXRlTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5TQVZFRDtcblxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAocHJldmlvdXNNb2RlbCA9PT0gbnVsbCAmJiBldmVudE5hbWUgPT09ICdjcmVhdGUnKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcmV2aW91cyBtb2RlbCB3YXMgYWN0dWFsbHkgTlVMTCBhbmQgdGhlcmVmb3JlIHdlJ2xsIGRlbGV0ZSBpdC5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxldGVNb2RlbChjdXJyZW50TW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLkRFTEVURUQ7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RXaXRoO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjdXJyZW50TW9kZWwgPT09IG51bGwgJiYgZXZlbnROYW1lID09PSAnZGVsZXRlJyApIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIERldmVsb3BlciBkb2Vzbid0IGFjdHVhbGx5IHdhbnQgdG8gZGVsZXRlIHRoZSBtb2RlbCwgYW5kIHRoZXJlZm9yZSB3ZSBuZWVkIHRvIHJldmVydCBpdCB0b1xuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgbW9kZWwgaXQgd2FzLCBhbmQgc2V0IGl0cyBmbGFnIGJhY2sgdG8gd2hhdCBpdCB3YXMuXG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMudXBkYXRlTW9kZWwoe30sIHByZXZpb3VzTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgoY3VycmVudE1vZGVsICYmIHByZXZpb3VzTW9kZWwpICYmIGV2ZW50TmFtZSA9PT0gJ3VwZGF0ZScpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEJvdGggb2YgdGhlIGN1cnJlbnQgYW5kIHByZXZpb3VzIG1vZGVscyBhcmUgdXBkYXRlZCwgYW5kIHRoZXJlZm9yZSB3ZSdsbCBzaW1wbHlcbiAgICAgICAgICAgICAgICAgICAgLy8gcmV2ZXJ0IHRoZSBjdXJyZW50IG1vZGVsIHRvIHRoZSBwcmV2aW91cyBtb2RlbC5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdFdpdGg7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNvbmRpdGlvbmFsbHlFbWl0RXZlbnRcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGNvbmRpdGlvbmFsbHlFbWl0RXZlbnQoKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2F0d2Fsay5ldmVudHMucmVmcmVzaCA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgLy8gVm9pbGEhIFdlJ3JlIGFsbCBkb25lIVxuICAgICAgICAgICAgICAgIGNhdHdhbGsuZXZlbnRzLnJlZnJlc2goKTtcbiAgICAgICAgICAgICAgICB0aGlzLmF3YWtlbkZyYW1ld29yaygpLmFuZ3VsYXIoKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIGluaXRpYXRpbmcgdGhlIGRpZ2VzdCBvZiBhbnkgSmF2YVNjcmlwdCBmcmFtZXdvcmtzIHRoYXQgcmVseVxuICAgICAgICAgKiBvbiBtYW51YWwgaW50ZXJ2ZW50aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIGF3YWtlbkZyYW1ld29ya1xuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBhd2FrZW5GcmFtZXdvcmsoKSB7XG5cbiAgICAgICAgICAgIHJldHVybiB7XG5cbiAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICAgKiBAbWV0aG9kIGFuZ3VsYXJcbiAgICAgICAgICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGFuZ3VsYXI6IGZ1bmN0aW9uIGFuZ3VsYXIoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiAkd2luZG93LmFuZ3VsYXIgIT09ICd1bmRlZmluZWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVmcmVzaCB0aGUgQW5ndWxhci5qcyBzY29wZSBhdXRvbWF0aWNhbGx5LlxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFwcEVsZW1lbnQgPSAkd2luZG93LmFuZ3VsYXIuZWxlbWVudCgkZG9jdW1lbnQucXVlcnlTZWxlY3RvcignKltuZy1hcHBdJykpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoJ3Njb3BlJyBpbiBhcHBFbGVtZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgc2NvcGUgPSBhcHBFbGVtZW50LnNjb3BlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXNjb3BlLiQkcGhhc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUuJGFwcGx5KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjbGVhbk1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBjbGVhbk1vZGVsKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIHZhciBjbGVhbmVkTW9kZWwgPSB7fTtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSBDQVRXQUxLX01FVEFfUFJPUEVSVFkpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBDYXR3YWxrIG1ldGEgZGF0YSBzaG91bGQgbmV2ZXIgYmUgcGVyc2lzdGVkIHRvIHRoZSBiYWNrLWVuZC5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBwcm9wZXJ0eSBpcyBhY3R1YWxseSBhIHJlbGF0aW9uc2hpcCwgd2hpY2ggd2UgbmVlZCB0byByZXNvbHZlIHRvXG4gICAgICAgICAgICAgICAgLy8gaXRzIHByaW1pdGl2ZSB2YWx1ZShzKS5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwRnVuY3Rpb24gPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gcmVsYXRpb25zaGlwRnVuY3Rpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0gJiYgbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5vcmlnaW5hbFZhbHVlc1twcm9wZXJ0eV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBkaXNjb3ZlcmVkIGEgdHlwZWNhc3RlZCBwcm9wZXJ0eSB0aGF0IG5lZWRzIHRvIGJlIHJldmVydGVkIHRvIGl0cyBvcmlnaW5hbFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFsdWUgYmVmb3JlIGludm9raW5nIHRoZSBjYWxsYmFjay5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFuZWRNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLm9yaWdpbmFsVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gbW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGNsZWFuZWRNb2RlbDtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgQmx1ZXByaW50TW9kZWxcbiAgICAgKi9cbiAgICBjbGFzcyBCbHVlcHJpbnRNb2RlbCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gYmx1ZXByaW50IHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0JsdWVwcmludE1vZGVsfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IobmFtZSwgYmx1ZXByaW50KSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgID0gbmFtZTtcbiAgICAgICAgICAgIHRoaXMubW9kZWwgPSBPYmplY3QuZnJlZXplKGJsdWVwcmludCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29udmVuaWVuY2UgbWV0aG9kIHRoYXQgd3JhcHMgYGl0ZXJhdGVQcm9wZXJ0aWVzYCBhbmQgYGl0ZXJhdGVCbHVlcHJpbnRgIGludG8gYSBvbmUtbGluZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZUFsbFxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlQWxsKHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuaXRlcmF0ZVByb3BlcnRpZXMocHJvcGVydGllcyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pdGVyYXRlQmx1ZXByaW50KG1vZGVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgaXRlcmF0aW5nIG92ZXIgdGhlIHBhc3NlZCBpbiBtb2RlbCBwcm9wZXJ0aWVzIHRvIGVuc3VyZSB0aGV5J3JlIGluIHRoZSBibHVlcHJpbnQsXG4gICAgICAgICAqIGFuZCB0eXBlY2FzdGluZyB0aGUgcHJvcGVydGllcyBiYXNlZCBvbiB0aGUgZGVmaW5lIGJsdWVwcmludCBmb3IgdGhlIGN1cnJlbnQgY29sbGVjdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBpdGVyYXRlUHJvcGVydGllc1xuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlUHJvcGVydGllcyhwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSAgICAgICAgICAgPSBwcm9wZXJ0aWVzW3Byb3BlcnR5XSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgIT09IENBVFdBTEtfTUVUQV9QUk9QRVJUWSAmJiB0eXBlb2YgcHJvcGVydHlIYW5kbGVyID09PSAndW5kZWZpbmVkJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByb3BlcnR5IGRvZXNuJ3QgYmVsb25nIGluIHRoZSBtb2RlbCBiZWNhdXNlIGl0J3Mgbm90IGluIHRoZSBibHVlcHJpbnQuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMucmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0eUhhbmRsZXIuZGVmaW5lUmVsYXRpb25zaGlwKHRoaXMubmFtZSwgcHJvcGVydHkpKTtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyLnNldFZhbHVlcyhwcm9wZXJ0aWVzW3Byb3BlcnR5XSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnRpZXNbQ0FUV0FMS19NRVRBX1BST1BFUlRZXSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSB0aGUgb3JpZ2luYWwgdmFsdWUgb2YgdGhlIHJlbGF0aW9uc2hpcCB0byByZXNvbHZlIHdoZW4gY2xlYW5pbmcgdGhlIG1vZGVsLlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1tDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0gPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3BlcnR5SGFuZGxlci52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcHJvcGVydHlIYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVHlwZWNhc3QgcHJvcGVydHkgdG8gdGhlIGRlZmluZWQgdHlwZS5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG9yaWdpbmFsVmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBwcm9wZXJ0eUhhbmRsZXIodmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjYXR3YWxrLnJldmVydFR5cGVjYXN0ICYmIG9yaWdpbmFsVmFsdWUgIT09IHZhbHVlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBvcmlnaW5hbCB2YWx1ZSBzbyB0aGF0IHdlIGNhbiByZXZlcnQgaXQgZm9yIHdoZW4gaW52b2tpbmcgdGhlIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB3aXRoIHRoZSBgY2xlYW5Nb2RlbGAgbWV0aG9kLlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1tDQVRXQUxLX01FVEFfUFJPUEVSVFldLm9yaWdpbmFsVmFsdWVzW3Byb3BlcnR5XSA9IG9yaWdpbmFsVmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gdmFsdWU7XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgaXRlcmF0aW5nIG92ZXIgdGhlIGJsdWVwcmludCB0byBkZXRlcm1pbmUgaWYgYW55IHByb3BlcnRpZXMgYXJlIG1pc3NpbmdcbiAgICAgICAgICogZnJvbSB0aGUgY3VycmVudCBtb2RlbCwgdGhhdCBoYXZlIGJlZW4gZGVmaW5lZCBpbiB0aGUgYmx1ZXByaW50IGFuZCB0aGVyZWZvcmUgc2hvdWxkIGJlXG4gICAgICAgICAqIHByZXNlbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZUJsdWVwcmludFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZUJsdWVwcmludChtb2RlbCkge1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0aGlzLm1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbW9kZWxbcHJvcGVydHldID09PSAndW5kZWZpbmVkJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEVuc3VyZSB0aGF0IGl0IGlzIGRlZmluZWQuXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSAgICAgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLnJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbCwgcHJvcGVydHksIHByb3BlcnR5SGFuZGxlci5kZWZpbmVSZWxhdGlvbnNoaXAodGhpcy5uYW1lLCBwcm9wZXJ0eSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyLnNldFZhbHVlcyhbXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5tb2RlbFtwcm9wZXJ0eV0gPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBwcm9wZXJ0eSBoYXMgYSBwcm9wZXJ0eSBoYW5kbGVyIG1ldGhvZCB3aGljaCB3b3VsZCBiZSByZXNwb25zaWJsZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIHR5cGVjYXN0aW5nLCBhbmQgZGV0ZXJtaW5pbmcgdGhlIGRlZmF1bHQgdmFsdWUuXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSBwcm9wZXJ0eUhhbmRsZXIoKTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgcmVpdGVyYXRpbmcgb3ZlciB0aGUgbW9kZWwgdG8gb25jZSBhZ2FpbiB0eXBlY2FzdCB0aGUgdmFsdWVzOyB3aGljaCBpc1xuICAgICAgICAgKiBlc3BlY2lhbGx5IHVzZWZ1bCBmb3Igd2hlbiB0aGUgbW9kZWwgaGFzIGJlZW4gdXBkYXRlZCwgYnV0IHJlbGF0aW9uc2hpcHMgbmVlZCB0byBiZSBsZWZ0XG4gICAgICAgICAqIGFsb25lLiBTaW5jZSB0aGUgbW9kZWwgaXMgc2VhbGVkIHdlIGNhbiBhbHNvIGd1YXJhbnRlZSB0aGF0IG5vIG90aGVyIHByb3BlcnRpZXMgaGF2ZSBiZWVuXG4gICAgICAgICAqIGFkZGVkIGludG8gdGhlIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIHJlaXRlcmF0ZVByb3BlcnRpZXNcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlaXRlcmF0ZVByb3BlcnRpZXMobW9kZWwpIHtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSBwcm9wZXJ0eUhhbmRsZXIobW9kZWxbcHJvcGVydHldKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgaW5zdGFudGlhdGluZyBhIG5ldyByZWxhdGlvbnNoaXAgcGVyIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIHJlbGF0aW9uc2hpcEhhbmRsZXJcbiAgICAgICAgICogQHRocm93cyBFeGNlcHRpb25cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnR5SGFuZGxlciB7UmVsYXRpb25zaGlwQWJzdHJhY3R9XG4gICAgICAgICAqIEByZXR1cm4ge1JlbGF0aW9uc2hpcEFic3RyYWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgcmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpIHtcblxuICAgICAgICAgICAgdmFyIGluc3RhbnRpYXRlUHJvcGVydGllcyA9IFtwcm9wZXJ0eUhhbmRsZXIudGFyZ2V0LmtleSwgcHJvcGVydHlIYW5kbGVyLnRhcmdldC5jb2xsZWN0aW9uXTtcblxuICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc01hbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc01hbnkoLi4uaW5zdGFudGlhdGVQcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc09uZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUmVsYXRpb25zaGlwSGFzT25lKC4uLmluc3RhbnRpYXRlUHJvcGVydGllcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNob3VsZCBiZSB1bnJlYWNoYWJsZS4uLlxuICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignSW52YWxpZCByZWxhdGlvbnNoaXAgdHlwZScpO1xuXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBUeXBlY2FzdFxuICAgICAqL1xuICAgIGNsYXNzIFR5cGVjYXN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXR1cm5WYWx1ZVxuICAgICAgICAgKiBAcGFyYW0gdHlwZWNhc3RDb25zdHJ1Y3RvciB7RnVuY3Rpb259XG4gICAgICAgICAqIEBwYXJhbSB2YWx1ZSB7Kn1cbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7Kn1cbiAgICAgICAgICogQHJldHVybiB7Kn1cbiAgICAgICAgICovXG4gICAgICAgIHJldHVyblZhbHVlKHR5cGVjYXN0Q29uc3RydWN0b3IsIHZhbHVlLCBkZWZhdWx0VmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlY2FzdENvbnN0cnVjdG9yKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgPyB2YWx1ZSA6IGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzdHJpbmdcbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHN0cmluZyhkZWZhdWx0VmFsdWUgPSAnJykge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoU3RyaW5nLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGJvb2xlYW5cbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7Qm9vbGVhbn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBib29sZWFuKGRlZmF1bHRWYWx1ZSA9IHRydWUpIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKEJvb2xlYW4sIHZhbHVlLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgbnVtYmVyXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge051bWJlcn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBudW1iZXIoZGVmYXVsdFZhbHVlID0gMCkge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoTnVtYmVyLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFycmF5XG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge0FycmF5fVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGFycmF5KGRlZmF1bHRWYWx1ZSA9IFtdKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShBcnJheSwgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogbWV0aG9kIGF1dG9JbmNyZW1lbnRcbiAgICAgICAgICogQHBhcmFtIGluaXRpYWxWYWx1ZSB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGF1dG9JbmNyZW1lbnQoaW5pdGlhbFZhbHVlID0gMSkge1xuXG4gICAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBOdW1iZXIoaW5pdGlhbFZhbHVlKyspO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3VzdG9tXG4gICAgICAgICAqIEBwYXJhbSB0eXBlY2FzdEZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjdXN0b20odHlwZWNhc3RGbikge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVjYXN0Rm47XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXAge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGhhc09uZVxuICAgICAgICAgKiBAcGFyYW0gZm9yZWlnbktleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7UmVsYXRpb25zaGlwSGFzT25lfVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzT25lKGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc09uZShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBoYXNNYW55XG4gICAgICAgICAqIEBwYXJhbSBmb3JlaWduS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBIYXNNYW55fVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzTWFueShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNNYW55KGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEFic3RyYWN0XG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIGZvcmVpZ25LZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3Rvcihmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuXG4gICAgICAgICAgICB0aGlzLnRhcmdldCA9IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBrZXk6IGZvcmVpZ25LZXlcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNldFZhbHVlc1xuICAgICAgICAgKiBAcGFyYW0gdmFsdWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRWYWx1ZXModmFsdWVzKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcyA9IHRoaXMudmFsdWUgPSB2YWx1ZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gYWNjZXNzb3JGdW5jdGlvbnMge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCBhY2Nlc3NvckZ1bmN0aW9ucykge1xuXG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBrZXk6IGxvY2FsS2V5XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGdldDogYWNjZXNzb3JGdW5jdGlvbnMuZ2V0LFxuICAgICAgICAgICAgICAgIHNldDogYWNjZXNzb3JGdW5jdGlvbnMuc2V0LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYXNzZXJ0Rm9yZWlnblByb3BlcnR5RXhpc3RzXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGFzc2VydEZvcmVpZ25Qcm9wZXJ0eUV4aXN0cyhjb2xsZWN0aW9uLCBsb2NhbEtleSkge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNvbGxlY3Rpb24uYmx1ZXByaW50Lm1vZGVsW2xvY2FsS2V5XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKGBVbmFibGUgdG8gZmluZCBwcm9wZXJ0eSBcIiR7bG9jYWxLZXl9XCIgaW4gY29sbGVjdGlvbiBcIiR7Y29sbGVjdGlvbi5uYW1lfVwiYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEhhc01hbnlcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXBIYXNNYW55IGV4dGVuZHMgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlZmluZVJlbGF0aW9uc2hpcFxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXkpIHtcblxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXksIHtcbiAgICAgICAgICAgICAgICBnZXQ6IHRoaXMuZ2V0TW9kZWxzLmJpbmQodGhpcyksXG4gICAgICAgICAgICAgICAgc2V0OiB0aGlzLnNldE1vZGVscy5iaW5kKHRoaXMpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZ2V0TW9kZWxzXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TW9kZWxzKCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgbG9hZE1vZGVsc1xuICAgICAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBsb2FkTW9kZWxzID0gKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcmVpZ25Db2xsZWN0aW9uLm1vZGVscy5maWx0ZXIoKGZvcmVpZ25Nb2RlbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZXMuaW5kZXhPZihmb3JlaWduTW9kZWxbdGhpcy50YXJnZXQua2V5XSkgIT09IC0xO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgYXJyYXlEaWZmXG4gICAgICAgICAgICAgKiBAcGFyYW0gZmlyc3RBcnJheSB7QXJyYXl9XG4gICAgICAgICAgICAgKiBAcGFyYW0gc2Vjb25kQXJyYXkge0FycmF5fVxuICAgICAgICAgICAgICogQHJldHVybiB7Kn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGFycmF5RGlmZiA9IChmaXJzdEFycmF5LCBzZWNvbmRBcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaXJzdEFycmF5LmZpbHRlcigoaW5kZXgpID0+IHNlY29uZEFycmF5LmluZGV4T2YoaW5kZXgpIDwgMClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBmb3JlaWduQ29sbGVjdGlvbiA9IGNhdHdhbGsuY29sbGVjdGlvbih0aGlzLnRhcmdldC5jb2xsZWN0aW9uKSxcbiAgICAgICAgICAgICAgICBtb2RlbHMgICAgICAgICAgICA9IGxvYWRNb2RlbHMoKTtcblxuICAgICAgICAgICAgLy8gQXNzZXJ0IHRoYXQgdGhlIGZvcmVpZ24gcHJvcGVydHkgZXhpc3RzIGluIHRoZSBjb2xsZWN0aW9uLlxuICAgICAgICAgICAgdGhpcy5hc3NlcnRGb3JlaWduUHJvcGVydHlFeGlzdHMoZm9yZWlnbkNvbGxlY3Rpb24sIHRoaXMudGFyZ2V0LmtleSk7XG5cbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGlzIGEgZGlzY3JlcGFuY3kgYmV0d2VlbiB0aGUgY291bnRzLCB0aGVuIHdlIGtub3cgYWxsIHRoZSBtb2RlbHMgaGF2ZW4ndCBiZWVuIGxvYWRlZC5cbiAgICAgICAgICAgIGlmIChtb2RlbHMubGVuZ3RoICE9PSB0aGlzLnZhbHVlcy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgICAgIC8vIERpc2NvdmVyIHRoZSBrZXlzIHRoYXQgYXJlIGN1cnJlbnRseSBub3QgbG9hZGVkLlxuICAgICAgICAgICAgICAgIHZhciBsb2FkZWRLZXlzICAgPSBtb2RlbHMubWFwKG1vZGVsID0+IG1vZGVsW3RoaXMudGFyZ2V0LmtleV0pLFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZEtleXMgPSBhcnJheURpZmYodGhpcy52YWx1ZXMsIGxvYWRlZEtleXMpO1xuXG4gICAgICAgICAgICAgICAgcmVxdWlyZWRLZXlzLmZvckVhY2goKGZvcmVpZ25LZXkpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVxdWlyZWRNb2RlbCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZE1vZGVsW3RoaXMudGFyZ2V0LmtleV0gPSBmb3JlaWduS2V5O1xuICAgICAgICAgICAgICAgICAgICBmb3JlaWduQ29sbGVjdGlvbi5yZWFkTW9kZWwocmVxdWlyZWRNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVhZCB0aGUgbW9kZWxzIGFnYWluIGltbWVkaWF0ZWx5LlxuICAgICAgICAgICAgICAgIG1vZGVscyA9IGxvYWRNb2RlbHMoKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWxzO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzZXRNb2RlbHNcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNldE1vZGVscyh2YWx1ZXMpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWVzID0gdmFsdWVzO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwSGFzT25lXG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwSGFzT25lIGV4dGVuZHMgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlZmluZVJlbGF0aW9uc2hpcFxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXkpIHtcblxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXksIHtcbiAgICAgICAgICAgICAgICBnZXQ6IHRoaXMuZ2V0TW9kZWwuYmluZCh0aGlzKSxcbiAgICAgICAgICAgICAgICBzZXQ6IHRoaXMuc2V0TW9kZWwuYmluZCh0aGlzKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGdldE1vZGVsXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGdldE1vZGVsKCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgbG9hZE1vZGVsXG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBsb2FkTW9kZWwgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcmVpZ25Db2xsZWN0aW9uLm1vZGVscy5maW5kKChmb3JlaWduTW9kZWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWUgPT09IGZvcmVpZ25Nb2RlbFt0aGlzLnRhcmdldC5rZXldO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIGZvcmVpZ25Db2xsZWN0aW9uID0gY2F0d2Fsay5jb2xsZWN0aW9uKHRoaXMudGFyZ2V0LmNvbGxlY3Rpb24pLFxuICAgICAgICAgICAgICAgIG1vZGVsICAgICAgICAgICAgID0gbG9hZE1vZGVsKCk7XG5cbiAgICAgICAgICAgIC8vIEFzc2VydCB0aGF0IHRoZSBmb3JlaWduIHByb3BlcnR5IGV4aXN0cyBpbiB0aGUgY29sbGVjdGlvbi5cbiAgICAgICAgICAgIHRoaXMuYXNzZXJ0Rm9yZWlnblByb3BlcnR5RXhpc3RzKGZvcmVpZ25Db2xsZWN0aW9uLCB0aGlzLnRhcmdldC5rZXkpO1xuXG4gICAgICAgICAgICBpZiAoIW1vZGVsKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBjYW5ub3QgYmUgZm91bmQgYW5kIHRoZXJlZm9yZSB3ZSdsbCBhdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVsIGludG8gdGhlIGNvbGxlY3Rpb24uXG4gICAgICAgICAgICAgICAgdmFyIHJlcXVpcmVkTW9kZWwgICA9IHt9O1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkTW9kZWxbdGhpcy50YXJnZXQua2V5XSA9IHRoaXMudmFsdWU7XG4gICAgICAgICAgICAgICAgZm9yZWlnbkNvbGxlY3Rpb24ucmVhZE1vZGVsKHJlcXVpcmVkTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZWFkIHRoZSBtb2RlbCBhZ2FpbiBpbW1lZGlhdGVseS5cbiAgICAgICAgICAgICAgICBtb2RlbCA9IGxvYWRNb2RlbCgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2V0TW9kZWxcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNldE1vZGVsKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBUcmFuc2FjdGlvblxuICAgICAqL1xuICAgIGNsYXNzIFRyYW5zYWN0aW9uIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEByZXR1cm4ge1RyYW5zYWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWxzICAgID0gW107XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVGbiA9ICgpID0+IHt9O1xuXG4gICAgICAgICAgICAvLyBGbHVzaCB0aGUgcHJvbWlzZXMgaW4gdGhlIHN1YnNlcXVlbnQgcnVuLWxvb3AuXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZmx1c2gpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhZGRcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9taXNlIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBhZGQobW9kZWwsIHByb21pc2UpIHtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2goeyBtb2RlbDogbW9kZWwsIHByb21pc2U6IHByb21pc2UgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXNvbHZlXG4gICAgICAgICAqIEBwYXJhbSByZXNvbHZlRm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgcmVzb2x2ZShyZXNvbHZlRm4pIHtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZUZuID0gcmVzb2x2ZUZuO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZmx1c2hcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGZsdXNoKCkge1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlRm4odGhpcy5tb2RlbHMpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBJbnN0YW50aWF0ZSB0aGUgQ2F0d2FsayBjbGFzcy5cbiAgICAkd2luZG93LmNhdHdhbGsgICAgICAgID0gbmV3IENhdHdhbGsoKTtcbiAgICAkd2luZG93LmNhdHdhbGsuTUVUQSAgID0gQ0FUV0FMS19NRVRBX1BST1BFUlRZO1xuICAgICR3aW5kb3cuY2F0d2Fsay5TVEFURVMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTO1xuXG59KSh3aW5kb3csIHdpbmRvdy5kb2N1bWVudCk7IiwidmFyICRfX3BsYWNlaG9sZGVyX18wID0gJF9fcGxhY2Vob2xkZXJfXzEiLCIoJHRyYWNldXJSdW50aW1lLmNyZWF0ZUNsYXNzKSgkX19wbGFjZWhvbGRlcl9fMCwgJF9fcGxhY2Vob2xkZXJfXzEsICRfX3BsYWNlaG9sZGVyX18yKSIsIiR0cmFjZXVyUnVudGltZS5zcHJlYWQoJF9fcGxhY2Vob2xkZXJfXzApIiwiJHRyYWNldXJSdW50aW1lLmRlZmF1bHRTdXBlckNhbGwodGhpcyxcbiAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMC5wcm90b3R5cGUsIGFyZ3VtZW50cykiLCJ2YXIgJF9fcGxhY2Vob2xkZXJfXzAgPSAkX19wbGFjZWhvbGRlcl9fMSIsIigkdHJhY2V1clJ1bnRpbWUuY3JlYXRlQ2xhc3MpKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMykiLCIkdHJhY2V1clJ1bnRpbWUuc3VwZXJDYWxsKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRfX3BsYWNlaG9sZGVyX18zKSJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==