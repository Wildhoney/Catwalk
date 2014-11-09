"use strict";
(function($window) {
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
    createCollection: function(name, properties) {
      var collection = new Collection(name, properties);
      this.collections[name] = collection;
      return collection;
    },
    collection: function(name) {
      if (typeof this.collections[name] === 'undefined') {
        this.throwException(("Unable to find collection \"" + name + "\""));
      }
      return this.collections[name];
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
      } catch (e) {}
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
      ((function() {
        if (didDeleteViaReference) {
          return;
        }
        var index = 0;
        $__0.models.forEach((function(currentModel) {
          if (currentModel[CATWALK_META_PROPERTY].id === model[CATWALK_META_PROPERTY].id) {
            remove(currentModel, index);
          }
          index++;
        }));
      }))();
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
        catwalk.events[eventName]($__0.name, $__0.cleanModel(currentModel || previousModel), {
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
        propertyHandler = new (Function.prototype.bind.apply(RelationshipHasMany, $traceurRuntime.spread([null], instantiateProperties)))();
      } else if (propertyHandler instanceof RelationshipHasOne) {
        propertyHandler = new (Function.prototype.bind.apply(RelationshipHasOne, $traceurRuntime.spread([null], instantiateProperties)))();
      }
      return propertyHandler;
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
  $window.catwalk = new Catwalk();
  $window.catwalk.STATES = CATWALK_STATES_PROPERTIES;
})(window);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNhdHdhbGsuanMiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMSIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci8yIiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzciLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvNCIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci82IiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzUiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLEFBQUMsU0FBUyxPQUFNO0FBRVosYUFBVyxDQUFDO0lBTU4sQ0FBQSxxQkFBb0IsRUFBSSxZQUFVO0lBTWxDLENBQUEseUJBQXdCLEVBQUk7QUFBRSxNQUFFLENBQUcsRUFBQTtBQUFHLFFBQUksQ0FBRyxFQUFBO0FBQUcsUUFBSSxDQUFHLEVBQUE7QUFBRyxVQUFNLENBQUcsRUFBQTtBQUFBLEVBQUU7QUNkL0UsQUFBSSxJQUFBLFVEbUJBLFNBQU0sUUFBTSxDQU1HLEFBQUMsQ0FBRTtBQUNWLE9BQUcsT0FBTyxFQUFZLEdBQUMsQ0FBQztBQUN4QixPQUFHLFlBQVksRUFBTyxHQUFDLENBQUM7QUFDeEIsT0FBRyxhQUFhLEVBQU0sSUFBSSxhQUFXLEFBQUMsRUFBQyxDQUFDO0FBQ3hDLE9BQUcsU0FBUyxFQUFVLElBQUksU0FBTyxBQUFDLEVBQUMsQ0FBQztBQUNwQyxPQUFHLGVBQWUsRUFBSSxLQUFHLENBQUM7RUM5QkUsQUQrQmhDLENDL0JnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUZxQ3JCLG1CQUFlLENBQWYsVUFBaUIsSUFBRyxDQUFHLENBQUEsVUFBUyxDQUFHO0FBRS9CLEFBQUksUUFBQSxDQUFBLFVBQVMsRUFBSSxJQUFJLFdBQVMsQUFBQyxDQUFDLElBQUcsQ0FBRyxX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VUFBVSxBQUFDLENBQUMsYUFBWSxDQUFDLENBQUM7QUFHMUMsWUFBSSxFQUFJLENBQUEsU0FBUSxBQUFDLEVBQUMsQ0FBQztNQUV2QjtBQUFBLEFBRUEsV0FBTyxNQUFJLENBQUM7SUFFaEI7QUFNQSxXQUFPLENBQVAsVUFBUyxLQUFJLENBQUc7QUFDWixTQUFHLE1BQU0sRUFBSSxNQUFJLENBQUM7SUFDdEI7QUFBQSxPQTFENkIscUJBQW1CLENNLytCQTtBTjhpQ3BELFFBQU0sUUFBUSxFQUFXLElBQUksUUFBTSxBQUFDLEVBQUMsQ0FBQztBQUN0QyxRQUFNLFFBQVEsT0FBTyxFQUFJLDBCQUF3QixDQUFDO0FBRXRELENBQUMsQUFBQyxDQUFDLE1BQUssQ0FBQyxDQUFDO0FBQUEiLCJmaWxlIjoiY2F0d2Fsay5lczUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oJHdpbmRvdykge1xuXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvKipcbiAgICAgKiBAY29uc3RhbnQgQ0FUV0FMS19NRVRBX1BST1BFUlRZXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICBjb25zdCBDQVRXQUxLX01FVEFfUFJPUEVSVFkgPSAnX19jYXR3YWxrJztcblxuICAgIC8qKlxuICAgICAqIEBjb25zdGFudCBDQVRXQUxLX1NUQVRFX1BST1BFUlRJRVNcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIGNvbnN0IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMgPSB7IE5FVzogMSwgRElSVFk6IDIsIFNBVkVEOiA0LCBERUxFVEVEOiA4IH07XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgQ2F0d2Fsa1xuICAgICAqL1xuICAgIGNsYXNzIENhdHdhbGsge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHJldHVybiB7Q2F0d2Fsa31cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudHMgICAgICAgICA9IHt9O1xuICAgICAgICAgICAgdGhpcy5jb2xsZWN0aW9ucyAgICA9IHt9O1xuICAgICAgICAgICAgdGhpcy5yZWxhdGlvbnNoaXAgICA9IG5ldyBSZWxhdGlvbnNoaXAoKTtcbiAgICAgICAgICAgIHRoaXMudHlwZWNhc3QgICAgICAgPSBuZXcgVHlwZWNhc3QoKTtcbiAgICAgICAgICAgIHRoaXMucmV2ZXJ0VHlwZWNhc3QgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3JlYXRlQ29sbGVjdGlvblxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY3JlYXRlQ29sbGVjdGlvbihuYW1lLCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIHZhciBjb2xsZWN0aW9uID0gbmV3IENvbGxlY3Rpb24obmFtZSwgcHJvcGVydGllcyk7XG4gICAgICAgICAgICB0aGlzLmNvbGxlY3Rpb25zW25hbWVdID0gY29sbGVjdGlvbjtcbiAgICAgICAgICAgIHJldHVybiBjb2xsZWN0aW9uO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjb2xsZWN0aW9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjb2xsZWN0aW9uKG5hbWUpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmNvbGxlY3Rpb25zW25hbWVdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIHRoaXMudGhyb3dFeGNlcHRpb24oYFVuYWJsZSB0byBmaW5kIGNvbGxlY3Rpb24gXCIke25hbWV9XCJgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbnNbbmFtZV07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJldmVydENhbGxiYWNrVHlwZWNhc3RcbiAgICAgICAgICogQHBhcmFtIHNldHRpbmcge0Jvb2xlYW59XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICByZXZlcnRDYWxsYmFja1R5cGVjYXN0KHNldHRpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucmV2ZXJ0VHlwZWNhc3QgPSAhIXNldHRpbmc7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCB0aHJvd0V4Y2VwdGlvblxuICAgICAgICAgKiBAdGhyb3dzIEV4Y2VwdGlvblxuICAgICAgICAgKiBAcGFyYW0gbWVzc2FnZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhyb3dFeGNlcHRpb24obWVzc2FnZSkge1xuICAgICAgICAgICAgdGhyb3cgYENhdHdhbGs6ICR7bWVzc2FnZX0uYDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIG9uXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBldmVudEZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIG9uKG5hbWUsIGV2ZW50Rm4pIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzW25hbWVdID0gZXZlbnRGbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIG9mZlxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgb2ZmKG5hbWUpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50c1tuYW1lXTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIENvbGxlY3Rpb25cbiAgICAgKi9cbiAgICBjbGFzcyBDb2xsZWN0aW9uIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEBwYXJhbSBuYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcihuYW1lLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB0aGlzLmlkICAgICAgICA9IDA7XG4gICAgICAgICAgICB0aGlzLm5hbWUgICAgICA9IG5hbWU7XG4gICAgICAgICAgICB0aGlzLm1vZGVscyAgICA9IFtdO1xuICAgICAgICAgICAgdGhpcy5zaWxlbnQgICAgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuYmx1ZXByaW50ID0gbmV3IEJsdWVwcmludE1vZGVsKG5hbWUsIHByb3BlcnRpZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2lsZW50bHlcbiAgICAgICAgICogQHBhcmFtIHNpbGVudEZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNpbGVudGx5KHNpbGVudEZuKSB7XG4gICAgICAgICAgICB0aGlzLnNpbGVudCA9IHRydWU7XG4gICAgICAgICAgICBzaWxlbnRGbi5hcHBseSh0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc2lsZW50ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gW3Byb3BlcnRpZXM9e31dIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZU1vZGVsKHByb3BlcnRpZXMgPSB7fSkge1xuXG4gICAgICAgICAgICB0aGlzLmluamVjdE1ldGEocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgbW9kZWwgY29uZm9ybXMgdG8gdGhlIGJsdWVwcmludC5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuYmx1ZXByaW50Lml0ZXJhdGVBbGwocHJvcGVydGllcyk7XG5cbiAgICAgICAgICAgIE9iamVjdC5zZWFsKG1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2NyZWF0ZScsIG1vZGVsLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVhZE1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlYWRNb2RlbChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB0aGlzLmlzc3VlUHJvbWlzZSgncmVhZCcsIHByb3BlcnRpZXMsIG51bGwpO1xuICAgICAgICAgICAgcmV0dXJuIHByb3BlcnRpZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCB1cGRhdGVNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgdXBkYXRlTW9kZWwobW9kZWwsIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgY29weSBvZiB0aGUgb2xkIG1vZGVsIGZvciByb2xsaW5nIGJhY2suXG4gICAgICAgICAgICB2YXIgcHJldmlvdXNNb2RlbCA9IHt9O1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4gcHJldmlvdXNNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtwcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICB0cnkge1xuXG4gICAgICAgICAgICAgICAgLy8gQ29weSBhY3Jvc3MgdGhlIGRhdGEgZnJvbSB0aGUgcHJvcGVydGllcy4gV2Ugd3JhcCB0aGUgYXNzaWdubWVudCBpbiBhIHRyeS1jYXRjaCBibG9ja1xuICAgICAgICAgICAgICAgIC8vIGJlY2F1c2UgaWYgdGhlIHVzZXIgaGFzIGFkZGVkIGFueSBhZGRpdGlvbmFsIHByb3BlcnRpZXMgdGhhdCBkb24ndCBiZWxvbmcgaW4gdGhlIG1vZGVsLFxuICAgICAgICAgICAgICAgIC8vIGFuIGV4Y2VwdGlvbiB3aWxsIGJlIHJhaXNlZCBiZWNhdXNlIHRoZSBvYmplY3QgaXMgc2VhbGVkLlxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZvckVhY2gocHJvcGVydHkgPT4gbW9kZWxbcHJvcGVydHldID0gcHJvcGVydGllc1twcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkge31cblxuXG4gICAgICAgICAgICAvLyBUeXBlY2FzdCB0aGUgdXBkYXRlZCBtb2RlbCBhbmQgY29weSBhY3Jvc3MgaXRzIHByb3BlcnRpZXMgdG8gdGhlIGN1cnJlbnQgbW9kZWwsIHNvIGFzIHdlXG4gICAgICAgICAgICAvLyBkb24ndCBicmVhayBhbnkgcmVmZXJlbmNlcy5cbiAgICAgICAgICAgIHZhciB0eXBlY2FzdE1vZGVsID0gdGhpcy5ibHVlcHJpbnQucmVpdGVyYXRlUHJvcGVydGllcyhtb2RlbCk7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0eXBlY2FzdE1vZGVsKS5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSB0eXBlY2FzdE1vZGVsW3Byb3BlcnR5XVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ3VwZGF0ZScsIG1vZGVsLCBwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVsZXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlbGV0ZU1vZGVsKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCByZW1vdmVcbiAgICAgICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgICAgICogQHBhcmFtIGluZGV4IHtOdW1iZXJ9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciByZW1vdmUgPSAobW9kZWwsIGluZGV4KSA9PiB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmlzc3VlUHJvbWlzZSgnZGVsZXRlJywgbnVsbCwgbW9kZWwpO1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLnNwbGljZShpbmRleCwgMSk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBtb2RlbCB3YXMgc3VjY2Vzc2Z1bGx5IGRlbGV0ZWQgd2l0aCBmaW5kaW5nIHRoZSBtb2RlbCBieSByZWZlcmVuY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHByb3BlcnR5IGRpZERlbGV0ZVZpYVJlZmVyZW5jZVxuICAgICAgICAgICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBkaWREZWxldGVWaWFSZWZlcmVuY2UgPSBmYWxzZTtcblxuICAgICAgICAgICAgKCgpID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBtb2RlbCBieSByZWZlcmVuY2UuXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5tb2RlbHMuaW5kZXhPZihtb2RlbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpZERlbGV0ZVZpYVJlZmVyZW5jZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZSh0aGlzLm1vZGVsc1tpbmRleF0sIGluZGV4KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pKCk7XG5cbiAgICAgICAgICAgICgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAoZGlkRGVsZXRlVmlhUmVmZXJlbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSAwO1xuXG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgdGhlIG1vZGVsIGJ5IGl0cyBpbnRlcm5hbCBDYXR3YWxrIElELlxuICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLmZvckVhY2goKGN1cnJlbnRNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5pZCA9PT0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5pZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlKGN1cnJlbnRNb2RlbCwgaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaW5kZXgrKztcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGFkZEFzc29jaWF0aW9uXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydHkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge0FycmF5fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBhZGRBc3NvY2lhdGlvbihtb2RlbCwgcHJvcGVydHksIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgaWYgKCEodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkpIHtcbiAgICAgICAgICAgICAgICBjYXR3YWxrLnRocm93RXhjZXB0aW9uKCdVc2luZyBgYWRkQXNzb2NpYXRpb25gIHJlcXVpcmVzIGEgaGFzTWFueSByZWxhdGlvbnNoaXAnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGN1cnJlbnRQcm9wZXJ0aWVzID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldKCk7XG4gICAgICAgICAgICBjdXJyZW50UHJvcGVydGllcyAgICAgPSBjdXJyZW50UHJvcGVydGllcy5jb25jYXQocHJvcGVydGllcyk7XG4gICAgICAgICAgICB2YXIgdXBkYXRlRGF0YSAgICAgICAgPSB7fTtcbiAgICAgICAgICAgIHVwZGF0ZURhdGFbcHJvcGVydHldICA9IGN1cnJlbnRQcm9wZXJ0aWVzO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudXBkYXRlTW9kZWwobW9kZWwsIHVwZGF0ZURhdGEpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZW1vdmVBc3NvY2lhdGlvblxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnR5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtBcnJheX1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQXNzb2NpYXRpb24obW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIGlmICghKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc01hbnkpKSB7XG4gICAgICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignVXNpbmcgYHJlbW92ZUFzc29jaWF0aW9uYCByZXF1aXJlcyBhIGhhc01hbnkgcmVsYXRpb25zaGlwJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjdXJyZW50UHJvcGVydGllcyA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XSgpO1xuXG4gICAgICAgICAgICBwcm9wZXJ0aWVzLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gY3VycmVudFByb3BlcnRpZXMuaW5kZXhPZihwcm9wZXJ0eSk7XG4gICAgICAgICAgICAgICAgY3VycmVudFByb3BlcnRpZXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2YXIgdXBkYXRlRGF0YSAgICAgICAgPSB7fTtcbiAgICAgICAgICAgIHVwZGF0ZURhdGFbcHJvcGVydHldICA9IGN1cnJlbnRQcm9wZXJ0aWVzO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudXBkYXRlTW9kZWwobW9kZWwsIHVwZGF0ZURhdGEpO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBpbmplY3RNZXRhXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpbmplY3RNZXRhKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0gPSB7XG4gICAgICAgICAgICAgICAgaWQ6ICsrdGhpcy5pZCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuTkVXLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVmFsdWVzOiB7fSxcbiAgICAgICAgICAgICAgICByZWxhdGlvbnNoaXBWYWx1ZXM6IHt9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGlzc3VlUHJvbWlzZVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnROYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjdXJyZW50TW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByZXZpb3VzTW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGlzc3VlUHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5zaWxlbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2F0d2Fsay5ldmVudHNbZXZlbnROYW1lXSAhPT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgLy8gQ2FsbGJhY2sgaGFzIG5vdCBhY3R1YWxseSBiZWVuIHNldC11cCBhbmQgdGhlcmVmb3JlIG1vZGVscyB3aWxsIG5ldmVyIGJlXG4gICAgICAgICAgICAgICAgLy8gcGVyc2lzdGVkLlxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBJc3N1ZSB0aGUgcHJvbWlzZSBmb3IgYmFjay1lbmQgcGVyc2lzdGVuY2Ugb2YgdGhlIG1vZGVsLlxuICAgICAgICAgICAgICAgIGNhdHdhbGsuZXZlbnRzW2V2ZW50TmFtZV0odGhpcy5uYW1lLCB0aGlzLmNsZWFuTW9kZWwoY3VycmVudE1vZGVsIHx8IHByZXZpb3VzTW9kZWwpLCB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmU6IHJlc29sdmUsIHJlamVjdDogcmVqZWN0XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH0pLnRoZW4oKHJlc29sdXRpb25QYXJhbXMpID0+IHtcblxuICAgICAgICAgICAgICAgIC8vIFByb21pc2UgaGFzIGJlZW4gcmVzb2x2ZWQhXG4gICAgICAgICAgICAgICAgdGhpcy5yZXNvbHZlUHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkocmVzb2x1dGlvblBhcmFtcyk7XG5cbiAgICAgICAgICAgIH0sIChyZXNvbHV0aW9uUGFyYW1zKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBQcm9taXNlIGhhcyBiZWVuIHJlamVjdGVkIVxuICAgICAgICAgICAgICAgIHRoaXMucmVqZWN0UHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkocmVzb2x1dGlvblBhcmFtcyk7XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXNvbHZlUHJvbWlzZVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnROYW1lIHtTdHJpbmd9IC0gRXZlbnQgbmFtZSBpcyBhY3R1YWxseSBub3QgcmVxdWlyZWQsIGJlY2F1c2Ugd2UgY2FuIGRlZHVjZSB0aGUgc3Vic2VxdWVudCBhY3Rpb25cbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb20gdGhlIHN0YXRlIG9mIHRoZSBgY3VycmVudE1vZGVsYCBhbmQgYHByZXZpb3VzTW9kZWxgLCBidXQgd2UgYWRkIGl0IHRvIGFkZFxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhcmlmaWNhdGlvbiB0byBvdXIgbG9naWNhbCBzdGVwcy5cbiAgICAgICAgICogQHBhcmFtIGN1cnJlbnRNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcGFyYW0gcHJldmlvdXNNb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHJlc29sdmVQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKSB7XG5cbiAgICAgICAgICAgIGlmIChjdXJyZW50TW9kZWwgJiYgZXZlbnROYW1lID09PSAnY3JlYXRlJykge1xuXG4gICAgICAgICAgICAgICAgLy8gTW9kZWwgaGFzIGJlZW4gc3VjY2Vzc2Z1bGx5IHBlcnNpc3RlZCFcbiAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLlNBVkVEO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFdoZW4gd2UncmUgaW4gdGhlIHByb2Nlc3Mgb2YgZGVsZXRpbmcgYSBtb2RlbCwgdGhlIGBjdXJyZW50TW9kZWxgIGlzIHVuc2V0OyBpbnN0ZWFkIHRoZVxuICAgICAgICAgICAgLy8gYHByZXZpb3VzTW9kZWxgIHdpbGwgYmUgZGVmaW5lZC5cbiAgICAgICAgICAgIGlmICgoY3VycmVudE1vZGVsID09PSBudWxsICYmIHByZXZpb3VzTW9kZWwpICYmIGV2ZW50TmFtZSA9PT0gJ2RlbGV0ZScpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1vZGVsIGhhcyBiZWVuIHN1Y2Nlc3NmdWxseSBkZWxldGVkIVxuICAgICAgICAgICAgICAgIHByZXZpb3VzTW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLkRFTEVURUQ7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIChwcm9wZXJ0aWVzKSA9PiB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydGllcyAmJiBldmVudE5hbWUgIT09ICdyZWFkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgIXByb3BlcnRpZXMuaGFzT3duUHJvcGVydHkoQ0FUV0FMS19NRVRBX1BST1BFUlRZKSAmJiBldmVudE5hbWUgPT09ICdyZWFkJykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLmNyZWF0ZU1vZGVsKHByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIG1vZGVsIHRvIHJlZmxlY3QgdGhlIGNoYW5nZXMgb24gdGhlIG9iamVjdCB0aGF0IGByZWFkTW9kZWxgIHJldHVybi5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBtb2RlbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNvbmRpdGlvbmFsbHlFbWl0RXZlbnQoKTtcblxuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVqZWN0UHJvbWlzZVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnROYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjdXJyZW50TW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByZXZpb3VzTW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICByZWplY3RQcm9taXNlKGV2ZW50TmFtZSwgY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCByZWplY3RXaXRoXG4gICAgICAgICAgICAgKiBAcGFyYW0gZHVwbGljYXRlTW9kZWwge09iamVjdH1cbiAgICAgICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciByZWplY3RXaXRoID0gKGR1cGxpY2F0ZU1vZGVsKSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAoZHVwbGljYXRlTW9kZWwpIHtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50TmFtZSA9PT0gJ3VwZGF0ZScgJiYgZHVwbGljYXRlTW9kZWwuaGFzT3duUHJvcGVydHkoQ0FUV0FMS19NRVRBX1BST1BFUlRZKSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXNlciBwYXNzZWQgaW4gYSBtb2RlbCBhbmQgdGhlcmVmb3JlIHRoZSBwcmV2aW91cyBzaG91bGQgYmUgZGVsZXRlZCwgYnV0IG9ubHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB3aGVuIHdlJ3JlIHVwZGF0aW5nIVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVsZXRlTW9kZWwocHJldmlvdXNNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuREVMRVRFRDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2UgdGhlIGR1cGxpY2F0ZSBtb2RlbCBhcyB0aGUgcmVmZXJlbmNlLlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNb2RlbChjdXJyZW50TW9kZWwsIGR1cGxpY2F0ZU1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuU0FWRUQ7XG5cbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmNvbmRpdGlvbmFsbHlFbWl0RXZlbnQoKTtcblxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHByZXZpb3VzTW9kZWwgPT09IG51bGwgJiYgZXZlbnROYW1lID09PSAnY3JlYXRlJykge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUHJldmlvdXMgbW9kZWwgd2FzIGFjdHVhbGx5IE5VTEwgYW5kIHRoZXJlZm9yZSB3ZSdsbCBkZWxldGUgaXQuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGVsZXRlTW9kZWwoY3VycmVudE1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ERUxFVEVEO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0V2l0aDtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsID09PSBudWxsICYmIGV2ZW50TmFtZSA9PT0gJ2RlbGV0ZScgKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBEZXZlbG9wZXIgZG9lc24ndCBhY3R1YWxseSB3YW50IHRvIGRlbGV0ZSB0aGUgbW9kZWwsIGFuZCB0aGVyZWZvcmUgd2UgbmVlZCB0byByZXZlcnQgaXQgdG9cbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIG1vZGVsIGl0IHdhcywgYW5kIHNldCBpdHMgZmxhZyBiYWNrIHRvIHdoYXQgaXQgd2FzLlxuICAgICAgICAgICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLnVwZGF0ZU1vZGVsKHt9LCBwcmV2aW91c01vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbHMucHVzaChtb2RlbCk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoKGN1cnJlbnRNb2RlbCAmJiBwcmV2aW91c01vZGVsKSAmJiBldmVudE5hbWUgPT09ICd1cGRhdGUnKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNpbGVudGx5KCgpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBCb3RoIG9mIHRoZSBjdXJyZW50IGFuZCBwcmV2aW91cyBtb2RlbHMgYXJlIHVwZGF0ZWQsIGFuZCB0aGVyZWZvcmUgd2UnbGwgc2ltcGx5XG4gICAgICAgICAgICAgICAgICAgIC8vIHJldmVydCB0aGUgY3VycmVudCBtb2RlbCB0byB0aGUgcHJldmlvdXMgbW9kZWwuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBwcmV2aW91c01vZGVsKTtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZWplY3RXaXRoO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjb25kaXRpb25hbGx5RW1pdEV2ZW50XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBjb25kaXRpb25hbGx5RW1pdEV2ZW50KCkge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhdHdhbGsuZXZlbnRzLnJlZnJlc2ggPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgIC8vIFdlJ3JlIGFsbCBkb25lIVxuICAgICAgICAgICAgICAgIGNhdHdhbGsuZXZlbnRzLnJlZnJlc2goKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjbGVhbk1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBjbGVhbk1vZGVsKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIHZhciBjbGVhbmVkTW9kZWwgPSB7fTtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSBDQVRXQUxLX01FVEFfUFJPUEVSVFkpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBDYXR3YWxrIG1ldGEgZGF0YSBzaG91bGQgbmV2ZXIgYmUgcGVyc2lzdGVkIHRvIHRoZSBiYWNrLWVuZC5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBwcm9wZXJ0eSBpcyBhY3R1YWxseSBhIHJlbGF0aW9uc2hpcCwgd2hpY2ggd2UgbmVlZCB0byByZXNvbHZlIHRvXG4gICAgICAgICAgICAgICAgLy8gaXRzIHByaW1pdGl2ZSB2YWx1ZShzKS5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVsYXRpb25zaGlwRnVuY3Rpb24gPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbGF0aW9uc2hpcEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gcmVsYXRpb25zaGlwRnVuY3Rpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5ibHVlcHJpbnQubW9kZWxbcHJvcGVydHldID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0gJiYgbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5vcmlnaW5hbFZhbHVlc1twcm9wZXJ0eV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgaGF2ZSBkaXNjb3ZlcmVkIGEgdHlwZWNhc3RlZCBwcm9wZXJ0eSB0aGF0IG5lZWRzIHRvIGJlIHJldmVydGVkIHRvIGl0cyBvcmlnaW5hbFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmFsdWUgYmVmb3JlIGludm9raW5nIHRoZSBjYWxsYmFjay5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFuZWRNb2RlbFtwcm9wZXJ0eV0gPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLm9yaWdpbmFsVmFsdWVzW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gbW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIGNsZWFuZWRNb2RlbDtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgQmx1ZXByaW50TW9kZWxcbiAgICAgKi9cbiAgICBjbGFzcyBCbHVlcHJpbnRNb2RlbCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gYmx1ZXByaW50IHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0JsdWVwcmludE1vZGVsfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IobmFtZSwgYmx1ZXByaW50KSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgID0gbmFtZTtcbiAgICAgICAgICAgIHRoaXMubW9kZWwgPSBPYmplY3QuZnJlZXplKGJsdWVwcmludCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29udmVuaWVuY2UgbWV0aG9kIHRoYXQgd3JhcHMgYGl0ZXJhdGVQcm9wZXJ0aWVzYCBhbmQgYGl0ZXJhdGVCbHVlcHJpbnRgIGludG8gYSBvbmUtbGluZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZUFsbFxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlQWxsKHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHRoaXMuaXRlcmF0ZVByb3BlcnRpZXMocHJvcGVydGllcyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pdGVyYXRlQmx1ZXByaW50KG1vZGVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgaXRlcmF0aW5nIG92ZXIgdGhlIHBhc3NlZCBpbiBtb2RlbCBwcm9wZXJ0aWVzIHRvIGVuc3VyZSB0aGV5J3JlIGluIHRoZSBibHVlcHJpbnQsXG4gICAgICAgICAqIGFuZCB0eXBlY2FzdGluZyB0aGUgcHJvcGVydGllcyBiYXNlZCBvbiB0aGUgZGVmaW5lIGJsdWVwcmludCBmb3IgdGhlIGN1cnJlbnQgY29sbGVjdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBpdGVyYXRlUHJvcGVydGllc1xuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlUHJvcGVydGllcyhwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIHZhciBtb2RlbCA9IHt9O1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIHZhciB2YWx1ZSAgICAgICAgICAgPSBwcm9wZXJ0aWVzW3Byb3BlcnR5XSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgIT09IENBVFdBTEtfTUVUQV9QUk9QRVJUWSAmJiB0eXBlb2YgcHJvcGVydHlIYW5kbGVyID09PSAndW5kZWZpbmVkJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByb3BlcnR5IGRvZXNuJ3QgYmVsb25nIGluIHRoZSBtb2RlbCBiZWNhdXNlIGl0J3Mgbm90IGluIHRoZSBibHVlcHJpbnQuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMucmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0eUhhbmRsZXIuZGVmaW5lUmVsYXRpb25zaGlwKHRoaXMubmFtZSwgcHJvcGVydHkpKTtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyLnNldFZhbHVlcyhwcm9wZXJ0aWVzW3Byb3BlcnR5XSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnRpZXNbQ0FUV0FMS19NRVRBX1BST1BFUlRZXSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSB0aGUgb3JpZ2luYWwgdmFsdWUgb2YgdGhlIHJlbGF0aW9uc2hpcCB0byByZXNvbHZlIHdoZW4gY2xlYW5pbmcgdGhlIG1vZGVsLlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1tDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0gPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3BlcnR5SGFuZGxlci52YWx1ZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcHJvcGVydHlIYW5kbGVyID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVHlwZWNhc3QgcHJvcGVydHkgdG8gdGhlIGRlZmluZWQgdHlwZS5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG9yaWdpbmFsVmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBwcm9wZXJ0eUhhbmRsZXIodmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjYXR3YWxrLnJldmVydFR5cGVjYXN0ICYmIG9yaWdpbmFsVmFsdWUgIT09IHZhbHVlKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBvcmlnaW5hbCB2YWx1ZSBzbyB0aGF0IHdlIGNhbiByZXZlcnQgaXQgZm9yIHdoZW4gaW52b2tpbmcgdGhlIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB3aXRoIHRoZSBgY2xlYW5Nb2RlbGAgbWV0aG9kLlxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1tDQVRXQUxLX01FVEFfUFJPUEVSVFldLm9yaWdpbmFsVmFsdWVzW3Byb3BlcnR5XSA9IG9yaWdpbmFsVmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gdmFsdWU7XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgaXRlcmF0aW5nIG92ZXIgdGhlIGJsdWVwcmludCB0byBkZXRlcm1pbmUgaWYgYW55IHByb3BlcnRpZXMgYXJlIG1pc3NpbmdcbiAgICAgICAgICogZnJvbSB0aGUgY3VycmVudCBtb2RlbCwgdGhhdCBoYXZlIGJlZW4gZGVmaW5lZCBpbiB0aGUgYmx1ZXByaW50IGFuZCB0aGVyZWZvcmUgc2hvdWxkIGJlXG4gICAgICAgICAqIHByZXNlbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZUJsdWVwcmludFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZUJsdWVwcmludChtb2RlbCkge1xuXG4gICAgICAgICAgICBPYmplY3Qua2V5cyh0aGlzLm1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbW9kZWxbcHJvcGVydHldID09PSAndW5kZWZpbmVkJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEVuc3VyZSB0aGF0IGl0IGlzIGRlZmluZWQuXG4gICAgICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSAgICAgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLnJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtb2RlbCwgcHJvcGVydHksIHByb3BlcnR5SGFuZGxlci5kZWZpbmVSZWxhdGlvbnNoaXAodGhpcy5uYW1lLCBwcm9wZXJ0eSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyLnNldFZhbHVlcyhbXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5tb2RlbFtwcm9wZXJ0eV0gPT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBwcm9wZXJ0eSBoYXMgYSBwcm9wZXJ0eSBoYW5kbGVyIG1ldGhvZCB3aGljaCB3b3VsZCBiZSByZXNwb25zaWJsZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIHR5cGVjYXN0aW5nLCBhbmQgZGV0ZXJtaW5pbmcgdGhlIGRlZmF1bHQgdmFsdWUuXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gICAgID0gcHJvcGVydHlIYW5kbGVyKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIHJlaXRlcmF0aW5nIG92ZXIgdGhlIG1vZGVsIHRvIG9uY2UgYWdhaW4gdHlwZWNhc3QgdGhlIHZhbHVlczsgd2hpY2ggaXNcbiAgICAgICAgICogZXNwZWNpYWxseSB1c2VmdWwgZm9yIHdoZW4gdGhlIG1vZGVsIGhhcyBiZWVuIHVwZGF0ZWQsIGJ1dCByZWxhdGlvbnNoaXBzIG5lZWQgdG8gYmUgbGVmdFxuICAgICAgICAgKiBhbG9uZS4gU2luY2UgdGhlIG1vZGVsIGlzIHNlYWxlZCB3ZSBjYW4gYWxzbyBndWFyYW50ZWUgdGhhdCBubyBvdGhlciBwcm9wZXJ0aWVzIGhhdmUgYmVlblxuICAgICAgICAgKiBhZGRlZCBpbnRvIHRoZSBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCByZWl0ZXJhdGVQcm9wZXJ0aWVzXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZWl0ZXJhdGVQcm9wZXJ0aWVzKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eUhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gcHJvcGVydHlIYW5kbGVyKG1vZGVsW3Byb3BlcnR5XSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZWxhdGlvbnNoaXBIYW5kbGVyXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eUhhbmRsZXIge1JlbGF0aW9uc2hpcEFic3RyYWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBBYnN0cmFjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKSB7XG5cbiAgICAgICAgICAgIHZhciBpbnN0YW50aWF0ZVByb3BlcnRpZXMgPSBbcHJvcGVydHlIYW5kbGVyLnRhcmdldC5rZXksIHByb3BlcnR5SGFuZGxlci50YXJnZXQuY29sbGVjdGlvbl07XG5cbiAgICAgICAgICAgIC8vIEluc3RhbnRpYXRlIGEgbmV3IHJlbGF0aW9uc2hpcCBwZXIgbW9kZWwuXG4gICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IG5ldyBSZWxhdGlvbnNoaXBIYXNNYW55KC4uLmluc3RhbnRpYXRlUHJvcGVydGllcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc09uZSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IG5ldyBSZWxhdGlvbnNoaXBIYXNPbmUoLi4uaW5zdGFudGlhdGVQcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHByb3BlcnR5SGFuZGxlcjtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgVHlwZWNhc3RcbiAgICAgKi9cbiAgICBjbGFzcyBUeXBlY2FzdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmV0dXJuVmFsdWVcbiAgICAgICAgICogQHBhcmFtIHR5cGVjYXN0Q29uc3RydWN0b3Ige0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcGFyYW0gdmFsdWUgeyp9XG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUgeyp9XG4gICAgICAgICAqIEByZXR1cm4geyp9XG4gICAgICAgICAqL1xuICAgICAgICByZXR1cm5WYWx1ZSh0eXBlY2FzdENvbnN0cnVjdG9yLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZWNhc3RDb25zdHJ1Y3Rvcih0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnID8gdmFsdWUgOiBkZWZhdWx0VmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc3RyaW5nXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBzdHJpbmcoZGVmYXVsdFZhbHVlID0gJycpIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKFN0cmluZywgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBib29sZWFuXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge0Jvb2xlYW59XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgYm9vbGVhbihkZWZhdWx0VmFsdWUgPSB0cnVlKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShCb29sZWFuLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIG51bWJlclxuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHtOdW1iZXJ9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgbnVtYmVyKGRlZmF1bHRWYWx1ZSA9IDApIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKE51bWJlciwgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogbWV0aG9kIGF1dG9JbmNyZW1lbnRcbiAgICAgICAgICogQHBhcmFtIGluaXRpYWxWYWx1ZSB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGF1dG9JbmNyZW1lbnQoaW5pdGlhbFZhbHVlID0gMSkge1xuXG4gICAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBOdW1iZXIoaW5pdGlhbFZhbHVlKyspO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3VzdG9tXG4gICAgICAgICAqIEBwYXJhbSB0eXBlY2FzdEZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjdXN0b20odHlwZWNhc3RGbikge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVjYXN0Rm47XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXAge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGhhc09uZVxuICAgICAgICAgKiBAcGFyYW0gZm9yZWlnbktleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7UmVsYXRpb25zaGlwSGFzT25lfVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzT25lKGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc09uZShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBoYXNNYW55XG4gICAgICAgICAqIEBwYXJhbSBmb3JlaWduS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBIYXNNYW55fVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzTWFueShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNNYW55KGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEFic3RyYWN0XG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIGZvcmVpZ25LZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3Rvcihmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuXG4gICAgICAgICAgICB0aGlzLnRhcmdldCA9IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBrZXk6IGZvcmVpZ25LZXlcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNldFZhbHVlc1xuICAgICAgICAgKiBAcGFyYW0gdmFsdWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRWYWx1ZXModmFsdWVzKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcyA9IHRoaXMudmFsdWUgPSB2YWx1ZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gYWNjZXNzb3JGdW5jdGlvbnMge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCBhY2Nlc3NvckZ1bmN0aW9ucykge1xuXG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBrZXk6IGxvY2FsS2V5XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGdldDogYWNjZXNzb3JGdW5jdGlvbnMuZ2V0LFxuICAgICAgICAgICAgICAgIHNldDogYWNjZXNzb3JGdW5jdGlvbnMuc2V0LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwSGFzTWFueVxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcEhhc01hbnkgZXh0ZW5kcyBSZWxhdGlvbnNoaXBBYnN0cmFjdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVmaW5lUmVsYXRpb25zaGlwXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSkge1xuXG4gICAgICAgICAgICByZXR1cm4gc3VwZXIuZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSwge1xuICAgICAgICAgICAgICAgIGdldDogdGhpcy5nZXRNb2RlbHMuYmluZCh0aGlzKSxcbiAgICAgICAgICAgICAgICBzZXQ6IHRoaXMuc2V0TW9kZWxzLmJpbmQodGhpcylcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBnZXRNb2RlbHNcbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBnZXRNb2RlbHMoKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBsb2FkTW9kZWxzXG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGxvYWRNb2RlbHMgPSAoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZm9yZWlnbkNvbGxlY3Rpb24ubW9kZWxzLmZpbHRlcigoZm9yZWlnbk1vZGVsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlcy5pbmRleE9mKGZvcmVpZ25Nb2RlbFt0aGlzLnRhcmdldC5rZXldKSAhPT0gLTE7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBhcnJheURpZmZcbiAgICAgICAgICAgICAqIEBwYXJhbSBmaXJzdEFycmF5IHtBcnJheX1cbiAgICAgICAgICAgICAqIEBwYXJhbSBzZWNvbmRBcnJheSB7QXJyYXl9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHsqfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgYXJyYXlEaWZmID0gKGZpcnN0QXJyYXksIHNlY29uZEFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpcnN0QXJyYXkuZmlsdGVyKChpbmRleCkgPT4gc2Vjb25kQXJyYXkuaW5kZXhPZihpbmRleCkgPCAwKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIGZvcmVpZ25Db2xsZWN0aW9uID0gY2F0d2Fsay5jb2xsZWN0aW9uKHRoaXMudGFyZ2V0LmNvbGxlY3Rpb24pLFxuICAgICAgICAgICAgICAgIG1vZGVscyAgICAgICAgICAgID0gbG9hZE1vZGVscygpO1xuXG4gICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBhIGRpc2NyZXBhbmN5IGJldHdlZW4gdGhlIGNvdW50cywgdGhlbiB3ZSBrbm93IGFsbCB0aGUgbW9kZWxzIGhhdmVuJ3QgYmVlbiBsb2FkZWQuXG4gICAgICAgICAgICBpZiAobW9kZWxzLmxlbmd0aCAhPT0gdGhpcy52YWx1ZXMubGVuZ3RoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBEaXNjb3ZlciB0aGUga2V5cyB0aGF0IGFyZSBjdXJyZW50bHkgbm90IGxvYWRlZC5cbiAgICAgICAgICAgICAgICB2YXIgbG9hZGVkS2V5cyAgID0gbW9kZWxzLm1hcChtb2RlbCA9PiBtb2RlbFt0aGlzLnRhcmdldC5rZXldKSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRLZXlzID0gYXJyYXlEaWZmKHRoaXMudmFsdWVzLCBsb2FkZWRLZXlzKTtcblxuICAgICAgICAgICAgICAgIHJlcXVpcmVkS2V5cy5mb3JFYWNoKChmb3JlaWduS2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcXVpcmVkTW9kZWwgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRNb2RlbFt0aGlzLnRhcmdldC5rZXldID0gZm9yZWlnbktleTtcbiAgICAgICAgICAgICAgICAgICAgZm9yZWlnbkNvbGxlY3Rpb24ucmVhZE1vZGVsKHJlcXVpcmVkTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBBdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVscyBhZ2FpbiBpbW1lZGlhdGVseS5cbiAgICAgICAgICAgICAgICBtb2RlbHMgPSBsb2FkTW9kZWxzKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVscztcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2V0TW9kZWxzXG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRNb2RlbHModmFsdWVzKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEhhc09uZVxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcEhhc09uZSBleHRlbmRzIFJlbGF0aW9uc2hpcEFic3RyYWN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5KSB7XG5cbiAgICAgICAgICAgIHJldHVybiBzdXBlci5kZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCB7XG4gICAgICAgICAgICAgICAgZ2V0OiB0aGlzLmdldE1vZGVsLmJpbmQodGhpcyksXG4gICAgICAgICAgICAgICAgc2V0OiB0aGlzLnNldE1vZGVsLmJpbmQodGhpcylcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBnZXRNb2RlbFxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBnZXRNb2RlbCgpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIGxvYWRNb2RlbFxuICAgICAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgbG9hZE1vZGVsID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBmb3JlaWduQ29sbGVjdGlvbi5tb2RlbHMuZmluZCgoZm9yZWlnbk1vZGVsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlID09PSBmb3JlaWduTW9kZWxbdGhpcy50YXJnZXQua2V5XTtcbiAgICAgICAgICAgICAgICB9KTsgIFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIGZvcmVpZ25Db2xsZWN0aW9uID0gY2F0d2Fsay5jb2xsZWN0aW9uKHRoaXMudGFyZ2V0LmNvbGxlY3Rpb24pLFxuICAgICAgICAgICAgICAgIG1vZGVsICAgICAgICAgICAgID0gbG9hZE1vZGVsKCk7XG5cbiAgICAgICAgICAgIGlmICghbW9kZWwpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1vZGVsIGNhbm5vdCBiZSBmb3VuZCBhbmQgdGhlcmVmb3JlIHdlJ2xsIGF0dGVtcHQgdG8gcmVhZCB0aGUgbW9kZWwgaW50byB0aGUgY29sbGVjdGlvbi5cbiAgICAgICAgICAgICAgICB2YXIgcmVxdWlyZWRNb2RlbCAgID0ge307XG4gICAgICAgICAgICAgICAgcmVxdWlyZWRNb2RlbFt0aGlzLnRhcmdldC5rZXldID0gdGhpcy52YWx1ZTtcbiAgICAgICAgICAgICAgICBmb3JlaWduQ29sbGVjdGlvbi5yZWFkTW9kZWwocmVxdWlyZWRNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICAvLyBBdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVsIGFnYWluIGltbWVkaWF0ZWx5LlxuICAgICAgICAgICAgICAgIG1vZGVsID0gbG9hZE1vZGVsKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzZXRNb2RlbFxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0TW9kZWwodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy8gSW5zdGFudGlhdGUgdGhlIENhdHdhbGsgY2xhc3MuXG4gICAgJHdpbmRvdy5jYXR3YWxrICAgICAgICA9IG5ldyBDYXR3YWxrKCk7XG4gICAgJHdpbmRvdy5jYXR3YWxrLlNUQVRFUyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVM7XG5cbn0pKHdpbmRvdyk7IiwidmFyICRfX3BsYWNlaG9sZGVyX18wID0gJF9fcGxhY2Vob2xkZXJfXzEiLCIoJHRyYWNldXJSdW50aW1lLmNyZWF0ZUNsYXNzKSgkX19wbGFjZWhvbGRlcl9fMCwgJF9fcGxhY2Vob2xkZXJfXzEsICRfX3BsYWNlaG9sZGVyX18yKSIsIiR0cmFjZXVyUnVudGltZS5zcHJlYWQoJF9fcGxhY2Vob2xkZXJfXzApIiwiJHRyYWNldXJSdW50aW1lLmRlZmF1bHRTdXBlckNhbGwodGhpcyxcbiAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMC5wcm90b3R5cGUsIGFyZ3VtZW50cykiLCJ2YXIgJF9fcGxhY2Vob2xkZXJfXzAgPSAkX19wbGFjZWhvbGRlcl9fMSIsIigkdHJhY2V1clJ1bnRpbWUuY3JlYXRlQ2xhc3MpKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMykiLCIkdHJhY2V1clJ1bnRpbWUuc3VwZXJDYWxsKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRfX3BsYWNlaG9sZGVyX18zKSJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==