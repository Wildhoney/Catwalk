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
          if (originalValue !== value) {
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNhdHdhbGsuanMiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMSIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci8yIiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzciLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvNCIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci82IiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzUiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLEFBQUMsU0FBUyxPQUFNO0FBRVosYUFBVyxDQUFDO0lBTU4sQ0FBQSxxQkFBb0IsRUFBSSxZQUFVO0lBTWxDLENBQUEseUJBQXdCLEVBQUk7QUFBRSxNQUFFLENBQUcsRUFBQTtBQUFHLFFBQUksQ0FBRyxFQUFBO0FBQUcsUUFBSSxDQUFHLEVBQUE7QUFBRyxVQUFNLENBQUcsRUFBQTtBQUFBLEVBQUU7QUNkL0UsQUFBSSxJQUFBLFVEbUJBLFNBQU0sUUFBTSxDQU1HLEFBQUMsQ0FBRTtBQUNWLE9BQUcsT0FBTyxFQUFVLEdBQUMsQ0FBQztBQUN0QixPQUFHLFlBQVksRUFBSyxHQUFDLENBQUM7QUFDdEIsT0FBRyxhQUFhLEVBQUksSUFBSSxhQUFXLEFBQUMsRUFBQyxDQUFDO0FBQ3RDLE9BQUcsU0FBUyxFQUFRLElBQUksU0FBTyxBQUFDLEVBQUMsQ0FBQztFQzdCTixBRDhCaEMsQ0M5QmdDO0FDQXhDLEVBQUMsZUFBYyxZQUFZLENBQUMsQUFBQztBRm9DckIsbUJBQWUsQ0FBZixVQUFpQixJQUFHLENBQUcsQ0FBQSxVQUFTLENBQUc7QUFFL0IsQUFBSSxRQUFBLENBQUEsVUFBUyxFQUFJLElBQUksV0FBUyxBQUFDLENBQUMsSUFBRyxDQUFHLFdBQVMsQ0FBQyxDQUFDO0FBQ2pELFNBQUcsWUFBWSxDQUFFLElBQUcsQ0FBQyxFQUFJLFdBQVMsQ0FBQztBQUNuQyxXQUFPLFdBQVMsQ0FBQztJQUVyQjtBQU9BLGFBQVMsQ0FBVCxVQUFXLElBQUcsQ0FBRztBQUViLFNBQUksTUFBTyxLQUFHLFlBQVksQ0FBRSxJQUFHLENBQUMsQ0FBQSxHQUFNLFlBQVUsQ0FBRztBQUMvQyxXQUFHLGVBQWUsQUFBQyxFQUFDLDhCQUE2QixFQUFDLEtBQUcsRUFBQyxLQUFFLEVBQUMsQ0FBQztNQUM5RDtBQUFBLEFBRUEsV0FBTyxDQUFBLElBQUcsWUFBWSxDQUFFLElBQUcsQ0FBQyxDQUFDO0lBRWpDO0FBUUEsaUJBQWEsQ0FBYixVQUFlLE9BQU0sQ0FBRztBQUNwQixZQUFNLFdBQVcsRUFBQyxRQUFNLEVBQUMsSUFBRSxFQUFDO0lBQ2hDO0FBUUEsS0FBQyxDQUFELFVBQUcsSUFBRyxDQUFHLENBQUEsT0FBTSxDQUFHO0FBQ2QsU0FBRyxPQUFPLENBQUUsSUFBRyxDQUFDLEVBQUksUUFBTSxDQUFDO0lBQy9CO0FBT0EsTUFBRSxDQUFGLFVBQUksSUFBRyxDQUFHO0FBQ04sV0FBTyxLQUFHLE9BQU8sQ0FBRSxJQUFHLENBQUMsQ0FBQztJQUM1QjtBQUFBLE9FdEY2RTtBREFyRixBQUFJLElBQUEsYUQ2RkEsU0FBTSxXQUFTLENBUUMsSUFBRyxDQUFHLENBQUEsVUFBUyxDQUFHO0FBQzFCLE9BQUcsR0FBRyxFQUFXLEVBQUEsQ0FBQztBQUNsQixPQUFHLEtBQUssRUFBUyxLQUFHLENBQUM7QUFDckIsT0FBRyxPQUFPLEVBQU8sR0FBQyxDQUFDO0FBQ25CLE9BQUcsT0FBTyxFQUFPLE1BQUksQ0FBQztBQUN0QixPQUFHLFVBQVUsRUFBSSxJQUFJLGVBQWEsQUFBQyxDQUFDLElBQUcsQ0FBRyxXQUFTLENBQUMsQ0FBQztFQzFHekIsQUQyR2hDLENDM0dnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUZrSHJCLFdBQU8sQ0FBUCxVQUFTLFFBQU8sQ0FBRztBQUNmLFNBQUcsT0FBTyxFQUFJLEtBQUcsQ0FBQztBQUNsQixhQUFPLE1BQU0sQUFBQyxDQUFDLElBQUcsQ0FBQyxDQUFDO0FBQ3BCLFNBQUcsT0FBTyxFQUFJLE1BQUksQ0FBQztJQUN2QjtBQU9BLGNBQVUsQ0FBVixVQUFZLEFBQWMsQ0FBRztRQUFqQixXQUFTLDZDQUFJLEdBQUM7QUFFdEIsU0FBRyxXQUFXLEFBQUMsQ0FBQyxVQUFTLENBQUMsQ0FBQztBQUczQixBQUFJLFFBQUEsQ0FBQSxLQUFJLEVBQUksQ0FBQSxJQUFHLFVBQVUsV0FBVyxBQUFDLENBQUMsVUFBUyxDQUFDLENBQUM7QUFFakQsV0FBSyxLQUFLLEFBQUMsQ0FBQyxLQUFJLENBQUMsQ0FBQztBQUNsQixTQUFHLE9BQU8sS0FBSyxBQUFDLENBQUMsS0FBSSxDQUFDLENBQUM7QUFDdkIsU0FBRyxhQUFhLEFBQUMsQ0FBQyxRQUFPLENBQUcsTUFBSSxDQUFHLEtBQUcsQ0FBQyxDQUFDO0FBQ3hDLFdBQU8sTUFBSSxDQUFDO0lBRWhCO0FBT0EsWUFBUSxDQUFSLFVBQVUsVUFBUyxDQUFHO0FBQ2xCLFNBQUcsYUFBYSxBQUFDLENBQUMsTUFBSyxDQUFHLFdBQVMsQ0FBRyxLQUFHLENBQUMsQ0FBQztBQUMzQyxXQUFPLFdBQVMsQ0FBQztJQUNyQjtBQVFBLGNBQVUsQ0FBVixVQUFZLEtBQUksQ0FBRyxDQUFBLFVBQVM7O0FBR3hCLEFBQUksUUFBQSxDQUFBLGFBQVksRUFBSSxHQUFDLENBQUM7QUFDdEIsV0FBSyxLQUFLLEFBQUMsQ0FBQyxLQUFJLENBQUMsUUFBUSxBQUFDLEVBQUMsU0FBQSxRQUFPO2FBQUssQ0FBQSxhQUFZLENBQUUsUUFBTyxDQUFDLEVBQUksQ0FBQSxLQUFJLENBQUUsUUFBTyxDQUFDO01BQUEsRUFBQyxDQUFDO0FBRWpGLFFBQUk7QUFLQSxhQUFLLEtBQUssQUFBQyxDQUFDLFVBQVMsQ0FBQyxRQUFRLEFBQUMsRUFBQyxTQUFBLFFBQU87ZUFBSyxDQUFBLEtBQUksQ0FBRSxRQUFPLENBQUMsRUFBSSxDQUFBLFVBQVMsQ0FBRSxRQUFPLENBQUM7UUFBQSxFQUFDLENBQUM7TUFFdkYsQ0FDQSxPQUFPLENBQUEsQ0FBRyxHQUFDO0FBQUEsQUFLUCxRQUFBLENBQUEsYUFBWSxFQUFJLENBQUEsSUFBRyxVQUFVLG9CQUFvQixBQUFDLENBQUMsS0FBSSxDQUFDLENBQUM7QUFDN0QsV0FBSyxLQUFLLEFBQUMsQ0FBQyxhQUFZLENBQUMsUUFBUSxBQUFDLEVBQUMsU0FBQyxRQUFPLENBQU07QUFFN0MsV0FBSSxjQUFhLE1BQU0sQ0FBRSxRQUFPLENBQUMsV0FBYSxxQkFBbUIsQ0FBRztBQUNoRSxnQkFBTTtRQUNWO0FBQUEsQUFFQSxZQUFJLENBQUUsUUFBTyxDQUFDLEVBQUksQ0FBQSxhQUFZLENBQUUsUUFBTyxDQUFDLENBQUE7TUFFNUMsRUFBQyxDQUFDO0FBRUYsU0FBRyxhQUFhLEFBQUMsQ0FBQyxRQUFPLENBQUcsTUFBSSxDQUFHLGNBQVksQ0FBQyxDQUFDO0FBQ2pELFdBQU8sTUFBSSxDQUFDO0lBRWhCO0FBT0EsY0FBVSxDQUFWLFVBQVksS0FBSTs7QUFRWixBQUFJLFFBQUEsQ0FBQSxNQUFLLElBQUksU0FBQyxLQUFJLENBQUcsQ0FBQSxLQUFJLENBQU07QUFFM0Isd0JBQWdCLEFBQUMsQ0FBQyxRQUFPLENBQUcsS0FBRyxDQUFHLE1BQUksQ0FBQyxDQUFDO0FBQ3hDLGtCQUFVLE9BQU8sQUFBQyxDQUFDLEtBQUksQ0FBRyxFQUFBLENBQUMsQ0FBQztNQUVoQyxDQUFBLENBQUM7QUFRRCxBQUFJLFFBQUEsQ0FBQSxxQkFBb0IsRUFBSSxNQUFJLENBQUM7QUFFakMsT0FBQyxTQUFBLEFBQUMsQ0FBSztBQUdILEFBQUksVUFBQSxDQUFBLEtBQUksRUFBSSxDQUFBLFdBQVUsUUFBUSxBQUFDLENBQUMsS0FBSSxDQUFDLENBQUM7QUFFdEMsV0FBSSxLQUFJLElBQU0sRUFBQyxDQUFBLENBQUc7QUFDZCw4QkFBb0IsRUFBSSxLQUFHLENBQUM7QUFDNUIsZUFBSyxBQUFDLENBQUMsV0FBVSxDQUFFLEtBQUksQ0FBQyxDQUFHLE1BQUksQ0FBQyxDQUFDO1FBQ3JDO0FBQUEsTUFFSixFQUFDLEFBQUMsRUFBQyxDQUFDO0FBRUosT0FBQyxTQUFBLEFBQUM7QUFFRSxXQUFJLHFCQUFvQixDQUFHO0FBQ3ZCLGdCQUFNO1FBQ1Y7QUFBQSxBQUVJLFVBQUEsQ0FBQSxLQUFJLEVBQUksRUFBQSxDQUFDO0FBR2Isa0JBQVUsUUFBUSxBQUFDLEVBQUMsU0FBQyxZQUFXLENBQU07QUFFbEMsYUFBSSxZQUFXLENBQUUscUJBQW9CLENBQUMsR0FBRyxJQUFNLENBQUEsS0FBSSxDQUFFLHFCQUFvQixDQUFDLEdBQUcsQ0FBRztBQUM1RSxpQkFBSyxBQUFDLENBQUMsWUFBVyxDQUFHLE1BQUksQ0FBQyxDQUFDO1VBQy9CO0FBQUEsQUFFQSxjQUFJLEVBQUUsQ0FBQztRQUVYLEVBQUMsQ0FBQztNQUVOLEVBQUMsQUFBQyxFQUFDLENBQUM7QUFFSixXQUFPLE1BQUksQ0FBQztJQUVoQjtBQVNBLGlCQUFhLENBQWIsVUFBZSxLQUFJLENBQUcsQ0FBQSxRQUFPLENBQUcsQ0FBQSxVQUFTLENBQUc7QUFFeEMsU0FBSSxDQUFDLENBQUMsSUFBRyxVQUFVLE1BQU0sQ0FBRSxRQUFPLENBQUMsV0FBYSxvQkFBa0IsQ0FBQyxDQUFHO0FBQ2xFLGNBQU0sZUFBZSxBQUFDLENBQUMsd0RBQXVELENBQUMsQ0FBQztNQUNwRjtBQUFBLEFBRUksUUFBQSxDQUFBLGlCQUFnQixFQUFJLENBQUEsS0FBSSxDQUFFLHFCQUFvQixDQUFDLG1CQUFtQixDQUFFLFFBQU8sQ0FBQyxBQUFDLEVBQUMsQ0FBQztBQUNuRixzQkFBZ0IsRUFBUSxDQUFBLGlCQUFnQixPQUFPLEFBQUMsQ0FBQyxVQUFTLENBQUMsQ0FBQztBQUM1RCxBQUFJLFFBQUEsQ0FBQSxVQUFTLEVBQVcsR0FBQyxDQUFDO0FBQzFCLGVBQVMsQ0FBRSxRQUFPLENBQUMsRUFBSyxrQkFBZ0IsQ0FBQztBQUN6QyxXQUFPLENBQUEsSUFBRyxZQUFZLEFBQUMsQ0FBQyxLQUFJLENBQUcsV0FBUyxDQUFDLENBQUM7SUFFOUM7QUFTQSxvQkFBZ0IsQ0FBaEIsVUFBa0IsS0FBSSxDQUFHLENBQUEsUUFBTyxDQUFHLENBQUEsVUFBUztBQUV4QyxTQUFJLENBQUMsQ0FBQyxJQUFHLFVBQVUsTUFBTSxDQUFFLFFBQU8sQ0FBQyxXQUFhLG9CQUFrQixDQUFDLENBQUc7QUFDbEUsY0FBTSxlQUFlLEFBQUMsQ0FBQywyREFBMEQsQ0FBQyxDQUFDO01BQ3ZGO0FBQUEsQUFFSSxRQUFBLENBQUEsaUJBQWdCLEVBQUksQ0FBQSxLQUFJLENBQUUscUJBQW9CLENBQUMsbUJBQW1CLENBQUUsUUFBTyxDQUFDLEFBQUMsRUFBQyxDQUFDO0FBRW5GLGVBQVMsUUFBUSxBQUFDLEVBQUMsU0FBQyxRQUFPLENBQU07QUFDN0IsQUFBSSxVQUFBLENBQUEsS0FBSSxFQUFJLENBQUEsaUJBQWdCLFFBQVEsQUFBQyxDQUFDLFFBQU8sQ0FBQyxDQUFDO0FBQy9DLHdCQUFnQixPQUFPLEFBQUMsQ0FBQyxLQUFJLENBQUcsRUFBQSxDQUFDLENBQUM7TUFDdEMsRUFBQyxDQUFDO0FBRUYsQUFBSSxRQUFBLENBQUEsVUFBUyxFQUFXLEdBQUMsQ0FBQztBQUMxQixlQUFTLENBQUUsUUFBTyxDQUFDLEVBQUssa0JBQWdCLENBQUM7QUFDekMsV0FBTyxDQUFBLElBQUcsWUFBWSxBQUFDLENBQUMsS0FBSSxDQUFHLFdBQVMsQ0FBQyxDQUFDO0lBRTlDO0FBT0EsYUFBUyxDQUFULFVBQVcsS0FBSSxDQUFHO0FBRWQsVUFBSSxDQUFFLHFCQUFvQixDQUFDLEVBQUk7QUFDM0IsU0FBQyxDQUFHLEdBQUUsSUFBRyxHQUFHO0FBQ1osYUFBSyxDQUFHLENBQUEseUJBQXdCLElBQUk7QUFDcEMscUJBQWEsQ0FBRyxHQUFDO0FBQ2pCLHlCQUFpQixDQUFHLEdBQUM7QUFBQSxNQUN6QixDQUFBO0lBRUo7QUFTQSxlQUFXLENBQVgsVUFBYSxTQUFRLENBQUcsQ0FBQSxZQUFXLENBQUcsQ0FBQSxhQUFZOztBQUU5QyxTQUFJLElBQUcsT0FBTyxDQUFHO0FBQ2IsY0FBTTtNQUNWO0FBQUEsQUFFQSxTQUFJLE1BQU8sUUFBTSxPQUFPLENBQUUsU0FBUSxDQUFDLENBQUEsR0FBTSxXQUFTLENBQUc7QUFJakQsY0FBTTtNQUVWO0FBQUEsQUFFQSxRQUFJLFFBQU0sQUFBQyxFQUFDLFNBQUMsT0FBTSxDQUFHLENBQUEsTUFBSyxDQUFNO0FBRzdCLGNBQU0sT0FBTyxDQUFFLFNBQVEsQ0FBQyxBQUFDLENBQUMsU0FBUSxDQUFHLENBQUEsZUFBYyxBQUFDLENBQUMsWUFBVyxHQUFLLGNBQVksQ0FBQyxDQUFHO0FBQ2pGLGdCQUFNLENBQUcsUUFBTTtBQUFHLGVBQUssQ0FBRyxPQUFLO0FBQUEsUUFDbkMsQ0FBQyxDQUFDO01BRU4sRUFBQyxLQUFLLEFBQUMsRUFBQyxTQUFDLGdCQUFlLENBQU07QUFHMUIsMEJBQWtCLEFBQUMsQ0FBQyxTQUFRLENBQUcsYUFBVyxDQUFHLGNBQVksQ0FBQyxBQUFDLENBQUMsZ0JBQWUsQ0FBQyxDQUFDO01BRWpGLElBQUcsU0FBQyxnQkFBZSxDQUFNO0FBR3JCLHlCQUFpQixBQUFDLENBQUMsU0FBUSxDQUFHLGFBQVcsQ0FBRyxjQUFZLENBQUMsQUFBQyxDQUFDLGdCQUFlLENBQUMsQ0FBQztNQUVoRixFQUFDLENBQUM7SUFFTjtBQVdBLGlCQUFhLENBQWIsVUFBZSxTQUFRLENBQUcsQ0FBQSxZQUFXLENBQUcsQ0FBQSxhQUFZOztBQUVoRCxTQUFJLFlBQVcsR0FBSyxDQUFBLFNBQVEsSUFBTSxTQUFPLENBQUc7QUFHeEMsbUJBQVcsQ0FBRSxxQkFBb0IsQ0FBQyxPQUFPLEVBQUksQ0FBQSx5QkFBd0IsTUFBTSxDQUFDO01BRWhGO0FBQUEsQUFJQSxTQUFJLENBQUMsWUFBVyxJQUFNLEtBQUcsQ0FBQSxFQUFLLGNBQVksQ0FBQyxHQUFLLENBQUEsU0FBUSxJQUFNLFNBQU8sQ0FBRztBQUdwRSxvQkFBWSxDQUFFLHFCQUFvQixDQUFDLE9BQU8sRUFBSSxDQUFBLHlCQUF3QixRQUFRLENBQUM7TUFFbkY7QUFBQSxBQUVBLGFBQU8sU0FBQyxVQUFTO0FBRWIsb0JBQVksQUFBQyxFQUFDLFNBQUEsQUFBQyxDQUFLO0FBRWhCLGFBQUksVUFBUyxHQUFLLENBQUEsU0FBUSxJQUFNLE9BQUssQ0FBRztBQUNwQywyQkFBZSxBQUFDLENBQUMsWUFBVyxDQUFHLFdBQVMsQ0FBQyxDQUFDO1VBQzlDO0FBQUEsQUFFQSxhQUFJLFVBQVMsR0FBSyxFQUFDLFVBQVMsZUFBZSxBQUFDLENBQUMscUJBQW9CLENBQUMsQ0FBQSxFQUFLLENBQUEsU0FBUSxJQUFNLE9BQUssQ0FBRztBQUV6RixBQUFJLGNBQUEsQ0FBQSxLQUFJLEVBQUksQ0FBQSxnQkFBZSxBQUFDLENBQUMsVUFBUyxDQUFDLENBQUM7QUFHeEMsMkJBQWUsQUFBQyxDQUFDLFlBQVcsQ0FBRyxNQUFJLENBQUMsQ0FBQztVQUV6QztBQUFBLFFBRUosRUFBQyxDQUFDO0FBRUYsa0NBQTBCLEFBQUMsRUFBQyxDQUFDO01BRWpDLEVBQUM7SUFFTDtBQVNBLGdCQUFZLENBQVosVUFBYyxTQUFRLENBQUcsQ0FBQSxZQUFXLENBQUcsQ0FBQSxhQUFZOztBQU8vQyxBQUFJLFFBQUEsQ0FBQSxVQUFTLElBQUksU0FBQyxjQUFhO0FBRTNCLFdBQUksY0FBYSxDQUFHO0FBRWhCLHNCQUFZLEFBQUMsRUFBQyxTQUFBLEFBQUMsQ0FBSztBQUVoQixlQUFJLFNBQVEsSUFBTSxTQUFPLENBQUEsRUFBSyxDQUFBLGNBQWEsZUFBZSxBQUFDLENBQUMscUJBQW9CLENBQUMsQ0FBRztBQUloRiw2QkFBZSxBQUFDLENBQUMsYUFBWSxDQUFDLENBQUM7QUFDL0IsMEJBQVksQ0FBRSxxQkFBb0IsQ0FBQyxPQUFPLEVBQUksQ0FBQSx5QkFBd0IsUUFBUSxDQUFDO1lBRW5GO0FBQUEsQUFHQSwyQkFBZSxBQUFDLENBQUMsWUFBVyxDQUFHLGVBQWEsQ0FBQyxDQUFDO0FBQzlDLHVCQUFXLENBQUUscUJBQW9CLENBQUMsT0FBTyxFQUFJLENBQUEseUJBQXdCLE1BQU0sQ0FBQztVQUVoRixFQUFDLENBQUM7UUFFTjtBQUFBLEFBRUEsa0NBQTBCLEFBQUMsRUFBQyxDQUFDO01BRWpDLENBQUEsQ0FBQztBQUVELFNBQUksYUFBWSxJQUFNLEtBQUcsQ0FBQSxFQUFLLENBQUEsU0FBUSxJQUFNLFNBQU8sQ0FBRztBQUVsRCxXQUFHLFNBQVMsQUFBQyxFQUFDLFNBQUEsQUFBQyxDQUFLO0FBR2hCLHlCQUFlLEFBQUMsQ0FBQyxZQUFXLENBQUMsQ0FBQztBQUM5QixxQkFBVyxDQUFFLHFCQUFvQixDQUFDLE9BQU8sRUFBSSxDQUFBLHlCQUF3QixRQUFRLENBQUM7UUFFbEYsRUFBQyxDQUFDO0FBRUYsYUFBTyxXQUFTLENBQUM7TUFFckI7QUFBQSxBQUVBLFNBQUksWUFBVyxJQUFNLEtBQUcsQ0FBQSxFQUFLLENBQUEsU0FBUSxJQUFNLFNBQU8sQ0FBSTtBQUVsRCxXQUFHLFNBQVMsQUFBQyxFQUFDLFNBQUEsQUFBQyxDQUFLO0FBSWhCLEFBQUksWUFBQSxDQUFBLEtBQUksRUFBSSxDQUFBLGdCQUFlLEFBQUMsQ0FBQyxFQUFDLENBQUcsY0FBWSxDQUFDLENBQUM7QUFDL0Msb0JBQVUsS0FBSyxBQUFDLENBQUMsS0FBSSxDQUFDLENBQUM7UUFFM0IsRUFBQyxDQUFDO01BRU47QUFBQSxBQUVBLFNBQUksQ0FBQyxZQUFXLEdBQUssY0FBWSxDQUFDLEdBQUssQ0FBQSxTQUFRLElBQU0sU0FBTyxDQUFHO0FBRTNELFdBQUcsU0FBUyxBQUFDLEVBQUMsU0FBQSxBQUFDLENBQUs7QUFJaEIseUJBQWUsQUFBQyxDQUFDLFlBQVcsQ0FBRyxjQUFZLENBQUMsQ0FBQztRQUVqRCxFQUFDLENBQUM7TUFFTjtBQUFBLEFBRUEsV0FBTyxXQUFTLENBQUM7SUFFckI7QUFNQSx5QkFBcUIsQ0FBckIsVUFBc0IsQUFBQyxDQUFFO0FBRXJCLFNBQUksTUFBTyxRQUFNLE9BQU8sUUFBUSxDQUFBLEdBQU0sV0FBUyxDQUFHO0FBRzlDLGNBQU0sT0FBTyxRQUFRLEFBQUMsRUFBQyxDQUFDO01BRTVCO0FBQUEsSUFFSjtBQU9BLGFBQVMsQ0FBVCxVQUFXLEtBQUk7O0FBRVgsQUFBSSxRQUFBLENBQUEsWUFBVyxFQUFJLEdBQUMsQ0FBQztBQUVyQixXQUFLLEtBQUssQUFBQyxDQUFDLEtBQUksQ0FBQyxRQUFRLEFBQUMsRUFBQyxTQUFBLFFBQU8sQ0FBSztBQUVuQyxXQUFJLFFBQU8sSUFBTSxzQkFBb0IsQ0FBRztBQUdwQyxnQkFBTTtRQUVWO0FBQUEsQUFJQSxXQUFJLGNBQWEsTUFBTSxDQUFFLFFBQU8sQ0FBQyxXQUFhLHFCQUFtQixDQUFHO0FBRWhFLEFBQUksWUFBQSxDQUFBLG9CQUFtQixFQUFJLENBQUEsS0FBSSxDQUFFLHFCQUFvQixDQUFDLG1CQUFtQixDQUFFLFFBQU8sQ0FBQyxDQUFDO0FBRXBGLGFBQUksb0JBQW1CLENBQUc7QUFDdEIsdUJBQVcsQ0FBRSxRQUFPLENBQUMsRUFBSSxDQUFBLG9CQUFtQixBQUFDLEVBQUMsQ0FBQztVQUNuRDtBQUFBLEFBRUEsZ0JBQU07UUFFVjtBQUFBLEFBRUEsV0FBSSxNQUFPLGVBQWEsTUFBTSxDQUFFLFFBQU8sQ0FBQyxDQUFBLEdBQU0sV0FBUyxDQUFHO0FBRXRELGFBQUksS0FBSSxDQUFFLHFCQUFvQixDQUFDLEdBQUssQ0FBQSxLQUFJLENBQUUscUJBQW9CLENBQUMsZUFBZSxDQUFFLFFBQU8sQ0FBQyxDQUFHO0FBSXZGLHVCQUFXLENBQUUsUUFBTyxDQUFDLEVBQUksQ0FBQSxLQUFJLENBQUUscUJBQW9CLENBQUMsZUFBZSxDQUFFLFFBQU8sQ0FBQyxDQUFDO0FBQzlFLGtCQUFNO1VBRVY7QUFBQSxRQUVKO0FBQUEsQUFFQSxtQkFBVyxDQUFFLFFBQU8sQ0FBQyxFQUFJLENBQUEsS0FBSSxDQUFFLFFBQU8sQ0FBQyxDQUFDO01BRTVDLEVBQUMsQ0FBQztBQUVGLFdBQU8sYUFBVyxDQUFDO0lBRXZCO09FbGpCNkU7QURBckYsQUFBSSxJQUFBLGlCRHlqQkEsU0FBTSxlQUFhLENBUUgsSUFBRyxDQUFHLENBQUEsU0FBUSxDQUFHO0FBQ3pCLE9BQUcsS0FBSyxFQUFLLEtBQUcsQ0FBQztBQUNqQixPQUFHLE1BQU0sRUFBSSxDQUFBLE1BQUssT0FBTyxBQUFDLENBQUMsU0FBUSxDQUFDLENBQUM7RUNua0JULEFEb2tCaEMsQ0Nwa0JnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUY2a0JyQixhQUFTLENBQVQsVUFBVyxVQUFTLENBQUc7QUFDbkIsQUFBSSxRQUFBLENBQUEsS0FBSSxFQUFJLENBQUEsSUFBRyxrQkFBa0IsQUFBQyxDQUFDLFVBQVMsQ0FBQyxDQUFDO0FBQzlDLFdBQU8sQ0FBQSxJQUFHLGlCQUFpQixBQUFDLENBQUMsS0FBSSxDQUFDLENBQUM7SUFDdkM7QUFVQSxvQkFBZ0IsQ0FBaEIsVUFBa0IsVUFBUzs7QUFFdkIsQUFBSSxRQUFBLENBQUEsS0FBSSxFQUFJLEdBQUMsQ0FBQztBQUVkLFdBQUssS0FBSyxBQUFDLENBQUMsVUFBUyxDQUFDLFFBQVEsQUFBQyxFQUFDLFNBQUEsUUFBTztBQUVuQyxBQUFJLFVBQUEsQ0FBQSxLQUFJLEVBQWMsQ0FBQSxVQUFTLENBQUUsUUFBTyxDQUFDO0FBQ3JDLDBCQUFjLEVBQUksQ0FBQSxVQUFTLENBQUUsUUFBTyxDQUFDLENBQUM7QUFFMUMsV0FBSSxRQUFPLElBQU0sc0JBQW9CLENBQUEsRUFBSyxDQUFBLE1BQU8sZ0JBQWMsQ0FBQSxHQUFNLFlBQVUsQ0FBRztBQUc5RSxnQkFBTTtRQUVWO0FBQUEsQUFFQSxXQUFJLGVBQWMsV0FBYSxxQkFBbUIsQ0FBRztBQUVqRCx3QkFBYyxFQUFJLENBQUEsd0JBQXVCLEFBQUMsQ0FBQyxlQUFjLENBQUMsQ0FBQztBQUMzRCxlQUFLLGVBQWUsQUFBQyxDQUFDLEtBQUksQ0FBRyxTQUFPLENBQUcsQ0FBQSxlQUFjLG1CQUFtQixBQUFDLENBQUMsU0FBUSxDQUFHLFNBQU8sQ0FBQyxDQUFDLENBQUM7QUFDL0Ysd0JBQWMsVUFBVSxBQUFDLENBQUMsVUFBUyxDQUFFLFFBQU8sQ0FBQyxDQUFDLENBQUM7QUFFL0MsYUFBSSxVQUFTLENBQUUscUJBQW9CLENBQUMsQ0FBRztBQUduQyxxQkFBUyxDQUFFLHFCQUFvQixDQUFDLG1CQUFtQixDQUFFLFFBQU8sQ0FBQyxJQUFJLFNBQUEsQUFBQyxDQUFLO0FBQ25FLG1CQUFPLENBQUEsZUFBYyxPQUFPLENBQUM7WUFDakMsQ0FBQSxDQUFDO1VBRUw7QUFBQSxRQUVKO0FBQUEsQUFFQSxXQUFJLE1BQU8sZ0JBQWMsQ0FBQSxHQUFNLFdBQVMsQ0FBRztBQUd2QyxBQUFJLFlBQUEsQ0FBQSxhQUFZLEVBQUksTUFBSSxDQUFDO0FBQ3pCLGNBQUksRUFBSSxDQUFBLGVBQWMsQUFBQyxDQUFDLEtBQUksQ0FBQyxDQUFDO0FBRTlCLGFBQUksYUFBWSxJQUFNLE1BQUksQ0FBRztBQUl6QixxQkFBUyxDQUFFLHFCQUFvQixDQUFDLGVBQWUsQ0FBRSxRQUFPLENBQUMsRUFBSSxjQUFZLENBQUM7VUFFOUU7QUFBQSxRQUVKO0FBQUEsQUFFQSxZQUFJLENBQUUsUUFBTyxDQUFDLEVBQUksTUFBSSxDQUFDO01BRTNCLEVBQUMsQ0FBQztBQUVGLFdBQU8sTUFBSSxDQUFDO0lBRWhCO0FBV0EsbUJBQWUsQ0FBZixVQUFpQixLQUFJOztBQUVqQixXQUFLLEtBQUssQUFBQyxDQUFDLElBQUcsTUFBTSxDQUFDLFFBQVEsQUFBQyxFQUFDLFNBQUEsUUFBTyxDQUFLO0FBRXhDLFdBQUksTUFBTyxNQUFJLENBQUUsUUFBTyxDQUFDLENBQUEsR0FBTSxZQUFVLENBQUc7QUFHeEMsY0FBSSxDQUFFLFFBQU8sQ0FBQyxFQUFRLENBQUEsVUFBUyxDQUFFLFFBQU8sQ0FBQyxDQUFDO0FBQzFDLEFBQUksWUFBQSxDQUFBLGVBQWMsRUFBSSxDQUFBLFVBQVMsQ0FBRSxRQUFPLENBQUMsQ0FBQztBQUUxQyxhQUFJLGVBQWMsV0FBYSxxQkFBbUIsQ0FBRztBQUVqRCwwQkFBYyxFQUFJLENBQUEsd0JBQXVCLEFBQUMsQ0FBQyxlQUFjLENBQUMsQ0FBQztBQUMzRCxpQkFBSyxlQUFlLEFBQUMsQ0FBQyxLQUFJLENBQUcsU0FBTyxDQUFHLENBQUEsZUFBYyxtQkFBbUIsQUFBQyxDQUFDLFNBQVEsQ0FBRyxTQUFPLENBQUMsQ0FBQyxDQUFDO0FBQy9GLDBCQUFjLFVBQVUsQUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0FBQzdCLGtCQUFNO1VBRVY7QUFBQSxBQUVBLGFBQUksTUFBTyxXQUFTLENBQUUsUUFBTyxDQUFDLENBQUEsR0FBTSxXQUFTLENBQUc7QUFJNUMsZ0JBQUksQ0FBRSxRQUFPLENBQUMsRUFBUSxDQUFBLGVBQWMsQUFBQyxFQUFDLENBQUM7VUFFM0M7QUFBQSxRQUVKO0FBQUEsTUFFSixFQUFDLENBQUM7QUFFRixXQUFPLE1BQUksQ0FBQztJQUVoQjtBQVlBLHNCQUFrQixDQUFsQixVQUFvQixLQUFJOztBQUVwQixXQUFLLEtBQUssQUFBQyxDQUFDLEtBQUksQ0FBQyxRQUFRLEFBQUMsRUFBQyxTQUFDLFFBQU8sQ0FBTTtBQUVyQyxBQUFJLFVBQUEsQ0FBQSxlQUFjLEVBQUksQ0FBQSxVQUFTLENBQUUsUUFBTyxDQUFDLENBQUM7QUFFMUMsV0FBSSxNQUFPLGdCQUFjLENBQUEsR0FBTSxXQUFTLENBQUc7QUFDdkMsY0FBSSxDQUFFLFFBQU8sQ0FBQyxFQUFJLENBQUEsZUFBYyxBQUFDLENBQUMsS0FBSSxDQUFFLFFBQU8sQ0FBQyxDQUFDLENBQUM7UUFDdEQ7QUFBQSxNQUVKLEVBQUMsQ0FBQztBQUVGLFdBQU8sTUFBSSxDQUFDO0lBRWhCO0FBT0Esc0JBQWtCLENBQWxCLFVBQW9CLGVBQWM7QUFFOUIsQUFBSSxRQUFBLENBQUEscUJBQW9CLEVBQUksRUFBQyxlQUFjLE9BQU8sSUFBSSxDQUFHLENBQUEsZUFBYyxPQUFPLFdBQVcsQ0FBQyxDQUFDO0FBRzNGLFNBQUksZUFBYyxXQUFhLG9CQUFrQixDQUFHO0FBQ2hELHNCQUFjLHNDQUFRLG1CQUFrQixDR3B1QnhELENBQUEsZUFBYyxPQUFPLFFIb3VCd0Msc0JBQW9CLENHcHVCekMsSUhvdUIwQyxDQUFDO01BQ3ZFLEtBQU8sS0FBSSxlQUFjLFdBQWEsbUJBQWlCLENBQUc7QUFDdEQsc0JBQWMsc0NBQVEsa0JBQWlCLENHdHVCdkQsQ0FBQSxlQUFjLE9BQU8sUUhzdUJ1QyxzQkFBb0IsQ0d0dUJ4QyxJSHN1QnlDLENBQUM7TUFDdEU7QUFBQSxBQUVBLFdBQU8sZ0JBQWMsQ0FBQztJQUUxQjtPRTN1QjZFO0FEQXJGLEFBQUksSUFBQSxXRGt2QkEsU0FBTSxTQUFPLEtDbHZCdUIsQUQ0ekJwQyxDQzV6Qm9DO0FDQXhDLEVBQUMsZUFBYyxZQUFZLENBQUMsQUFBQztBRjJ2QnJCLGNBQVUsQ0FBVixVQUFZLG1CQUFrQixDQUFHLENBQUEsS0FBSSxDQUFHLENBQUEsWUFBVyxDQUFHO0FBQ2xELFdBQU8sQ0FBQSxtQkFBa0IsQUFBQyxDQUFDLE1BQU8sTUFBSSxDQUFBLEdBQU0sWUFBVSxDQUFBLENBQUksTUFBSSxFQUFJLGFBQVcsQ0FBQyxDQUFDO0lBQ25GO0FBT0EsU0FBSyxDQUFMLFVBQU8sQUFBZ0I7UUFBaEIsYUFBVyw2Q0FBSSxHQUFDOztBQUVuQixhQUFPLFNBQUMsS0FBSSxDQUFNO0FBQ2QsYUFBTyxDQUFBLGdCQUFlLEFBQUMsQ0FBQyxNQUFLLENBQUcsTUFBSSxDQUFHLGFBQVcsQ0FBQyxDQUFDO01BQ3hELEVBQUM7SUFFTDtBQU9BLFVBQU0sQ0FBTixVQUFRLEFBQWtCO1FBQWxCLGFBQVcsNkNBQUksS0FBRzs7QUFFdEIsYUFBTyxTQUFDLEtBQUksQ0FBTTtBQUNkLGFBQU8sQ0FBQSxnQkFBZSxBQUFDLENBQUMsT0FBTSxDQUFHLE1BQUksQ0FBRyxhQUFXLENBQUMsQ0FBQztNQUN6RCxFQUFDO0lBRUw7QUFPQSxTQUFLLENBQUwsVUFBTyxBQUFlO1FBQWYsYUFBVyw2Q0FBSSxFQUFBOztBQUVsQixhQUFPLFNBQUMsS0FBSSxDQUFNO0FBQ2QsYUFBTyxDQUFBLGdCQUFlLEFBQUMsQ0FBQyxNQUFLLENBQUcsTUFBSSxDQUFHLGFBQVcsQ0FBQyxDQUFDO01BQ3hELEVBQUM7SUFFTDtBQU9BLGdCQUFZLENBQVosVUFBYyxBQUFlO1FBQWYsYUFBVyw2Q0FBSSxFQUFBO0FBRXpCLGFBQU8sU0FBQSxBQUFDLENBQUs7QUFDVCxhQUFPLENBQUEsTUFBSyxBQUFDLENBQUMsWUFBVyxFQUFFLENBQUMsQ0FBQztNQUNqQyxFQUFDO0lBRUw7QUFPQSxTQUFLLENBQUwsVUFBTyxVQUFTLENBQUc7QUFDZixXQUFPLFdBQVMsQ0FBQztJQUNyQjtBQUFBLE9FMXpCNkU7QURBckYsQUFBSSxJQUFBLGVEaTBCQSxTQUFNLGFBQVcsS0NqMEJtQixBRHUxQnBDLENDdjFCb0M7QUNBeEMsRUFBQyxlQUFjLFlBQVksQ0FBQyxBQUFDO0FGeTBCckIsU0FBSyxDQUFMLFVBQU8sVUFBUyxDQUFHLENBQUEsY0FBYSxDQUFHO0FBQy9CLFdBQU8sSUFBSSxtQkFBaUIsQUFBQyxDQUFDLFVBQVMsQ0FBRyxlQUFhLENBQUMsQ0FBQztJQUM3RDtBQVFBLFVBQU0sQ0FBTixVQUFRLFVBQVMsQ0FBRyxDQUFBLGNBQWEsQ0FBRztBQUNoQyxXQUFPLElBQUksb0JBQWtCLEFBQUMsQ0FBQyxVQUFTLENBQUcsZUFBYSxDQUFDLENBQUM7SUFDOUQ7QUFBQSxPRXIxQjZFO0FEQXJGLEFBQUksSUFBQSx1QkQ0MUJBLFNBQU0scUJBQW1CLENBUVQsVUFBUyxDQUFHLENBQUEsY0FBYSxDQUFHO0FBRXBDLE9BQUcsT0FBTyxFQUFJO0FBQ1YsZUFBUyxDQUFHLGVBQWE7QUFDekIsUUFBRSxDQUFHLFdBQVM7QUFBQSxJQUNsQixDQUFDO0VDejJCMkIsQUQyMkJoQyxDQzMyQmdDO0FDQXhDLEVBQUMsZUFBYyxZQUFZLENBQUMsQUFBQztBRmszQnJCLFlBQVEsQ0FBUixVQUFVLE1BQUssQ0FBRztBQUNkLFNBQUcsT0FBTyxFQUFJLENBQUEsSUFBRyxNQUFNLEVBQUksT0FBSyxDQUFDO0lBQ3JDO0FBU0EscUJBQWlCLENBQWpCLFVBQW1CLGNBQWEsQ0FBRyxDQUFBLFFBQU8sQ0FBRyxDQUFBLGlCQUFnQixDQUFHO0FBRTVELFNBQUcsT0FBTyxFQUFJO0FBQ1YsaUJBQVMsQ0FBRyxlQUFhO0FBQ3pCLFVBQUUsQ0FBRyxTQUFPO0FBQUEsTUFDaEIsQ0FBQztBQUVELFdBQU87QUFDSCxVQUFFLENBQUcsQ0FBQSxpQkFBZ0IsSUFBSTtBQUN6QixVQUFFLENBQUcsQ0FBQSxpQkFBZ0IsSUFBSTtBQUN6QixpQkFBUyxDQUFHLEtBQUc7QUFBQSxNQUNuQixDQUFBO0lBRUo7QUFBQSxPRTE0QjZFO0FEQXJGLEFBQUksSUFBQSxzQkRpNUJBLFNBQU0sb0JBQWtCO0FJajVCNUIsa0JBQWMsaUJBQWlCLEFBQUMsQ0FBQyxJQUFHLENBQ3BCLCtCQUEwQixDQUFHLFVBQVEsQ0FBQyxDQUFBO0VIRGQsQURpK0JwQyxDQ2orQm9DO0FJQXhDLEFBQUksSUFBQSwyQ0FBb0MsQ0FBQTtBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QU55NUJyQixxQkFBaUIsQ0FBakIsVUFBbUIsY0FBYSxDQUFHLENBQUEsUUFBTyxDQUFHO0FBRXpDLFdPMzVCWixDQUFBLGVBQWMsVUFBVSxBQUFDLDhEUDI1Qm1CLGNBQWEsQ0FBRyxTQUFPLENBQUc7QUFDdEQsVUFBRSxDQUFHLENBQUEsSUFBRyxVQUFVLEtBQUssQUFBQyxDQUFDLElBQUcsQ0FBQztBQUM3QixVQUFFLENBQUcsQ0FBQSxJQUFHLFVBQVUsS0FBSyxBQUFDLENBQUMsSUFBRyxDQUFDO0FBQUEsTUFDakMsRU83NUJ3QyxDUDY1QnRDO0lBRU47QUFNQSxZQUFRLENBQVIsVUFBUyxBQUFDOztBQU1OLEFBQUksUUFBQSxDQUFBLFVBQVMsSUFBSSxTQUFBLEFBQUM7QUFFZCxhQUFPLENBQUEsaUJBQWdCLE9BQU8sT0FBTyxBQUFDLEVBQUMsU0FBQyxZQUFXLENBQU07QUFDckQsZUFBTyxDQUFBLFdBQVUsUUFBUSxBQUFDLENBQUMsWUFBVyxDQUFFLFdBQVUsSUFBSSxDQUFDLENBQUMsQ0FBQSxHQUFNLEVBQUMsQ0FBQSxDQUFDO1FBQ3BFLEVBQUMsQ0FBQztNQUVOLENBQUEsQ0FBQztBQVFELEFBQUksUUFBQSxDQUFBLFNBQVEsSUFBSSxTQUFDLFVBQVMsQ0FBRyxDQUFBLFdBQVU7QUFDbkMsYUFBTyxDQUFBLFVBQVMsT0FBTyxBQUFDLEVBQUMsU0FBQyxLQUFJO2VBQU0sQ0FBQSxXQUFVLFFBQVEsQUFBQyxDQUFDLEtBQUksQ0FBQyxDQUFBLENBQUksRUFBQTtRQUFBLEVBQUMsQ0FBQTtNQUN0RSxDQUFBLENBQUM7QUFFRCxBQUFJLFFBQUEsQ0FBQSxpQkFBZ0IsRUFBSSxDQUFBLE9BQU0sV0FBVyxBQUFDLENBQUMsSUFBRyxPQUFPLFdBQVcsQ0FBQztBQUM3RCxlQUFLLEVBQWUsQ0FBQSxVQUFTLEFBQUMsRUFBQyxDQUFDO0FBR3BDLFNBQUksTUFBSyxPQUFPLElBQU0sQ0FBQSxJQUFHLE9BQU8sT0FBTyxDQUFHO0FBR3RDLEFBQUksVUFBQSxDQUFBLFVBQVMsRUFBTSxDQUFBLE1BQUssSUFBSSxBQUFDLEVBQUMsU0FBQSxLQUFJO2VBQUssQ0FBQSxLQUFJLENBQUUsV0FBVSxJQUFJLENBQUM7UUFBQSxFQUFDO0FBQ3pELHVCQUFXLEVBQUksQ0FBQSxTQUFRLEFBQUMsQ0FBQyxJQUFHLE9BQU8sQ0FBRyxXQUFTLENBQUMsQ0FBQztBQUVyRCxtQkFBVyxRQUFRLEFBQUMsRUFBQyxTQUFDLFVBQVMsQ0FBTTtBQUVqQyxBQUFJLFlBQUEsQ0FBQSxhQUFZLEVBQUksR0FBQyxDQUFDO0FBQ3RCLHNCQUFZLENBQUUsV0FBVSxJQUFJLENBQUMsRUFBSSxXQUFTLENBQUM7QUFDM0MsMEJBQWdCLFVBQVUsQUFBQyxDQUFDLGFBQVksQ0FBQyxDQUFDO1FBRTlDLEVBQUMsQ0FBQztBQUdGLGFBQUssRUFBSSxDQUFBLFVBQVMsQUFBQyxFQUFDLENBQUM7TUFFekI7QUFBQSxBQUVBLFdBQU8sT0FBSyxDQUFDO0lBRWpCO0FBTUEsWUFBUSxDQUFSLFVBQVUsTUFBSyxDQUFHO0FBQ2QsU0FBRyxPQUFPLEVBQUksT0FBSyxDQUFDO0lBQ3hCO0FBQUEsT0E5RThCLHFCQUFtQixDTWg1QkQ7QUxEeEQsQUFBSSxJQUFBLHFCRHMrQkEsU0FBTSxtQkFBaUI7QUl0K0IzQixrQkFBYyxpQkFBaUIsQUFBQyxDQUFDLElBQUcsQ0FDcEIsOEJBQTBCLENBQUcsVUFBUSxDQUFDLENBQUE7RUhEZCxBRGtpQ3BDLENDbGlDb0M7QUlBeEMsQUFBSSxJQUFBLHlDQUFvQyxDQUFBO0FDQXhDLEVBQUMsZUFBYyxZQUFZLENBQUMsQUFBQztBTjgrQnJCLHFCQUFpQixDQUFqQixVQUFtQixjQUFhLENBQUcsQ0FBQSxRQUFPLENBQUc7QUFFekMsV09oL0JaLENBQUEsZUFBYyxVQUFVLEFBQUMsNkRQZy9CbUIsY0FBYSxDQUFHLFNBQU8sQ0FBRztBQUN0RCxVQUFFLENBQUcsQ0FBQSxJQUFHLFNBQVMsS0FBSyxBQUFDLENBQUMsSUFBRyxDQUFDO0FBQzVCLFVBQUUsQ0FBRyxDQUFBLElBQUcsU0FBUyxLQUFLLEFBQUMsQ0FBQyxJQUFHLENBQUM7QUFBQSxNQUNoQyxFT2wvQndDLENQay9CdEM7SUFFTjtBQU1BLFdBQU8sQ0FBUCxVQUFRLEFBQUM7O0FBTUwsQUFBSSxRQUFBLENBQUEsU0FBUSxJQUFJLFNBQUEsQUFBQztBQUNiLGFBQU8sQ0FBQSxpQkFBZ0IsT0FBTyxLQUFLLEFBQUMsRUFBQyxTQUFDLFlBQVcsQ0FBTTtBQUNuRCxlQUFPLENBQUEsVUFBUyxJQUFNLENBQUEsWUFBVyxDQUFFLFdBQVUsSUFBSSxDQUFDLENBQUM7UUFDdkQsRUFBQyxDQUFDO01BQ04sQ0FBQSxDQUFDO0FBRUQsQUFBSSxRQUFBLENBQUEsaUJBQWdCLEVBQUksQ0FBQSxPQUFNLFdBQVcsQUFBQyxDQUFDLElBQUcsT0FBTyxXQUFXLENBQUM7QUFDN0QsY0FBSSxFQUFnQixDQUFBLFNBQVEsQUFBQyxFQUFDLENBQUM7QUFFbkMsU0FBSSxDQUFDLEtBQUksQ0FBRztBQUdSLEFBQUksVUFBQSxDQUFBLGFBQVksRUFBTSxHQUFDLENBQUM7QUFDeEIsb0JBQVksQ0FBRSxJQUFHLE9BQU8sSUFBSSxDQUFDLEVBQUksQ0FBQSxJQUFHLE1BQU0sQ0FBQztBQUMzQyx3QkFBZ0IsVUFBVSxBQUFDLENBQUMsYUFBWSxDQUFDLENBQUM7QUFHMUMsWUFBSSxFQUFJLENBQUEsU0FBUSxBQUFDLEVBQUMsQ0FBQztNQUV2QjtBQUFBLEFBRUEsV0FBTyxNQUFJLENBQUM7SUFFaEI7QUFNQSxXQUFPLENBQVAsVUFBUyxLQUFJLENBQUc7QUFDWixTQUFHLE1BQU0sRUFBSSxNQUFJLENBQUM7SUFDdEI7QUFBQSxPQTFENkIscUJBQW1CLENNcitCQTtBTm9pQ3BELFFBQU0sUUFBUSxFQUFXLElBQUksUUFBTSxBQUFDLEVBQUMsQ0FBQztBQUN0QyxRQUFNLFFBQVEsT0FBTyxFQUFJLDBCQUF3QixDQUFDO0FBRXRELENBQUMsQUFBQyxDQUFDLE1BQUssQ0FBQyxDQUFDO0FBQUEiLCJmaWxlIjoiY2F0d2Fsay5lczUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oJHdpbmRvdykge1xuXG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvKipcbiAgICAgKiBAY29uc3RhbnQgQ0FUV0FMS19NRVRBX1BST1BFUlRZXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICBjb25zdCBDQVRXQUxLX01FVEFfUFJPUEVSVFkgPSAnX19jYXR3YWxrJztcblxuICAgIC8qKlxuICAgICAqIEBjb25zdGFudCBDQVRXQUxLX1NUQVRFX1BST1BFUlRJRVNcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIGNvbnN0IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMgPSB7IE5FVzogMSwgRElSVFk6IDIsIFNBVkVEOiA0LCBERUxFVEVEOiA4IH07XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgQ2F0d2Fsa1xuICAgICAqL1xuICAgIGNsYXNzIENhdHdhbGsge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHJldHVybiB7Q2F0d2Fsa31cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudHMgICAgICAgPSB7fTtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbnMgID0ge307XG4gICAgICAgICAgICB0aGlzLnJlbGF0aW9uc2hpcCA9IG5ldyBSZWxhdGlvbnNoaXAoKTtcbiAgICAgICAgICAgIHRoaXMudHlwZWNhc3QgICAgID0gbmV3IFR5cGVjYXN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjcmVhdGVDb2xsZWN0aW9uXG4gICAgICAgICAqIEByZXR1cm4ge0NvbGxlY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGVDb2xsZWN0aW9uKG5hbWUsIHByb3BlcnRpZXMpIHtcblxuICAgICAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBuZXcgQ29sbGVjdGlvbihuYW1lLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbnNbbmFtZV0gPSBjb2xsZWN0aW9uO1xuICAgICAgICAgICAgcmV0dXJuIGNvbGxlY3Rpb247XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNvbGxlY3Rpb25cbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNvbGxlY3Rpb24obmFtZSkge1xuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuY29sbGVjdGlvbnNbbmFtZV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50aHJvd0V4Y2VwdGlvbihgVW5hYmxlIHRvIGZpbmQgY29sbGVjdGlvbiBcIiR7bmFtZX1cImApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uc1tuYW1lXTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgdGhyb3dFeGNlcHRpb25cbiAgICAgICAgICogQHRocm93cyBFeGNlcHRpb25cbiAgICAgICAgICogQHBhcmFtIG1lc3NhZ2Uge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHRocm93RXhjZXB0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHRocm93IGBDYXR3YWxrOiAke21lc3NhZ2V9LmA7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnRGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBvbihuYW1lLCBldmVudEZuKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50c1tuYW1lXSA9IGV2ZW50Rm47XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBvZmZcbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIG9mZihuYW1lKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudHNbbmFtZV07XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgY2xhc3MgQ29sbGVjdGlvbiB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IobmFtZSwgcHJvcGVydGllcykge1xuICAgICAgICAgICAgdGhpcy5pZCAgICAgICAgPSAwO1xuICAgICAgICAgICAgdGhpcy5uYW1lICAgICAgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tb2RlbHMgICAgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuc2lsZW50ICAgID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmJsdWVwcmludCA9IG5ldyBCbHVlcHJpbnRNb2RlbChuYW1lLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNpbGVudGx5XG4gICAgICAgICAqIEBwYXJhbSBzaWxlbnRGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzaWxlbnRseShzaWxlbnRGbikge1xuICAgICAgICAgICAgdGhpcy5zaWxlbnQgPSB0cnVlO1xuICAgICAgICAgICAgc2lsZW50Rm4uYXBwbHkodGhpcyk7XG4gICAgICAgICAgICB0aGlzLnNpbGVudCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3JlYXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIFtwcm9wZXJ0aWVzPXt9XSB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGVNb2RlbChwcm9wZXJ0aWVzID0ge30pIHtcblxuICAgICAgICAgICAgdGhpcy5pbmplY3RNZXRhKHByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIG1vZGVsIGNvbmZvcm1zIHRvIHRoZSBibHVlcHJpbnQuXG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLmJsdWVwcmludC5pdGVyYXRlQWxsKHByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICBPYmplY3Quc2VhbChtb2RlbCk7XG4gICAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuaXNzdWVQcm9taXNlKCdjcmVhdGUnLCBtb2RlbCwgbnVsbCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlYWRNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZWFkTW9kZWwocHJvcGVydGllcykge1xuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ3JlYWQnLCBwcm9wZXJ0aWVzLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0aWVzO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgdXBkYXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZU1vZGVsKG1vZGVsLCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIGNvcHkgb2YgdGhlIG9sZCBtb2RlbCBmb3Igcm9sbGluZyBiYWNrLlxuICAgICAgICAgICAgdmFyIHByZXZpb3VzTW9kZWwgPSB7fTtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHByZXZpb3VzTW9kZWxbcHJvcGVydHldID0gbW9kZWxbcHJvcGVydHldKTtcblxuICAgICAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgICAgIC8vIENvcHkgYWNyb3NzIHRoZSBkYXRhIGZyb20gdGhlIHByb3BlcnRpZXMuIFdlIHdyYXAgdGhlIGFzc2lnbm1lbnQgaW4gYSB0cnktY2F0Y2ggYmxvY2tcbiAgICAgICAgICAgICAgICAvLyBiZWNhdXNlIGlmIHRoZSB1c2VyIGhhcyBhZGRlZCBhbnkgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIHRoYXQgZG9uJ3QgYmVsb25nIGluIHRoZSBtb2RlbCxcbiAgICAgICAgICAgICAgICAvLyBhbiBleGNlcHRpb24gd2lsbCBiZSByYWlzZWQgYmVjYXVzZSB0aGUgb2JqZWN0IGlzIHNlYWxlZC5cbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKHByb3BlcnR5ID0+IG1vZGVsW3Byb3BlcnR5XSA9IHByb3BlcnRpZXNbcHJvcGVydHldKTtcblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHt9XG5cblxuICAgICAgICAgICAgLy8gVHlwZWNhc3QgdGhlIHVwZGF0ZWQgbW9kZWwgYW5kIGNvcHkgYWNyb3NzIGl0cyBwcm9wZXJ0aWVzIHRvIHRoZSBjdXJyZW50IG1vZGVsLCBzbyBhcyB3ZVxuICAgICAgICAgICAgLy8gZG9uJ3QgYnJlYWsgYW55IHJlZmVyZW5jZXMuXG4gICAgICAgICAgICB2YXIgdHlwZWNhc3RNb2RlbCA9IHRoaXMuYmx1ZXByaW50LnJlaXRlcmF0ZVByb3BlcnRpZXMobW9kZWwpO1xuICAgICAgICAgICAgT2JqZWN0LmtleXModHlwZWNhc3RNb2RlbCkuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gdHlwZWNhc3RNb2RlbFtwcm9wZXJ0eV1cblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNzdWVQcm9taXNlKCd1cGRhdGUnLCBtb2RlbCwgcHJldmlvdXNNb2RlbCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlbGV0ZU1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWxldGVNb2RlbChtb2RlbCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgcmVtb3ZlXG4gICAgICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICAgICAqIEBwYXJhbSBpbmRleCB7TnVtYmVyfVxuICAgICAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgcmVtb3ZlID0gKG1vZGVsLCBpbmRleCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2RlbGV0ZScsIG51bGwsIG1vZGVsKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIERldGVybWluZXMgd2hldGhlciB0aGUgbW9kZWwgd2FzIHN1Y2Nlc3NmdWxseSBkZWxldGVkIHdpdGggZmluZGluZyB0aGUgbW9kZWwgYnkgcmVmZXJlbmNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEBwcm9wZXJ0eSBkaWREZWxldGVWaWFSZWZlcmVuY2VcbiAgICAgICAgICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgZGlkRGVsZXRlVmlhUmVmZXJlbmNlID0gZmFsc2U7XG5cbiAgICAgICAgICAgICgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZmluZCB0aGUgbW9kZWwgYnkgcmVmZXJlbmNlLlxuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMubW9kZWxzLmluZGV4T2YobW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBkaWREZWxldGVWaWFSZWZlcmVuY2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmUodGhpcy5tb2RlbHNbaW5kZXhdLCBpbmRleCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICAoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKGRpZERlbGV0ZVZpYVJlZmVyZW5jZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gMDtcblxuICAgICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBtb2RlbCBieSBpdHMgaW50ZXJuYWwgQ2F0d2FsayBJRC5cbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5mb3JFYWNoKChjdXJyZW50TW9kZWwpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQgPT09IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShjdXJyZW50TW9kZWwsIGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSkoKTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhZGRBc3NvY2lhdGlvblxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnR5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtBcnJheX1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkQXNzb2NpYXRpb24obW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIGlmICghKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc01hbnkpKSB7XG4gICAgICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignVXNpbmcgYGFkZEFzc29jaWF0aW9uYCByZXF1aXJlcyBhIGhhc01hbnkgcmVsYXRpb25zaGlwJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjdXJyZW50UHJvcGVydGllcyA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XSgpO1xuICAgICAgICAgICAgY3VycmVudFByb3BlcnRpZXMgICAgID0gY3VycmVudFByb3BlcnRpZXMuY29uY2F0KHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgdmFyIHVwZGF0ZURhdGEgICAgICAgID0ge307XG4gICAgICAgICAgICB1cGRhdGVEYXRhW3Byb3BlcnR5XSAgPSBjdXJyZW50UHJvcGVydGllcztcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVwZGF0ZU1vZGVsKG1vZGVsLCB1cGRhdGVEYXRhKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVtb3ZlQXNzb2NpYXRpb25cbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7QXJyYXl9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZUFzc29jaWF0aW9uKG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydGllcykge1xuXG4gICAgICAgICAgICBpZiAoISh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNNYW55KSkge1xuICAgICAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oJ1VzaW5nIGByZW1vdmVBc3NvY2lhdGlvbmAgcmVxdWlyZXMgYSBoYXNNYW55IHJlbGF0aW9uc2hpcCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY3VycmVudFByb3BlcnRpZXMgPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0oKTtcblxuICAgICAgICAgICAgcHJvcGVydGllcy5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRQcm9wZXJ0aWVzLmluZGV4T2YocHJvcGVydHkpO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRQcm9wZXJ0aWVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIHVwZGF0ZURhdGEgICAgICAgID0ge307XG4gICAgICAgICAgICB1cGRhdGVEYXRhW3Byb3BlcnR5XSAgPSBjdXJyZW50UHJvcGVydGllcztcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVwZGF0ZU1vZGVsKG1vZGVsLCB1cGRhdGVEYXRhKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaW5qZWN0TWV0YVxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaW5qZWN0TWV0YShtb2RlbCkge1xuXG4gICAgICAgICAgICBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldID0ge1xuICAgICAgICAgICAgICAgIGlkOiArK3RoaXMuaWQsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLk5FVyxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFZhbHVlczoge30sXG4gICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwVmFsdWVzOiB7fVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBpc3N1ZVByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBpc3N1ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc2lsZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhdHdhbGsuZXZlbnRzW2V2ZW50TmFtZV0gIT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgIC8vIENhbGxiYWNrIGhhcyBub3QgYWN0dWFsbHkgYmVlbiBzZXQtdXAgYW5kIHRoZXJlZm9yZSBtb2RlbHMgd2lsbCBuZXZlciBiZVxuICAgICAgICAgICAgICAgIC8vIHBlcnNpc3RlZC5cbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgdGhlIHByb21pc2UgZm9yIGJhY2stZW5kIHBlcnNpc3RlbmNlIG9mIHRoZSBtb2RlbC5cbiAgICAgICAgICAgICAgICBjYXR3YWxrLmV2ZW50c1tldmVudE5hbWVdKHRoaXMubmFtZSwgdGhpcy5jbGVhbk1vZGVsKGN1cnJlbnRNb2RlbCB8fCBwcmV2aW91c01vZGVsKSwge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlOiByZXNvbHZlLCByZWplY3Q6IHJlamVjdFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9KS50aGVuKChyZXNvbHV0aW9uUGFyYW1zKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBQcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkIVxuICAgICAgICAgICAgICAgIHRoaXMucmVzb2x2ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpKHJlc29sdXRpb25QYXJhbXMpO1xuXG4gICAgICAgICAgICB9LCAocmVzb2x1dGlvblBhcmFtcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gUHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZCFcbiAgICAgICAgICAgICAgICB0aGlzLnJlamVjdFByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpKHJlc29sdXRpb25QYXJhbXMpO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVzb2x2ZVByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfSAtIEV2ZW50IG5hbWUgaXMgYWN0dWFsbHkgbm90IHJlcXVpcmVkLCBiZWNhdXNlIHdlIGNhbiBkZWR1Y2UgdGhlIHN1YnNlcXVlbnQgYWN0aW9uXG4gICAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tIHRoZSBzdGF0ZSBvZiB0aGUgYGN1cnJlbnRNb2RlbGAgYW5kIGBwcmV2aW91c01vZGVsYCwgYnV0IHdlIGFkZCBpdCB0byBhZGRcbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXJpZmljYXRpb24gdG8gb3VyIGxvZ2ljYWwgc3RlcHMuXG4gICAgICAgICAqIEBwYXJhbSBjdXJyZW50TW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByZXZpb3VzTW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICByZXNvbHZlUHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkge1xuXG4gICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsICYmIGV2ZW50TmFtZSA9PT0gJ2NyZWF0ZScpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1vZGVsIGhhcyBiZWVuIHN1Y2Nlc3NmdWxseSBwZXJzaXN0ZWQhXG4gICAgICAgICAgICAgICAgY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5TQVZFRDtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXaGVuIHdlJ3JlIGluIHRoZSBwcm9jZXNzIG9mIGRlbGV0aW5nIGEgbW9kZWwsIHRoZSBgY3VycmVudE1vZGVsYCBpcyB1bnNldDsgaW5zdGVhZCB0aGVcbiAgICAgICAgICAgIC8vIGBwcmV2aW91c01vZGVsYCB3aWxsIGJlIGRlZmluZWQuXG4gICAgICAgICAgICBpZiAoKGN1cnJlbnRNb2RlbCA9PT0gbnVsbCAmJiBwcmV2aW91c01vZGVsKSAmJiBldmVudE5hbWUgPT09ICdkZWxldGUnKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgZGVsZXRlZCFcbiAgICAgICAgICAgICAgICBwcmV2aW91c01vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ERUxFVEVEO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAocHJvcGVydGllcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgZXZlbnROYW1lICE9PSAncmVhZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzICYmICFwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KENBVFdBTEtfTUVUQV9QUk9QRVJUWSkgJiYgZXZlbnROYW1lID09PSAncmVhZCcpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5jcmVhdGVNb2RlbChwcm9wZXJ0aWVzKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBtb2RlbCB0byByZWZsZWN0IHRoZSBjaGFuZ2VzIG9uIHRoZSBvYmplY3QgdGhhdCBgcmVhZE1vZGVsYCByZXR1cm4uXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgbW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5RW1pdEV2ZW50KCk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlamVjdFByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgcmVqZWN0UHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgcmVqZWN0V2l0aFxuICAgICAgICAgICAgICogQHBhcmFtIGR1cGxpY2F0ZU1vZGVsIHtPYmplY3R9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgcmVqZWN0V2l0aCA9IChkdXBsaWNhdGVNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKGR1cGxpY2F0ZU1vZGVsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChldmVudE5hbWUgPT09ICd1cGRhdGUnICYmIGR1cGxpY2F0ZU1vZGVsLmhhc093blByb3BlcnR5KENBVFdBTEtfTUVUQV9QUk9QRVJUWSkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVzZXIgcGFzc2VkIGluIGEgbW9kZWwgYW5kIHRoZXJlZm9yZSB0aGUgcHJldmlvdXMgc2hvdWxkIGJlIGRlbGV0ZWQsIGJ1dCBvbmx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2hlbiB3ZSdyZSB1cGRhdGluZyFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlbGV0ZU1vZGVsKHByZXZpb3VzTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzTW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLkRFTEVURUQ7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXNlIHRoZSBkdXBsaWNhdGUgbW9kZWwgYXMgdGhlIHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBkdXBsaWNhdGVNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLlNBVkVEO1xuXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5RW1pdEV2ZW50KCk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChwcmV2aW91c01vZGVsID09PSBudWxsICYmIGV2ZW50TmFtZSA9PT0gJ2NyZWF0ZScpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByZXZpb3VzIG1vZGVsIHdhcyBhY3R1YWxseSBOVUxMIGFuZCB0aGVyZWZvcmUgd2UnbGwgZGVsZXRlIGl0LlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlbGV0ZU1vZGVsKGN1cnJlbnRNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuREVMRVRFRDtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFdpdGg7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGN1cnJlbnRNb2RlbCA9PT0gbnVsbCAmJiBldmVudE5hbWUgPT09ICdkZWxldGUnICkge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRGV2ZWxvcGVyIGRvZXNuJ3QgYWN0dWFsbHkgd2FudCB0byBkZWxldGUgdGhlIG1vZGVsLCBhbmQgdGhlcmVmb3JlIHdlIG5lZWQgdG8gcmV2ZXJ0IGl0IHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBtb2RlbCBpdCB3YXMsIGFuZCBzZXQgaXRzIGZsYWcgYmFjayB0byB3aGF0IGl0IHdhcy5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy51cGRhdGVNb2RlbCh7fSwgcHJldmlvdXNNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKChjdXJyZW50TW9kZWwgJiYgcHJldmlvdXNNb2RlbCkgJiYgZXZlbnROYW1lID09PSAndXBkYXRlJykge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQm90aCBvZiB0aGUgY3VycmVudCBhbmQgcHJldmlvdXMgbW9kZWxzIGFyZSB1cGRhdGVkLCBhbmQgdGhlcmVmb3JlIHdlJ2xsIHNpbXBseVxuICAgICAgICAgICAgICAgICAgICAvLyByZXZlcnQgdGhlIGN1cnJlbnQgbW9kZWwgdG8gdGhlIHByZXZpb3VzIG1vZGVsLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0V2l0aDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY29uZGl0aW9uYWxseUVtaXRFdmVudFxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uZGl0aW9uYWxseUVtaXRFdmVudCgpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYXR3YWxrLmV2ZW50cy5yZWZyZXNoID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSdyZSBhbGwgZG9uZSFcbiAgICAgICAgICAgICAgICBjYXR3YWxrLmV2ZW50cy5yZWZyZXNoKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY2xlYW5Nb2RlbFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgY2xlYW5Nb2RlbChtb2RlbCkge1xuXG4gICAgICAgICAgICB2YXIgY2xlYW5lZE1vZGVsID0ge307XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gQ0FUV0FMS19NRVRBX1BST1BFUlRZKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ2F0d2FsayBtZXRhIGRhdGEgc2hvdWxkIG5ldmVyIGJlIHBlcnNpc3RlZCB0byB0aGUgYmFjay1lbmQuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpZiB0aGUgcHJvcGVydHkgaXMgYWN0dWFsbHkgYSByZWxhdGlvbnNoaXAsIHdoaWNoIHdlIG5lZWQgdG8gcmVzb2x2ZSB0b1xuICAgICAgICAgICAgICAgIC8vIGl0cyBwcmltaXRpdmUgdmFsdWUocykuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcEZ1bmN0aW9uID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYW5lZE1vZGVsW3Byb3BlcnR5XSA9IHJlbGF0aW9uc2hpcEZ1bmN0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldICYmIG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ub3JpZ2luYWxWYWx1ZXNbcHJvcGVydHldKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgZGlzY292ZXJlZCBhIHR5cGVjYXN0ZWQgcHJvcGVydHkgdGhhdCBuZWVkcyB0byBiZSByZXZlcnRlZCB0byBpdHMgb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhbHVlIGJlZm9yZSBpbnZva2luZyB0aGUgY2FsbGJhY2suXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5vcmlnaW5hbFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY2xlYW5lZE1vZGVsW3Byb3BlcnR5XSA9IG1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBjbGVhbmVkTW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIEJsdWVwcmludE1vZGVsXG4gICAgICovXG4gICAgY2xhc3MgQmx1ZXByaW50TW9kZWwge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGJsdWVwcmludCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtCbHVlcHJpbnRNb2RlbH1cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKG5hbWUsIGJsdWVwcmludCkge1xuICAgICAgICAgICAgdGhpcy5uYW1lICA9IG5hbWU7XG4gICAgICAgICAgICB0aGlzLm1vZGVsID0gT2JqZWN0LmZyZWV6ZShibHVlcHJpbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnZlbmllbmNlIG1ldGhvZCB0aGF0IHdyYXBzIGBpdGVyYXRlUHJvcGVydGllc2AgYW5kIGBpdGVyYXRlQmx1ZXByaW50YCBpbnRvIGEgb25lLWxpbmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIGl0ZXJhdGVBbGxcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZUFsbChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLml0ZXJhdGVQcm9wZXJ0aWVzKHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXRlcmF0ZUJsdWVwcmludChtb2RlbCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIGl0ZXJhdGluZyBvdmVyIHRoZSBwYXNzZWQgaW4gbW9kZWwgcHJvcGVydGllcyB0byBlbnN1cmUgdGhleSdyZSBpbiB0aGUgYmx1ZXByaW50LFxuICAgICAgICAgKiBhbmQgdHlwZWNhc3RpbmcgdGhlIHByb3BlcnRpZXMgYmFzZWQgb24gdGhlIGRlZmluZSBibHVlcHJpbnQgZm9yIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZVByb3BlcnRpZXNcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZVByb3BlcnRpZXMocHJvcGVydGllcykge1xuXG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB7fTtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMocHJvcGVydGllcykuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgICAgICAgICAgID0gcHJvcGVydGllc1twcm9wZXJ0eV0sXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5ICE9PSBDQVRXQUxLX01FVEFfUFJPUEVSVFkgJiYgdHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ3VuZGVmaW5lZCcpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcm9wZXJ0eSBkb2Vzbid0IGJlbG9uZyBpbiB0aGUgbW9kZWwgYmVjYXVzZSBpdCdzIG5vdCBpbiB0aGUgYmx1ZXByaW50LlxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLnJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydHlIYW5kbGVyLmRlZmluZVJlbGF0aW9uc2hpcCh0aGlzLm5hbWUsIHByb3BlcnR5KSk7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlci5zZXRWYWx1ZXMocHJvcGVydGllc1twcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIG9yaWdpbmFsIHZhbHVlIG9mIHRoZSByZWxhdGlvbnNoaXAgdG8gcmVzb2x2ZSB3aGVuIGNsZWFuaW5nIHRoZSBtb2RlbC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0eUhhbmRsZXIudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFR5cGVjYXN0IHByb3BlcnR5IHRvIHRoZSBkZWZpbmVkIHR5cGUuXG4gICAgICAgICAgICAgICAgICAgIHZhciBvcmlnaW5hbFZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydHlIYW5kbGVyKHZhbHVlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAob3JpZ2luYWxWYWx1ZSAhPT0gdmFsdWUpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIG9yaWdpbmFsIHZhbHVlIHNvIHRoYXQgd2UgY2FuIHJldmVydCBpdCBmb3Igd2hlbiBpbnZva2luZyB0aGUgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHdpdGggdGhlIGBjbGVhbk1vZGVsYCBtZXRob2QuXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ub3JpZ2luYWxWYWx1ZXNbcHJvcGVydHldID0gb3JpZ2luYWxWYWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSB2YWx1ZTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBtb2RlbDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlc3BvbnNpYmxlIGZvciBpdGVyYXRpbmcgb3ZlciB0aGUgYmx1ZXByaW50IHRvIGRldGVybWluZSBpZiBhbnkgcHJvcGVydGllcyBhcmUgbWlzc2luZ1xuICAgICAgICAgKiBmcm9tIHRoZSBjdXJyZW50IG1vZGVsLCB0aGF0IGhhdmUgYmVlbiBkZWZpbmVkIGluIHRoZSBibHVlcHJpbnQgYW5kIHRoZXJlZm9yZSBzaG91bGQgYmVcbiAgICAgICAgICogcHJlc2VudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCBpdGVyYXRlQmx1ZXByaW50XG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBpdGVyYXRlQmx1ZXByaW50KG1vZGVsKSB7XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHRoaXMubW9kZWwpLmZvckVhY2gocHJvcGVydHkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtb2RlbFtwcm9wZXJ0eV0gPT09ICd1bmRlZmluZWQnKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRW5zdXJlIHRoYXQgaXQgaXMgZGVmaW5lZC5cbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldICAgICA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMucmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydHlIYW5kbGVyLmRlZmluZVJlbGF0aW9uc2hpcCh0aGlzLm5hbWUsIHByb3BlcnR5KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIuc2V0VmFsdWVzKFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm1vZGVsW3Byb3BlcnR5XSA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgaWYgdGhlIHByb3BlcnR5IGhhcyBhIHByb3BlcnR5IGhhbmRsZXIgbWV0aG9kIHdoaWNoIHdvdWxkIGJlIHJlc3BvbnNpYmxlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBmb3IgdHlwZWNhc3RpbmcsIGFuZCBkZXRlcm1pbmluZyB0aGUgZGVmYXVsdCB2YWx1ZS5cbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSAgICAgPSBwcm9wZXJ0eUhhbmRsZXIoKTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZXNwb25zaWJsZSBmb3IgcmVpdGVyYXRpbmcgb3ZlciB0aGUgbW9kZWwgdG8gb25jZSBhZ2FpbiB0eXBlY2FzdCB0aGUgdmFsdWVzOyB3aGljaCBpc1xuICAgICAgICAgKiBlc3BlY2lhbGx5IHVzZWZ1bCBmb3Igd2hlbiB0aGUgbW9kZWwgaGFzIGJlZW4gdXBkYXRlZCwgYnV0IHJlbGF0aW9uc2hpcHMgbmVlZCB0byBiZSBsZWZ0XG4gICAgICAgICAqIGFsb25lLiBTaW5jZSB0aGUgbW9kZWwgaXMgc2VhbGVkIHdlIGNhbiBhbHNvIGd1YXJhbnRlZSB0aGF0IG5vIG90aGVyIHByb3BlcnRpZXMgaGF2ZSBiZWVuXG4gICAgICAgICAqIGFkZGVkIGludG8gdGhlIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIHJlaXRlcmF0ZVByb3BlcnRpZXNcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlaXRlcmF0ZVByb3BlcnRpZXMobW9kZWwpIHtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kZWwpLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gPSBwcm9wZXJ0eUhhbmRsZXIobW9kZWxbcHJvcGVydHldKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlbGF0aW9uc2hpcEhhbmRsZXJcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnR5SGFuZGxlciB7UmVsYXRpb25zaGlwQWJzdHJhY3R9XG4gICAgICAgICAqIEByZXR1cm4ge1JlbGF0aW9uc2hpcEFic3RyYWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgcmVsYXRpb25zaGlwSGFuZGxlcihwcm9wZXJ0eUhhbmRsZXIpIHtcblxuICAgICAgICAgICAgdmFyIGluc3RhbnRpYXRlUHJvcGVydGllcyA9IFtwcm9wZXJ0eUhhbmRsZXIudGFyZ2V0LmtleSwgcHJvcGVydHlIYW5kbGVyLnRhcmdldC5jb2xsZWN0aW9uXTtcblxuICAgICAgICAgICAgLy8gSW5zdGFudGlhdGUgYSBuZXcgcmVsYXRpb25zaGlwIHBlciBtb2RlbC5cbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eUhhbmRsZXIgaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNNYW55KSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gbmV3IFJlbGF0aW9uc2hpcEhhc01hbnkoLi4uaW5zdGFudGlhdGVQcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzT25lKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gbmV3IFJlbGF0aW9uc2hpcEhhc09uZSguLi5pbnN0YW50aWF0ZVByb3BlcnRpZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcHJvcGVydHlIYW5kbGVyO1xuXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBUeXBlY2FzdFxuICAgICAqL1xuICAgIGNsYXNzIFR5cGVjYXN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXR1cm5WYWx1ZVxuICAgICAgICAgKiBAcGFyYW0gdHlwZWNhc3RDb25zdHJ1Y3RvciB7RnVuY3Rpb259XG4gICAgICAgICAqIEBwYXJhbSB2YWx1ZSB7Kn1cbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7Kn1cbiAgICAgICAgICogQHJldHVybiB7Kn1cbiAgICAgICAgICovXG4gICAgICAgIHJldHVyblZhbHVlKHR5cGVjYXN0Q29uc3RydWN0b3IsIHZhbHVlLCBkZWZhdWx0VmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiB0eXBlY2FzdENvbnN0cnVjdG9yKHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgPyB2YWx1ZSA6IGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzdHJpbmdcbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHN0cmluZyhkZWZhdWx0VmFsdWUgPSAnJykge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoU3RyaW5nLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGJvb2xlYW5cbiAgICAgICAgICogQHBhcmFtIGRlZmF1bHRWYWx1ZSB7Qm9vbGVhbn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBib29sZWFuKGRlZmF1bHRWYWx1ZSA9IHRydWUpIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKEJvb2xlYW4sIHZhbHVlLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgbnVtYmVyXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge051bWJlcn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBudW1iZXIoZGVmYXVsdFZhbHVlID0gMCkge1xuXG4gICAgICAgICAgICByZXR1cm4gKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmV0dXJuVmFsdWUoTnVtYmVyLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBtZXRob2QgYXV0b0luY3JlbWVudFxuICAgICAgICAgKiBAcGFyYW0gaW5pdGlhbFZhbHVlIHtOdW1iZXJ9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgYXV0b0luY3JlbWVudChpbml0aWFsVmFsdWUgPSAxKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE51bWJlcihpbml0aWFsVmFsdWUrKyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBjdXN0b21cbiAgICAgICAgICogQHBhcmFtIHR5cGVjYXN0Rm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGN1c3RvbSh0eXBlY2FzdEZuKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZWNhc3RGbjtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcFxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaGFzT25lXG4gICAgICAgICAqIEBwYXJhbSBmb3JlaWduS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBIYXNPbmV9XG4gICAgICAgICAqL1xuICAgICAgICBoYXNPbmUoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUmVsYXRpb25zaGlwSGFzT25lKGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGhhc01hbnlcbiAgICAgICAgICogQHBhcmFtIGZvcmVpZ25LZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge1JlbGF0aW9uc2hpcEhhc01hbnl9XG4gICAgICAgICAqL1xuICAgICAgICBoYXNNYW55KGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc01hbnkoZm9yZWlnbktleSwgY29sbGVjdGlvbk5hbWUpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwQWJzdHJhY3RcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXBBYnN0cmFjdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gZm9yZWlnbktleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKSB7XG5cbiAgICAgICAgICAgIHRoaXMudGFyZ2V0ID0ge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIGtleTogZm9yZWlnbktleVxuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2V0VmFsdWVzXG4gICAgICAgICAqIEBwYXJhbSB2YWx1ZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNldFZhbHVlcyh2YWx1ZXMpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWVzID0gdGhpcy52YWx1ZSA9IHZhbHVlcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlZmluZVJlbGF0aW9uc2hpcFxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBhY2Nlc3NvckZ1bmN0aW9ucyB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXksIGFjY2Vzc29yRnVuY3Rpb25zKSB7XG5cbiAgICAgICAgICAgIHRoaXMuc291cmNlID0ge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgIGtleTogbG9jYWxLZXlcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZ2V0OiBhY2Nlc3NvckZ1bmN0aW9ucy5nZXQsXG4gICAgICAgICAgICAgICAgc2V0OiBhY2Nlc3NvckZ1bmN0aW9ucy5zZXQsXG4gICAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBIYXNNYW55XG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwSGFzTWFueSBleHRlbmRzIFJlbGF0aW9uc2hpcEFic3RyYWN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5KSB7XG5cbiAgICAgICAgICAgIHJldHVybiBzdXBlci5kZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCB7XG4gICAgICAgICAgICAgICAgZ2V0OiB0aGlzLmdldE1vZGVscy5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgICAgIHNldDogdGhpcy5zZXRNb2RlbHMuYmluZCh0aGlzKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGdldE1vZGVsc1xuICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGdldE1vZGVscygpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIGxvYWRNb2RlbHNcbiAgICAgICAgICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgbG9hZE1vZGVscyA9ICgpID0+IHtcblxuICAgICAgICAgICAgICAgIHJldHVybiBmb3JlaWduQ29sbGVjdGlvbi5tb2RlbHMuZmlsdGVyKChmb3JlaWduTW9kZWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWVzLmluZGV4T2YoZm9yZWlnbk1vZGVsW3RoaXMudGFyZ2V0LmtleV0pICE9PSAtMTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIGFycmF5RGlmZlxuICAgICAgICAgICAgICogQHBhcmFtIGZpcnN0QXJyYXkge0FycmF5fVxuICAgICAgICAgICAgICogQHBhcmFtIHNlY29uZEFycmF5IHtBcnJheX1cbiAgICAgICAgICAgICAqIEByZXR1cm4geyp9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBhcnJheURpZmYgPSAoZmlyc3RBcnJheSwgc2Vjb25kQXJyYXkpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlyc3RBcnJheS5maWx0ZXIoKGluZGV4KSA9PiBzZWNvbmRBcnJheS5pbmRleE9mKGluZGV4KSA8IDApXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgZm9yZWlnbkNvbGxlY3Rpb24gPSBjYXR3YWxrLmNvbGxlY3Rpb24odGhpcy50YXJnZXQuY29sbGVjdGlvbiksXG4gICAgICAgICAgICAgICAgbW9kZWxzICAgICAgICAgICAgPSBsb2FkTW9kZWxzKCk7XG5cbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGlzIGEgZGlzY3JlcGFuY3kgYmV0d2VlbiB0aGUgY291bnRzLCB0aGVuIHdlIGtub3cgYWxsIHRoZSBtb2RlbHMgaGF2ZW4ndCBiZWVuIGxvYWRlZC5cbiAgICAgICAgICAgIGlmIChtb2RlbHMubGVuZ3RoICE9PSB0aGlzLnZhbHVlcy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgICAgIC8vIERpc2NvdmVyIHRoZSBrZXlzIHRoYXQgYXJlIGN1cnJlbnRseSBub3QgbG9hZGVkLlxuICAgICAgICAgICAgICAgIHZhciBsb2FkZWRLZXlzICAgPSBtb2RlbHMubWFwKG1vZGVsID0+IG1vZGVsW3RoaXMudGFyZ2V0LmtleV0pLFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZEtleXMgPSBhcnJheURpZmYodGhpcy52YWx1ZXMsIGxvYWRlZEtleXMpO1xuXG4gICAgICAgICAgICAgICAgcmVxdWlyZWRLZXlzLmZvckVhY2goKGZvcmVpZ25LZXkpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgcmVxdWlyZWRNb2RlbCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZE1vZGVsW3RoaXMudGFyZ2V0LmtleV0gPSBmb3JlaWduS2V5O1xuICAgICAgICAgICAgICAgICAgICBmb3JlaWduQ29sbGVjdGlvbi5yZWFkTW9kZWwocmVxdWlyZWRNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVhZCB0aGUgbW9kZWxzIGFnYWluIGltbWVkaWF0ZWx5LlxuICAgICAgICAgICAgICAgIG1vZGVscyA9IGxvYWRNb2RlbHMoKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWxzO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzZXRNb2RlbHNcbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHNldE1vZGVscyh2YWx1ZXMpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWVzID0gdmFsdWVzO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwSGFzT25lXG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwSGFzT25lIGV4dGVuZHMgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlZmluZVJlbGF0aW9uc2hpcFxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGxvY2FsS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXkpIHtcblxuICAgICAgICAgICAgcmV0dXJuIHN1cGVyLmRlZmluZVJlbGF0aW9uc2hpcChjb2xsZWN0aW9uTmFtZSwgbG9jYWxLZXksIHtcbiAgICAgICAgICAgICAgICBnZXQ6IHRoaXMuZ2V0TW9kZWwuYmluZCh0aGlzKSxcbiAgICAgICAgICAgICAgICBzZXQ6IHRoaXMuc2V0TW9kZWwuYmluZCh0aGlzKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGdldE1vZGVsXG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGdldE1vZGVsKCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgbG9hZE1vZGVsXG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHZhciBsb2FkTW9kZWwgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZvcmVpZ25Db2xsZWN0aW9uLm1vZGVscy5maW5kKChmb3JlaWduTW9kZWwpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMudmFsdWUgPT09IGZvcmVpZ25Nb2RlbFt0aGlzLnRhcmdldC5rZXldO1xuICAgICAgICAgICAgICAgIH0pOyAgXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgZm9yZWlnbkNvbGxlY3Rpb24gPSBjYXR3YWxrLmNvbGxlY3Rpb24odGhpcy50YXJnZXQuY29sbGVjdGlvbiksXG4gICAgICAgICAgICAgICAgbW9kZWwgICAgICAgICAgICAgPSBsb2FkTW9kZWwoKTtcblxuICAgICAgICAgICAgaWYgKCFtb2RlbCkge1xuXG4gICAgICAgICAgICAgICAgLy8gTW9kZWwgY2Fubm90IGJlIGZvdW5kIGFuZCB0aGVyZWZvcmUgd2UnbGwgYXR0ZW1wdCB0byByZWFkIHRoZSBtb2RlbCBpbnRvIHRoZSBjb2xsZWN0aW9uLlxuICAgICAgICAgICAgICAgIHZhciByZXF1aXJlZE1vZGVsICAgPSB7fTtcbiAgICAgICAgICAgICAgICByZXF1aXJlZE1vZGVsW3RoaXMudGFyZ2V0LmtleV0gPSB0aGlzLnZhbHVlO1xuICAgICAgICAgICAgICAgIGZvcmVpZ25Db2xsZWN0aW9uLnJlYWRNb2RlbChyZXF1aXJlZE1vZGVsKTtcblxuICAgICAgICAgICAgICAgIC8vIEF0dGVtcHQgdG8gcmVhZCB0aGUgbW9kZWwgYWdhaW4gaW1tZWRpYXRlbHkuXG4gICAgICAgICAgICAgICAgbW9kZWwgPSBsb2FkTW9kZWwoKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNldE1vZGVsXG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRNb2RlbCh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvLyBJbnN0YW50aWF0ZSB0aGUgQ2F0d2FsayBjbGFzcy5cbiAgICAkd2luZG93LmNhdHdhbGsgICAgICAgID0gbmV3IENhdHdhbGsoKTtcbiAgICAkd2luZG93LmNhdHdhbGsuU1RBVEVTID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUztcblxufSkod2luZG93KTsiLCJ2YXIgJF9fcGxhY2Vob2xkZXJfXzAgPSAkX19wbGFjZWhvbGRlcl9fMSIsIigkdHJhY2V1clJ1bnRpbWUuY3JlYXRlQ2xhc3MpKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIpIiwiJHRyYWNldXJSdW50aW1lLnNwcmVhZCgkX19wbGFjZWhvbGRlcl9fMCkiLCIkdHJhY2V1clJ1bnRpbWUuZGVmYXVsdFN1cGVyQ2FsbCh0aGlzLFxuICAgICAgICAgICAgICAgICRfX3BsYWNlaG9sZGVyX18wLnByb3RvdHlwZSwgYXJndW1lbnRzKSIsInZhciAkX19wbGFjZWhvbGRlcl9fMCA9ICRfX3BsYWNlaG9sZGVyX18xIiwiKCR0cmFjZXVyUnVudGltZS5jcmVhdGVDbGFzcykoJF9fcGxhY2Vob2xkZXJfXzAsICRfX3BsYWNlaG9sZGVyX18xLCAkX19wbGFjZWhvbGRlcl9fMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRfX3BsYWNlaG9sZGVyX18zKSIsIiR0cmFjZXVyUnVudGltZS5zdXBlckNhbGwoJF9fcGxhY2Vob2xkZXJfXzAsICRfX3BsYWNlaG9sZGVyX18xLCAkX19wbGFjZWhvbGRlcl9fMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJF9fcGxhY2Vob2xkZXJfXzMpIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9