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
      this.silent = true;
      silentFn.apply(this);
      this.silent = false;
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
    }), 1);
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNhdHdhbGsuanMiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMSIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci8yIiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzciLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvNCIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci82IiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzUiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFLQTtBQUFBLEFBQUMsUUFBUyxLQUFHLENBQUUsT0FBTTtBQUVqQixhQUFXLENBQUM7SUFNTixDQUFBLHFCQUFvQixFQUFJLFlBQVU7SUFNbEMsQ0FBQSx5QkFBd0IsRUFBSTtBQUFFLE1BQUUsQ0FBRyxFQUFBO0FBQUcsUUFBSSxDQUFHLEVBQUE7QUFBRyxRQUFJLENBQUcsRUFBQTtBQUFHLFVBQU0sQ0FBRyxFQUFBO0FBQUEsRUFBRTtBQ25CL0UsQUFBSSxJQUFBLFVEd0JBLFNBQU0sUUFBTSxDQU1HLEFBQUMsQ0FBRTtBQUNWLE9BQUcsT0FBTyxFQUFZLEdBQUMsQ0FBQztBQUN4QixPQUFHLFlBQVksRUFBTyxHQUFDLENBQUM7QUFDeEIsT0FBRyxhQUFhLEVBQU0sSUFBSSxhQUFXLEFBQUMsRUFBQyxDQUFDO0FBQ3hDLE9BQUcsU0FBUyxFQUFVLElBQUksU0FBTyxBQUFDLEVBQUMsQ0FBQztBQUNwQyxPQUFHLGVBQWUsRUFBSSxLQUFHLENBQUM7RUNuQ0UsQURvQ2hDLENDcENnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUY0Q3JCLG1CQUFlLENBQWYsVUFBaUIsSUFBRyxBQUFpQixDQUFHO1FBQWpCLFdBQVMsNkNBQUksR0FBQztBQUVqQyxTQUFHLEVBQUksQ0FBQSxNQUFLLEFBQUMsQ0FBQyxJ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TSxRQUFRLE9BQU8sRUFBSSwwQkFBd0IsQ0FBQztBQUV0RCxDQUFDLEFBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQztBQUFBIiwiZmlsZSI6ImNhdHdhbGsuZXM1LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbW9kdWxlIENhdHdhbGtcbiAqIEBhdXRob3IgQWRhbSBUaW1iZXJsYWtlXG4gKiBAbGluayBodHRwczovL2dpdGh1Yi5jb20vV2lsZGhvbmV5L0NhdHdhbGsuanNcbiAqL1xuKGZ1bmN0aW9uIG1haW4oJHdpbmRvdykge1xuXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvKipcbiAgICAgKiBAY29uc3RhbnQgQ0FUV0FMS19NRVRBX1BST1BFUlRZXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICBjb25zdCBDQVRXQUxLX01FVEFfUFJPUEVSVFkgPSAnX19jYXR3YWxrJztcblxuICAgIC8qKlxuICAgICAqIEBjb25zdGFudCBDQVRXQUxLX1NUQVRFX1BST1BFUlRJRVNcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIGNvbnN0IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMgPSB7IE5FVzogMSwgRElSVFk6IDIsIFNBVkVEOiA0LCBERUxFVEVEOiA4IH07XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgQ2F0d2Fsa1xuICAgICAqL1xuICAgIGNsYXNzIENhdHdhbGsge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHJldHVybiB7Q2F0d2Fsa31cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudHMgICAgICAgICA9IHt9O1xuICAgICAgICAgICAgdGhpcy5jb2xsZWN0aW9ucyAgICA9IHt9O1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXAgICA9IG5ldyBSZWxhdGlvbnNoaXAoKTtcbiAgICAgICAgICAgIHRoaXMudHlwZWNhc3QgICAgICAgPSBuZXcgVHlwZWNhc3QoKTtcbiAgICAgICAgICAgIHRoaXMucmV2ZXJ0VHlwZWNhc3QgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3JlYXRlQ29sbGVjdGlvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gW3Byb3BlcnRpZXM9e31dIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGVDb2xsZWN0aW9uKG5hbWUsIHByb3BlcnRpZXMgPSB7fSkge1xuXG4gICAgICAgICAgICBuYW1lID0gU3RyaW5nKG5hbWUpO1xuXG4gICAgICAgICAgICBpZiAobmFtZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRocm93RXhjZXB0aW9uKCdDb2xsZWN0aW9uIG11c3QgaGF2ZSBhbiBhc3NvY2lhdGVkIG5hbWUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGhyb3dFeGNlcHRpb24oYENvbGxlY3Rpb24gXCIke25hbWV9XCIgbXVzdCBkZWZpbmUgaXRzIGJsdWVwcmludGApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IG5ldyBDb2xsZWN0aW9uKG5hbWUsIHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgdGhpcy5jb2xsZWN0aW9uc1tuYW1lXSA9IGNvbGxlY3Rpb247XG4gICAgICAgICAgICByZXR1cm4gY29sbGVjdGlvbjtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVsZXRlQ29sbGVjdGlvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgZGVsZXRlQ29sbGVjdGlvbihuYW1lKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmNvbGxlY3Rpb25zW25hbWVdKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29sbGVjdGlvbnNbbmFtZV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNvbGxlY3Rpb24obmFtZSkge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuY29sbGVjdGlvbnNbbmFtZV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50aHJvd0V4Y2VwdGlvbihgVW5hYmxlIHRvIGZpbmQgY29sbGVjdGlvbiBcIiR7bmFtZX1cImApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uc1tuYW1lXTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3JlYXRlVHJhbnNhY3Rpb25cbiAgICAgICAgICogQHJldHVybiB7VHJhbnNhY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGVUcmFuc2FjdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVHJhbnNhY3Rpb24oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJldmVydENhbGxiYWNrVHlwZWNhc3RcbiAgICAgICAgICogQHBhcmFtIHNldHRpbmcge0Jvb2xlYW59XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICByZXZlcnRDYWxsYmFja1R5cGVjYXN0KHNldHRpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucmV2ZXJ0VHlwZWNhc3QgPSAhIXNldHRpbmc7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCB0aHJvd0V4Y2VwdGlvblxuICAgICAgICAgKiBAdGhyb3dzIEV4Y2VwdGlvblxuICAgICAgICAgKiBAcGFyYW0gbWVzc2FnZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhyb3dFeGNlcHRpb24obWVzc2FnZSkge1xuICAgICAgICAgICAgdGhyb3cgYENhdHdhbGs6ICR7bWVzc2FnZX0uYDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIG9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBldmVudEZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIG9uKG5hbWUsIGV2ZW50Rm4pIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gZXZlbnRGbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIG9mZlxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgb2ZmKG5hbWUpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50c1tuYW1lXTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBjbGFzcyBDb2xsZWN0aW9uIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcihuYW1lLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB0aGlzLmlkICAgICAgICA9IDA7XG4gICAgICAgICAgICB0aGlzLm5hbWUgICAgICA9IG5hbWU7XG4gICAgICAgICAgICB0aGlzLm1vZGVscyAgICA9IFtdO1xuICAgICAgICAgICAgdGhpcy5zaWxlbnQgICAgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuYmx1ZXByaW50ID0gbmV3IEJsdWVwcmludE1vZGVsKG5hbWUsIHByb3BlcnRpZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2lsZW50bHlcbiAgICAgICAgICogQHBhcmFtIHNpbGVudEZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNpbGVudGx5KHNpbGVudEZuKSB7XG4gICAgICAgICAgICB0aGlzLnNpbGVudCA9IHRydWU7XG4gICAgICAgICAgICBzaWxlbnRGbi5hcHBseSh0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc2lsZW50ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhZGRNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBhZGRNb2RlbChwcm9wZXJ0aWVzID0ge30pIHtcblxuICAgICAgICAgICAgdmFyIG1vZGVsID0ge307XG5cbiAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuICAgICAgICAgICAgICAgIG1vZGVsID0gdGhpcy5jcmVhdGVNb2RlbChwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFkZE1vZGVsc1xuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllc0xpc3Qge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBhZGRNb2RlbHMocHJvcGVydGllc0xpc3QgPSBbXSkge1xuXG4gICAgICAgICAgICB2YXIgbW9kZWxzID0gW107XG5cbiAgICAgICAgICAgIHByb3BlcnRpZXNMaXN0LmZvckVhY2goKHByb3BlcnRpZXMpID0+IHtcbiAgICAgICAgICAgICAgICBtb2RlbHMucHVzaCh0aGlzLmFkZE1vZGVsKHByb3BlcnRpZXMpKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWxzO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gW3Byb3BlcnRpZXM9e31dIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZU1vZGVsKHByb3BlcnRpZXMgPSB7fSkge1xuXG4gICAgICAgICAgICB0aGlzLmluamVjdE1ldGEocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgbW9kZWwgY29uZm9ybXMgdG8gdGhlIGJsdWVwcmludC5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuYmx1ZXByaW50Lml0ZXJhdGVBbGwocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgIE9iamVjdC5zZWFsKG1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2NyZWF0ZScsIG1vZGVsLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVhZE1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlYWRNb2RlbChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB0aGlzLmlzc3VlUHJvbWlzZSgncmVhZCcsIHByb3BlcnRpZXMsIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIHByb3BlcnRpZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCB1cGRhdGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlTW9kZWwobW9kZWwsIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgY29weSBvZiB0aGUgb2xkIG1vZGVsIGZvciByb2xsaW5nIGJhY2suXG4gICAgICAgICAgICB2YXIgcHJldmlvdXNNb2RlbCA9IHt9O1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4gcHJldmlvdXNNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtwcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICB0cnkge1xuXG4gICAgICAgICAgICAgICAgLy8gQ29weSBhY3Jvc3MgdGhlIGRhdGEgZnJvbSB0aGUgcHJvcGVydGllcy4gV2Ugd3JhcCB0aGUgYXNzaWdubWVudCBpbiBhIHRyeS1jYXRjaCBibG9ja1xuICAgICAgICAgICAgICAgIC8vIGJlY2F1c2UgaWYgdGhlIHVzZXIgaGFzIGFkZGVkIGFueSBhZGRpdGlvbmFsIHByb3BlcnRpZXMgdGhhdCBkb24ndCBiZWxvbmcgaW4gdGhlIG1vZGVsLFxuICAgICAgICAgICAgICAgIC8vIGFuIGV4Y2VwdGlvbiB3aWxsIGJlIHJhaXNlZCBiZWNhdXNlIHRoZSBvYmplY3QgaXMgc2VhbGVkLlxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZvckVhY2gocHJvcGVydHkgPT4gbW9kZWxbcHJvcGVydHldID0gcHJvcGVydGllc1twcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXhjZXB0aW9uKSB7fVxuXG4gICAgICAgICAgICAvLyBUeXBlY2FzdCB0aGUgdXBkYXRlZCBtb2RlbCBhbmQgY29weSBhY3Jvc3MgaXRzIHByb3BlcnRpZXMgdG8gdGhlIGN1cnJlbnQgbW9kZWwsIHNvIGFzIHdlXG4gICAgICAgICAgICAvLyBkb24ndCBicmVhayBhbnkgcmVmZXJlbmNlcy5cbiAgICAgICAgICAgIHZhciB0eXBlY2FzdE1vZGVsID0gdGhpcy5ibHVlcHJpbnQucmVpdGVyYXRlUHJvcGVydGllcyhtb2RlbCk7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0eXBlY2FzdE1vZGVsKS5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSB0eXBlY2FzdE1vZGVsW3Byb3BlcnR5XVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ3VwZGF0ZScsIG1vZGVsLCBwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVsZXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlbGV0ZU1vZGVsKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCByZW1vdmVcbiAgICAgICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgICAgICogQHBhcmFtIGluZGV4IHtOdW1iZXJ9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciByZW1vdmUgPSAobW9kZWwsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2RlbGV0ZScsIG51bGwsIG1vZGVsKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIG1vZGVsIHdhcyBzdWNjZXNzZnVsbHkgZGVsZXRlZCB3aXRoIGZpbmRpbmcgdGhlIG1vZGVsIGJ5IHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAcHJvcGVydHkgZGlkRGVsZXRlVmlhUmVmZXJlbmNlXG4gICAgICAgICAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGRpZERlbGV0ZVZpYVJlZmVyZW5jZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgdGhlIG1vZGVsIGJ5IHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSB0aGlzLm1vZGVscy5pbmRleE9mKG1vZGVsKTtcblxuICAgICAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgZGlkRGVsZXRlVmlhUmVmZXJlbmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKHRoaXMubW9kZWxzW2luZGV4XSwgaW5kZXgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSkoKTtcblxuICAgICAgICAgICAgaWYgKCFkaWREZWxldGVWaWFSZWZlcmVuY2UpIHtcblxuICAgICAgICAgICAgICAgICgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gMDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZmluZCB0aGUgbW9kZWwgYnkgaXRzIGludGVybmFsIENhdHdhbGsgSUQuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLmZvckVhY2goKGN1cnJlbnRNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQgPT09IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmUoY3VycmVudE1vZGVsLCBpbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYWRkQXNzb2NpYXRpb25cbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7QXJyYXl9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGFkZEFzc29jaWF0aW9uKG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydGllcykge1xuXG4gICAgICAgICAgICBpZiAoISh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNNYW55KSkge1xuICAgICAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oJ1VzaW5nIGBhZGRBc3NvY2lhdGlvbmAgcmVxdWlyZXMgYSBoYXNNYW55IHJlbGF0aW9uc2hpcCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY3VycmVudFByb3BlcnRpZXMgPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0oKTtcbiAgICAgICAgICAgIGN1cnJlbnRQcm9wZXJ0aWVzICAgICA9IGN1cnJlbnRQcm9wZXJ0aWVzLmNvbmNhdChwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIHZhciB1cGRhdGVEYXRhICAgICAgICA9IHt9O1xuICAgICAgICAgICAgdXBkYXRlRGF0YVtwcm9wZXJ0eV0gID0gY3VycmVudFByb3BlcnRpZXM7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51cGRhdGVNb2RlbChtb2RlbCwgdXBkYXRlRGF0YSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlbW92ZUFzc29jaWF0aW9uXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydHkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge0FycmF5fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZW1vdmVBc3NvY2lhdGlvbihtb2RlbCwgcHJvcGVydHksIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgaWYgKCEodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkpIHtcbiAgICAgICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKCdVc2luZyBgcmVtb3ZlQXNzb2NpYXRpb25gIHJlcXVpcmVzIGEgaGFzTWFueSByZWxhdGlvbnNoaXAnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGN1cnJlbnRQcm9wZXJ0aWVzID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldKCk7XG5cbiAgICAgICAgICAgIHByb3BlcnRpZXMuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSBjdXJyZW50UHJvcGVydGllcy5pbmRleE9mKHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICBjdXJyZW50UHJvcGVydGllcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHZhciB1cGRhdGVEYXRhICAgICAgICA9IHt9O1xuICAgICAgICAgICAgdXBkYXRlRGF0YVtwcm9wZXJ0eV0gID0gY3VycmVudFByb3BlcnRpZXM7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy51cGRhdGVNb2RlbChtb2RlbCwgdXBkYXRlRGF0YSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGluamVjdE1ldGFcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGluamVjdE1ldGEobW9kZWwpIHtcblxuICAgICAgICAgICAgbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXSA9IHtcbiAgICAgICAgICAgICAgICBpZDogKyt0aGlzLmlkLFxuICAgICAgICAgICAgICAgIHN0YXR1czogQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ORVcsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxWYWx1ZXM6IHt9LFxuICAgICAgICAgICAgICAgIHJlbGF0aW9uc2hpcFZhbHVlczoge31cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaXNzdWVQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGN1cnJlbnRNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJldmlvdXNNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgaXNzdWVQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNpbGVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYXR3YWxrLmV2ZW50c1tldmVudE5hbWVdICE9PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxsYmFjayBoYXMgbm90IGFjdHVhbGx5IGJlZW4gc2V0LXVwIGFuZCB0aGVyZWZvcmUgbW9kZWxzIHdpbGwgbmV2ZXIgYmVcbiAgICAgICAgICAgICAgICAvLyBwZXJzaXN0ZWQuXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIElzc3VlIHRoZSBwcm9taXNlIGZvciBiYWNrLWVuZCBwZXJzaXN0ZW5jZSBvZiB0aGUgbW9kZWwuXG4gICAgICAgICAgICAgICAgY2F0d2Fsay5ldmVudHNbZXZlbnROYW1lXS5jYWxsKHRoaXMsIHRoaXMuY2xlYW5Nb2RlbChjdXJyZW50TW9kZWwgfHwgcHJldmlvdXNNb2RlbCksIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZTogcmVzb2x2ZSwgcmVqZWN0OiByZWplY3RcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSkudGhlbigocmVzb2x1dGlvblBhcmFtcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gUHJvbWlzZSBoYXMgYmVlbiByZXNvbHZlZCFcbiAgICAgICAgICAgICAgICB0aGlzLnJlc29sdmVQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKShyZXNvbHV0aW9uUGFyYW1zKTtcblxuICAgICAgICAgICAgfSwgKHJlc29sdXRpb25QYXJhbXMpID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIFByb21pc2UgaGFzIGJlZW4gcmVqZWN0ZWQhXG4gICAgICAgICAgICAgICAgdGhpcy5yZWplY3RQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKShyZXNvbHV0aW9uUGFyYW1zKTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlc29sdmVQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ30gLSBFdmVudCBuYW1lIGlzIGFjdHVhbGx5IG5vdCByZXF1aXJlZCwgYmVjYXVzZSB3ZSBjYW4gZGVkdWNlIHRoZSBzdWJzZXF1ZW50IGFjdGlvblxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbSB0aGUgc3RhdGUgb2YgdGhlIGBjdXJyZW50TW9kZWxgIGFuZCBgcHJldmlvdXNNb2RlbGAsIGJ1dCB3ZSBhZGQgaXQgdG8gYWRkXG4gICAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFyaWZpY2F0aW9uIHRvIG91ciBsb2dpY2FsIHN0ZXBzLlxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgcmVzb2x2ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgaWYgKGN1cnJlbnRNb2RlbCAmJiBldmVudE5hbWUgPT09ICdjcmVhdGUnKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgcGVyc2lzdGVkIVxuICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuU0FWRUQ7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gV2hlbiB3ZSdyZSBpbiB0aGUgcHJvY2VzcyBvZiBkZWxldGluZyBhIG1vZGVsLCB0aGUgYGN1cnJlbnRNb2RlbGAgaXMgdW5zZXQ7IGluc3RlYWQgdGhlXG4gICAgICAgICAgICAvLyBgcHJldmlvdXNNb2RlbGAgd2lsbCBiZSBkZWZpbmVkLlxuICAgICAgICAgICAgaWYgKChjdXJyZW50TW9kZWwgPT09IG51bGwgJiYgcHJldmlvdXNNb2RlbCkgJiYgZXZlbnROYW1lID09PSAnZGVsZXRlJykge1xuXG4gICAgICAgICAgICAgICAgLy8gTW9kZWwgaGFzIGJlZW4gc3VjY2Vzc2Z1bGx5IGRlbGV0ZWQhXG4gICAgICAgICAgICAgICAgcHJldmlvdXNNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuREVMRVRFRDtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gKHByb3BlcnRpZXMpID0+IHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzICYmIGV2ZW50TmFtZSAhPT0gJ3JlYWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgcHJvcGVydGllcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydGllcyAmJiAhcHJvcGVydGllcy5oYXNPd25Qcm9wZXJ0eShDQVRXQUxLX01FVEFfUFJPUEVSVFkpICYmIGV2ZW50TmFtZSA9PT0gJ3JlYWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbW9kZWwgdG8gcmVmbGVjdCB0aGUgY2hhbmdlcyBvbiB0aGUgb2JqZWN0IHRoYXQgYHJlYWRNb2RlbGAgcmV0dXJuLlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIG1vZGVsKTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZWplY3RQcm9taXNlXG4gICAgICAgICAqIEBwYXJhbSBldmVudE5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGN1cnJlbnRNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJldmlvdXNNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHJlamVjdFByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIHJlamVjdFdpdGhcbiAgICAgICAgICAgICAqIEBwYXJhbSBkdXBsaWNhdGVNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIHJlamVjdFdpdGggPSAoZHVwbGljYXRlTW9kZWwpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmIChkdXBsaWNhdGVNb2RlbCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnROYW1lID09PSAndXBkYXRlJyAmJiBkdXBsaWNhdGVNb2RlbC5oYXNPd25Qcm9wZXJ0eShDQVRXQUxLX01FVEFfUFJPUEVSVFkpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2VyIHBhc3NlZCBpbiBhIG1vZGVsIGFuZCB0aGVyZWZvcmUgdGhlIHByZXZpb3VzIHNob3VsZCBiZSBkZWxldGVkLCBidXQgb25seVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdoZW4gd2UncmUgdXBkYXRpbmchXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxldGVNb2RlbChwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91c01vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ERUxFVEVEO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVzZSB0aGUgZHVwbGljYXRlIG1vZGVsIGFzIHRoZSByZWZlcmVuY2UuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgZHVwbGljYXRlTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5TQVZFRDtcblxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuY29uZGl0aW9uYWxseUVtaXRFdmVudCgpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAocHJldmlvdXNNb2RlbCA9PT0gbnVsbCAmJiBldmVudE5hbWUgPT09ICdjcmVhdGUnKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcmV2aW91cyBtb2RlbCB3YXMgYWN0dWFsbHkgTlVMTCBhbmQgdGhlcmVmb3JlIHdlJ2xsIGRlbGV0ZSBpdC5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWxldGVNb2RlbChjdXJyZW50TW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLkRFTEVURUQ7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RXaXRoO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjdXJyZW50TW9kZWwgPT09IG51bGwgJiYgZXZlbnROYW1lID09PSAnZGVsZXRlJyApIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIERldmVsb3BlciBkb2Vzbid0IGFjdHVhbGx5IHdhbnQgdG8gZGVsZXRlIHRoZSBtb2RlbCwgYW5kIHRoZXJlZm9yZSB3ZSBuZWVkIHRvIHJldmVydCBpdCB0b1xuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgbW9kZWwgaXQgd2FzLCBhbmQgc2V0IGl0cyBmbGFnIGJhY2sgdG8gd2hhdCBpdCB3YXMuXG4gICAgICAgICAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMudXBkYXRlTW9kZWwoe30sIHByZXZpb3VzTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICgoY3VycmVudE1vZGVsICYmIHByZXZpb3VzTW9kZWwpICYmIGV2ZW50TmFtZSA9PT0gJ3VwZGF0ZScpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEJvdGggb2YgdGhlIGN1cnJlbnQgYW5kIHByZXZpb3VzIG1vZGVscyBhcmUgdXBkYXRlZCwgYW5kIHRoZXJlZm9yZSB3ZSdsbCBzaW1wbHlcbiAgICAgICAgICAgICAgICAgICAgLy8gcmV2ZXJ0IHRoZSBjdXJyZW50IG1vZGVsIHRvIHRoZSBwcmV2aW91cyBtb2RlbC5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdFdpdGg7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNvbmRpdGlvbmFsbHlFbWl0RXZlbnRcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGNvbmRpdGlvbmFsbHlFbWl0RXZlbnQoKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2F0d2Fsay5ldmVudHMucmVmcmVzaCA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgLy8gV2UncmUgYWxsIGRvbmUhXG4gICAgICAgICAgICAgICAgY2F0d2Fsay5ldmVudHMucmVmcmVzaCgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNsZWFuTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGNsZWFuTW9kZWwobW9kZWwpIHtcblxuICAgICAgICAgICAgdmFyIGNsZWFuZWRNb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbCkuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgPT09IENBVFdBTEtfTUVUQV9QUk9QRVJUWSkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIENhdHdhbGsgbWV0YSBkYXRhIHNob3VsZCBuZXZlciBiZSBwZXJzaXN0ZWQgdG8gdGhlIGJhY2stZW5kLlxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgaWYgdGhlIHByb3BlcnR5IGlzIGFjdHVhbGx5IGEgcmVsYXRpb25zaGlwLCB3aGljaCB3ZSBuZWVkIHRvIHJlc29sdmUgdG9cbiAgICAgICAgICAgICAgICAvLyBpdHMgcHJpbWl0aXZlIHZhbHVlKHMpLlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciByZWxhdGlvbnNoaXBGdW5jdGlvbiA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocmVsYXRpb25zaGlwRnVuY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFuZWRNb2RlbFtwcm9wZXJ0eV0gPSByZWxhdGlvbnNoaXBGdW5jdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXSAmJiBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLm9yaWdpbmFsVmFsdWVzW3Byb3BlcnR5XSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIGRpc2NvdmVyZWQgYSB0eXBlY2FzdGVkIHByb3BlcnR5IHRoYXQgbmVlZHMgdG8gYmUgcmV2ZXJ0ZWQgdG8gaXRzIG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB2YWx1ZSBiZWZvcmUgaW52b2tpbmcgdGhlIGNhbGxiYWNrLlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYW5lZE1vZGVsW3Byb3BlcnR5XSA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ub3JpZ2luYWxWYWx1ZXNbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNsZWFuZWRNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gY2xlYW5lZE1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBCbHVlcHJpbnRNb2RlbFxuICAgICAqL1xuICAgIGNsYXNzIEJsdWVwcmludE1vZGVsIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBibHVlcHJpbnQge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7Qmx1ZXByaW50TW9kZWx9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcihuYW1lLCBibHVlcHJpbnQpIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSAgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tb2RlbCA9IE9iamVjdC5mcmVlemUoYmx1ZXByaW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb252ZW5pZW5jZSBtZXRob2QgdGhhdCB3cmFwcyBgaXRlcmF0ZVByb3BlcnRpZXNgIGFuZCBgaXRlcmF0ZUJsdWVwcmludGAgaW50byBhIG9uZS1saW5lci5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBpdGVyYXRlQWxsXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGl0ZXJhdGVBbGwocHJvcGVydGllcykge1xuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5pdGVyYXRlUHJvcGVydGllcyhwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLml0ZXJhdGVCbHVlcHJpbnQobW9kZWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciBpdGVyYXRpbmcgb3ZlciB0aGUgcGFzc2VkIGluIG1vZGVsIHByb3BlcnRpZXMgdG8gZW5zdXJlIHRoZXkncmUgaW4gdGhlIGJsdWVwcmludCxcbiAgICAgICAgICogYW5kIHR5cGVjYXN0aW5nIHRoZSBwcm9wZXJ0aWVzIGJhc2VkIG9uIHRoZSBkZWZpbmUgYmx1ZXByaW50IGZvciB0aGUgY3VycmVudCBjb2xsZWN0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIGl0ZXJhdGVQcm9wZXJ0aWVzXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGl0ZXJhdGVQcm9wZXJ0aWVzKHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgdmFyIG1vZGVsID0ge307XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlICAgICAgICAgICA9IHByb3BlcnRpZXNbcHJvcGVydHldLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSAhPT0gQ0FUV0FMS19NRVRBX1BST1BFUlRZICYmIHR5cGVvZiBwcm9wZXJ0eUhhbmRsZXIgPT09ICd1bmRlZmluZWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUHJvcGVydHkgZG9lc24ndCBiZWxvbmcgaW4gdGhlIG1vZGVsIGJlY2F1c2UgaXQncyBub3QgaW4gdGhlIGJsdWVwcmludC5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5yZWxhdGlvbnNoaXBIYW5kbGVyKHByb3BlcnR5SGFuZGxlcik7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbCwgcHJvcGVydHksIHByb3BlcnR5SGFuZGxlci5kZWZpbmVSZWxhdGlvbnNoaXAodGhpcy5uYW1lLCBwcm9wZXJ0eSkpO1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIuc2V0VmFsdWVzKHByb3BlcnRpZXNbcHJvcGVydHldKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydGllc1tDQVRXQUxLX01FVEFfUFJPUEVSVFldKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBvcmlnaW5hbCB2YWx1ZSBvZiB0aGUgcmVsYXRpb25zaGlwIHRvIHJlc29sdmUgd2hlbiBjbGVhbmluZyB0aGUgbW9kZWwuXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcGVydHlIYW5kbGVyLnZhbHVlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eUhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBUeXBlY2FzdCBwcm9wZXJ0eSB0byB0aGUgZGVmaW5lZCB0eXBlLlxuICAgICAgICAgICAgICAgICAgICB2YXIgb3JpZ2luYWxWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHByb3BlcnR5SGFuZGxlcih2YWx1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhdHdhbGsucmV2ZXJ0VHlwZWNhc3QgJiYgb3JpZ2luYWxWYWx1ZSAhPT0gdmFsdWUpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIG9yaWdpbmFsIHZhbHVlIHNvIHRoYXQgd2UgY2FuIHJldmVydCBpdCBmb3Igd2hlbiBpbnZva2luZyB0aGUgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdpdGggdGhlIGBjbGVhbk1vZGVsYCBtZXRob2QuXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ub3JpZ2luYWxWYWx1ZXNbcHJvcGVydHldID0gb3JpZ2luYWxWYWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSB2YWx1ZTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciBpdGVyYXRpbmcgb3ZlciB0aGUgYmx1ZXByaW50IHRvIGRldGVybWluZSBpZiBhbnkgcHJvcGVydGllcyBhcmUgbWlzc2luZ1xuICAgICAgICAgKiBmcm9tIHRoZSBjdXJyZW50IG1vZGVsLCB0aGF0IGhhdmUgYmVlbiBkZWZpbmVkIGluIHRoZSBibHVlcHJpbnQgYW5kIHRoZXJlZm9yZSBzaG91bGQgYmVcbiAgICAgICAgICogcHJlc2VudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBpdGVyYXRlQmx1ZXByaW50XG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlQmx1ZXByaW50KG1vZGVsKSB7XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHRoaXMubW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtb2RlbFtwcm9wZXJ0eV0gPT09ICd1bmRlZmluZWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRW5zdXJlIHRoYXQgaXQgaXMgZGVmaW5lZC5cbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldICAgICA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMucmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydHlIYW5kbGVyLmRlZmluZVJlbGF0aW9uc2hpcCh0aGlzLm5hbWUsIHByb3BlcnR5KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIuc2V0VmFsdWVzKFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm1vZGVsW3Byb3BlcnR5XSA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgaWYgdGhlIHByb3BlcnR5IGhhcyBhIHByb3BlcnR5IGhhbmRsZXIgbWV0aG9kIHdoaWNoIHdvdWxkIGJlIHJlc3BvbnNpYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgdHlwZWNhc3RpbmcsIGFuZCBkZXRlcm1pbmluZyB0aGUgZGVmYXVsdCB2YWx1ZS5cbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSA9IHByb3BlcnR5SGFuZGxlcigpO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciByZWl0ZXJhdGluZyBvdmVyIHRoZSBtb2RlbCB0byBvbmNlIGFnYWluIHR5cGVjYXN0IHRoZSB2YWx1ZXM7IHdoaWNoIGlzXG4gICAgICAgICAqIGVzcGVjaWFsbHkgdXNlZnVsIGZvciB3aGVuIHRoZSBtb2RlbCBoYXMgYmVlbiB1cGRhdGVkLCBidXQgcmVsYXRpb25zaGlwcyBuZWVkIHRvIGJlIGxlZnRcbiAgICAgICAgICogYWxvbmUuIFNpbmNlIHRoZSBtb2RlbCBpcyBzZWFsZWQgd2UgY2FuIGFsc28gZ3VhcmFudGVlIHRoYXQgbm8gb3RoZXIgcHJvcGVydGllcyBoYXZlIGJlZW5cbiAgICAgICAgICogYWRkZWQgaW50byB0aGUgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgcmVpdGVyYXRlUHJvcGVydGllc1xuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgcmVpdGVyYXRlUHJvcGVydGllcyhtb2RlbCkge1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RlbCkuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcblxuICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcHJvcGVydHlIYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSA9IHByb3BlcnR5SGFuZGxlcihtb2RlbFtwcm9wZXJ0eV0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciBpbnN0YW50aWF0aW5nIGEgbmV3IHJlbGF0aW9uc2hpcCBwZXIgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgcmVsYXRpb25zaGlwSGFuZGxlclxuICAgICAgICAgKiBAdGhyb3dzIEV4Y2VwdGlvblxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydHlIYW5kbGVyIHtSZWxhdGlvbnNoaXBBYnN0cmFjdH1cbiAgICAgICAgICogQHJldHVybiB7UmVsYXRpb25zaGlwQWJzdHJhY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZWxhdGlvbnNoaXBIYW5kbGVyKHByb3BlcnR5SGFuZGxlcikge1xuXG4gICAgICAgICAgICB2YXIgaW5zdGFudGlhdGVQcm9wZXJ0aWVzID0gW3Byb3BlcnR5SGFuZGxlci50YXJnZXQua2V5LCBwcm9wZXJ0eUhhbmRsZXIudGFyZ2V0LmNvbGxlY3Rpb25dO1xuXG4gICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUmVsYXRpb25zaGlwSGFzTWFueSguLi5pbnN0YW50aWF0ZVByb3BlcnRpZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzT25lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNPbmUoLi4uaW5zdGFudGlhdGVQcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2hvdWxkIGJlIHVucmVhY2hhYmxlLi4uXG4gICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKCdJbnZhbGlkIHJlbGF0aW9uc2hpcCB0eXBlJyk7XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFR5cGVjYXN0XG4gICAgICovXG4gICAgY2xhc3MgVHlwZWNhc3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJldHVyblZhbHVlXG4gICAgICAgICAqIEBwYXJhbSB0eXBlY2FzdENvbnN0cnVjdG9yIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHBhcmFtIHZhbHVlIHsqfVxuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHsqfVxuICAgICAgICAgKiBAcmV0dXJuIHsqfVxuICAgICAgICAgKi9cbiAgICAgICAgcmV0dXJuVmFsdWUodHlwZWNhc3RDb25zdHJ1Y3RvciwgdmFsdWUsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVjYXN0Q29uc3RydWN0b3IodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJyA/IHZhbHVlIDogZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHN0cmluZ1xuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgc3RyaW5nKGRlZmF1bHRWYWx1ZSA9ICcnKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShTdHJpbmcsIHZhbHVlLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgYm9vbGVhblxuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHtCb29sZWFufVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGJvb2xlYW4oZGVmYXVsdFZhbHVlID0gdHJ1ZSkge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoQm9vbGVhbiwgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBudW1iZXJcbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIG51bWJlcihkZWZhdWx0VmFsdWUgPSAwKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShOdW1iZXIsIHZhbHVlLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIG1ldGhvZCBhdXRvSW5jcmVtZW50XG4gICAgICAgICAqIEBwYXJhbSBpbml0aWFsVmFsdWUge051bWJlcn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBhdXRvSW5jcmVtZW50KGluaXRpYWxWYWx1ZSA9IDEpIHtcblxuICAgICAgICAgICAgcmV0dXJuICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKGluaXRpYWxWYWx1ZSsrKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGN1c3RvbVxuICAgICAgICAgKiBAcGFyYW0gdHlwZWNhc3RGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY3VzdG9tKHR5cGVjYXN0Rm4pIHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlY2FzdEZuO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwXG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBoYXNPbmVcbiAgICAgICAgICogQHBhcmFtIGZvcmVpZ25LZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge1JlbGF0aW9uc2hpcEhhc09uZX1cbiAgICAgICAgICovXG4gICAgICAgIGhhc09uZShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNPbmUoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaGFzTWFueVxuICAgICAgICAgKiBAcGFyYW0gZm9yZWlnbktleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7UmVsYXRpb25zaGlwSGFzTWFueX1cbiAgICAgICAgICovXG4gICAgICAgIGhhc01hbnkoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUmVsYXRpb25zaGlwSGFzTWFueShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBBYnN0cmFjdFxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcEFic3RyYWN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEBwYXJhbSBmb3JlaWduS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpIHtcblxuICAgICAgICAgICAgdGhpcy50YXJnZXQgPSB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAga2V5OiBmb3JlaWduS2V5XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzZXRWYWx1ZXNcbiAgICAgICAgICogQHBhcmFtIHZhbHVlcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0VmFsdWVzKHZhbHVlcykge1xuICAgICAgICAgICAgdGhpcy52YWx1ZXMgPSB0aGlzLnZhbHVlID0gdmFsdWVzO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVmaW5lUmVsYXRpb25zaGlwXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGFjY2Vzc29yRnVuY3Rpb25zIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSwgYWNjZXNzb3JGdW5jdGlvbnMpIHtcblxuICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAga2V5OiBsb2NhbEtleVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBnZXQ6IGFjY2Vzc29yRnVuY3Rpb25zLmdldCxcbiAgICAgICAgICAgICAgICBzZXQ6IGFjY2Vzc29yRnVuY3Rpb25zLnNldCxcbiAgICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEhhc01hbnlcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXBIYXNNYW55IGV4dGVuZHMgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlZmluZVJlbGF0aW9uc2hpcFxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXkpIHtcblxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXksIHtcbiAgICAgICAgICAgICAgICBnZXQ6IHRoaXMuZ2V0TW9kZWxzLmJpbmQodGhpcyksXG4gICAgICAgICAgICAgICAgc2V0OiB0aGlzLnNldE1vZGVscy5iaW5kKHRoaXMpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZ2V0TW9kZWxzXG4gICAgICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TW9kZWxzKCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgbG9hZE1vZGVsc1xuICAgICAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBsb2FkTW9kZWxzID0gKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcmVpZ25Db2xsZWN0aW9uLm1vZGVscy5maWx0ZXIoKGZvcmVpZ25Nb2RlbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZXMuaW5kZXhPZihmb3JlaWduTW9kZWxbdGhpcy50YXJnZXQua2V5XSkgIT09IC0xO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgYXJyYXlEaWZmXG4gICAgICAgICAgICAgKiBAcGFyYW0gZmlyc3RBcnJheSB7QXJyYXl9XG4gICAgICAgICAgICAgKiBAcGFyYW0gc2Vjb25kQXJyYXkge0FycmF5fVxuICAgICAgICAgICAgICogQHJldHVybiB7Kn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGFycmF5RGlmZiA9IChmaXJzdEFycmF5LCBzZWNvbmRBcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaXJzdEFycmF5LmZpbHRlcigoaW5kZXgpID0+IHNlY29uZEFycmF5LmluZGV4T2YoaW5kZXgpIDwgMClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBmb3JlaWduQ29sbGVjdGlvbiA9IGNhdHdhbGsuY29sbGVjdGlvbih0aGlzLnRhcmdldC5jb2xsZWN0aW9uKSxcbiAgICAgICAgICAgICAgICBtb2RlbHMgICAgICAgICAgICA9IGxvYWRNb2RlbHMoKTtcblxuICAgICAgICAgICAgLy8gSWYgdGhlcmUgaXMgYSBkaXNjcmVwYW5jeSBiZXR3ZWVuIHRoZSBjb3VudHMsIHRoZW4gd2Uga25vdyBhbGwgdGhlIG1vZGVscyBoYXZlbid0IGJlZW4gbG9hZGVkLlxuICAgICAgICAgICAgaWYgKG1vZGVscy5sZW5ndGggIT09IHRoaXMudmFsdWVzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAgICAgLy8gRGlzY292ZXIgdGhlIGtleXMgdGhhdCBhcmUgY3VycmVudGx5IG5vdCBsb2FkZWQuXG4gICAgICAgICAgICAgICAgdmFyIGxvYWRlZEtleXMgICA9IG1vZGVscy5tYXAobW9kZWwgPT4gbW9kZWxbdGhpcy50YXJnZXQua2V5XSksXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkS2V5cyA9IGFycmF5RGlmZih0aGlzLnZhbHVlcywgbG9hZGVkS2V5cyk7XG5cbiAgICAgICAgICAgICAgICByZXF1aXJlZEtleXMuZm9yRWFjaCgoZm9yZWlnbktleSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciByZXF1aXJlZE1vZGVsID0ge307XG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkTW9kZWxbdGhpcy50YXJnZXQua2V5XSA9IGZvcmVpZ25LZXk7XG4gICAgICAgICAgICAgICAgICAgIGZvcmVpZ25Db2xsZWN0aW9uLnJlYWRNb2RlbChyZXF1aXJlZE1vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZWFkIHRoZSBtb2RlbHMgYWdhaW4gaW1tZWRpYXRlbHkuXG4gICAgICAgICAgICAgICAgbW9kZWxzID0gbG9hZE1vZGVscygpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbHM7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNldE1vZGVsc1xuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0TW9kZWxzKHZhbHVlcykge1xuICAgICAgICAgICAgdGhpcy52YWx1ZXMgPSB2YWx1ZXM7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBIYXNPbmVcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXBIYXNPbmUgZXh0ZW5kcyBSZWxhdGlvbnNoaXBBYnN0cmFjdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVmaW5lUmVsYXRpb25zaGlwXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSkge1xuXG4gICAgICAgICAgICByZXR1cm4gc3VwZXIuZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSwge1xuICAgICAgICAgICAgICAgIGdldDogdGhpcy5nZXRNb2RlbC5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgICAgIHNldDogdGhpcy5zZXRNb2RlbC5iaW5kKHRoaXMpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZ2V0TW9kZWxcbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TW9kZWwoKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBsb2FkTW9kZWxcbiAgICAgICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGxvYWRNb2RlbCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZm9yZWlnbkNvbGxlY3Rpb24ubW9kZWxzLmZpbmQoKGZvcmVpZ25Nb2RlbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy52YWx1ZSA9PT0gZm9yZWlnbk1vZGVsW3RoaXMudGFyZ2V0LmtleV07XG4gICAgICAgICAgICAgICAgfSk7ICBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBmb3JlaWduQ29sbGVjdGlvbiA9IGNhdHdhbGsuY29sbGVjdGlvbih0aGlzLnRhcmdldC5jb2xsZWN0aW9uKSxcbiAgICAgICAgICAgICAgICBtb2RlbCAgICAgICAgICAgICA9IGxvYWRNb2RlbCgpO1xuXG4gICAgICAgICAgICBpZiAoIW1vZGVsKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBjYW5ub3QgYmUgZm91bmQgYW5kIHRoZXJlZm9yZSB3ZSdsbCBhdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVsIGludG8gdGhlIGNvbGxlY3Rpb24uXG4gICAgICAgICAgICAgICAgdmFyIHJlcXVpcmVkTW9kZWwgICA9IHt9O1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkTW9kZWxbdGhpcy50YXJnZXQua2V5XSA9IHRoaXMudmFsdWU7XG4gICAgICAgICAgICAgICAgZm9yZWlnbkNvbGxlY3Rpb24ucmVhZE1vZGVsKHJlcXVpcmVkTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byByZWFkIHRoZSBtb2RlbCBhZ2FpbiBpbW1lZGlhdGVseS5cbiAgICAgICAgICAgICAgICBtb2RlbCA9IGxvYWRNb2RlbCgpO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2V0TW9kZWxcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNldE1vZGVsKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBUcmFuc2FjdGlvblxuICAgICAqL1xuICAgIGNsYXNzIFRyYW5zYWN0aW9uIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEByZXR1cm4ge1RyYW5zYWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IoKSB7XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWxzICAgID0gW107XG4gICAgICAgICAgICB0aGlzLnJlc29sdmVGbiA9ICgpID0+IHt9O1xuXG4gICAgICAgICAgICAvLyBGbHVzaCB0aGUgcHJvbWlzZXMgaW4gdGhlIHN1YnNlcXVlbnQgcnVuLWxvb3AuXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZmx1c2gsIDEpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhZGRcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9taXNlIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBhZGQobW9kZWwsIHByb21pc2UpIHtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2goeyBtb2RlbDogbW9kZWwsIHByb21pc2U6IHByb21pc2UgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXNvbHZlXG4gICAgICAgICAqIEBwYXJhbSByZXNvbHZlRm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgcmVzb2x2ZShyZXNvbHZlRm4pIHtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZUZuID0gcmVzb2x2ZUZuO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZmx1c2hcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGZsdXNoKCkge1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlRm4odGhpcy5tb2RlbHMpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBJbnN0YW50aWF0ZSB0aGUgQ2F0d2FsayBjbGFzcy5cbiAgICAkd2luZG93LmNhdHdhbGsgICAgICAgID0gbmV3IENhdHdhbGsoKTtcbiAgICAkd2luZG93LmNhdHdhbGsuTUVUQSAgID0gQ0FUV0FMS19NRVRBX1BST1BFUlRZO1xuICAgICR3aW5kb3cuY2F0d2Fsay5TVEFURVMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTO1xuXG59KSh3aW5kb3cpOyIsInZhciAkX19wbGFjZWhvbGRlcl9fMCA9ICRfX3BsYWNlaG9sZGVyX18xIiwiKCR0cmFjZXVyUnVudGltZS5jcmVhdGVDbGFzcykoJF9fcGxhY2Vob2xkZXJfXzAsICRfX3BsYWNlaG9sZGVyX18xLCAkX19wbGFjZWhvbGRlcl9fMikiLCIkdHJhY2V1clJ1bnRpbWUuc3ByZWFkKCRfX3BsYWNlaG9sZGVyX18wKSIsIiR0cmFjZXVyUnVudGltZS5kZWZhdWx0U3VwZXJDYWxsKHRoaXMsXG4gICAgICAgICAgICAgICAgJF9fcGxhY2Vob2xkZXJfXzAucHJvdG90eXBlLCBhcmd1bWVudHMpIiwidmFyICRfX3BsYWNlaG9sZGVyX18wID0gJF9fcGxhY2Vob2xkZXJfXzEiLCIoJHRyYWNldXJSdW50aW1lLmNyZWF0ZUNsYXNzKSgkX19wbGFjZWhvbGRlcl9fMCwgJF9fcGxhY2Vob2xkZXJfXzEsICRfX3BsYWNlaG9sZGVyX18yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJF9fcGxhY2Vob2xkZXJfXzMpIiwiJHRyYWNldXJSdW50aW1lLnN1cGVyQ2FsbCgkX19wbGFjZWhvbGRlcl9fMCwgJF9fcGxhY2Vob2xkZXJfXzEsICRfX3BsYWNlaG9sZGVyX18yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMykiXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=