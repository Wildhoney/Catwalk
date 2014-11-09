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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkNhdHdhbGsuanMiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMSIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci8yIiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzciLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvNCIsIkB0cmFjZXVyL2dlbmVyYXRlZC9UZW1wbGF0ZVBhcnNlci82IiwiQHRyYWNldXIvZ2VuZXJhdGVkL1RlbXBsYXRlUGFyc2VyLzUiLCJAdHJhY2V1ci9nZW5lcmF0ZWQvVGVtcGxhdGVQYXJzZXIvMyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQUFBLEFBQUMsU0FBUyxPQUFNO0FBRVosYUFBVyxDQUFDO0lBTU4sQ0FBQSxxQkFBb0IsRUFBSSxZQUFVO0lBTWxDLENBQUEseUJBQXdCLEVBQUk7QUFBRSxNQUFFLENBQUcsRUFBQTtBQUFHLFFBQUksQ0FBRyxFQUFBO0FBQUcsUUFBSSxDQUFHLEVBQUE7QUFBRyxVQUFNLENBQUcsRUFBQTtBQUFBLEVBQUU7QUNkL0UsQUFBSSxJQUFBLFVEbUJBLFNBQU0sUUFBTSxDQU1HLEFBQUMsQ0FBRTtBQUNWLE9BQUcsT0FBTyxFQUFZLEdBQUMsQ0FBQztBQUN4QixPQUFHLFlBQVksRUFBTyxHQUFDLENBQUM7QUFDeEIsT0FBRyxhQUFhLEVBQU0sSUFBSSxhQUFXLEFBQUMsRUFBQyxDQUFDO0FBQ3hDLE9BQUcsU0FBUyxFQUFVLElBQUksU0FBTyxBQUFDLEVBQUMsQ0FBQztBQUNwQyxPQUFHLGVBQWUsRUFBSSxLQUFHLENBQUM7RUM5QkUsQUQrQmhDLENDL0JnQztBQ0F4QyxFQUFDLGVBQWMsWUFBWSxDQUFDLEFBQUM7QUZxQ3JCLG1CQUFlLENBQWYsVUFBaUIsSUFBRyxDQUFHLENBQUEsVUFBUyxDQUFHO0FBRS9CLEFBQUksUUFBQSxDQUFBLFVBQVMsRUFBSSxJQUFJLFdBQVMsQUFBQyxDQUFDLElBQUcsQ0FBRyxX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QUFBQyxDQUFDLGFBQVksQ0FBQyxDQUFDO0FBRzFDLFlBQUksRUFBSSxDQUFBLFNBQVEsQUFBQyxFQUFDLENBQUM7TUFFdkI7QUFBQSxBQUVBLFdBQU8sTUFBSSxDQUFDO0lBRWhCO0FBTUEsV0FBTyxDQUFQLFVBQVMsS0FBSSxDQUFHO0FBQ1osU0FBRyxNQUFNLEVBQUksTUFBSSxDQUFDO0lBQ3RCO0FBQUEsT0ExRDZCLHFCQUFtQixDTS8rQkE7QU44aUNwRCxRQUFNLFFBQVEsRUFBVyxJQUFJLFFBQU0sQUFBQyxFQUFDLENBQUM7QUFDdEMsUUFBTSxRQUFRLE9BQU8sRUFBSSwwQkFBd0IsQ0FBQztBQUV0RCxDQUFDLEFBQUMsQ0FBQyxNQUFLLENBQUMsQ0FBQztBQUFBIiwiZmlsZSI6ImNhdHdhbGsuZXM1LmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCR3aW5kb3cpIHtcblxuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLyoqXG4gICAgICogQGNvbnN0YW50IENBVFdBTEtfTUVUQV9QUk9QRVJUWVxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgY29uc3QgQ0FUV0FMS19NRVRBX1BST1BFUlRZID0gJ19fY2F0d2Fsayc7XG5cbiAgICAvKipcbiAgICAgKiBAY29uc3RhbnQgQ0FUV0FMS19TVEFURV9QUk9QRVJUSUVTXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICBjb25zdCBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTID0geyBORVc6IDEsIERJUlRZOiAyLCBTQVZFRDogNCwgREVMRVRFRDogOCB9O1xuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIENhdHdhbGtcbiAgICAgKi9cbiAgICBjbGFzcyBDYXR3YWxrIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXG4gICAgICAgICAqIEByZXR1cm4ge0NhdHdhbGt9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzICAgICAgICAgPSB7fTtcbiAgICAgICAgICAgIHRoaXMuY29sbGVjdGlvbnMgICAgPSB7fTtcbiAgICAgICAgICAgIHRoaXMucmVsYXRpb25zaGlwICAgPSBuZXcgUmVsYXRpb25zaGlwKCk7XG4gICAgICAgICAgICB0aGlzLnR5cGVjYXN0ICAgICAgID0gbmV3IFR5cGVjYXN0KCk7XG4gICAgICAgICAgICB0aGlzLnJldmVydFR5cGVjYXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGNyZWF0ZUNvbGxlY3Rpb25cbiAgICAgICAgICogQHJldHVybiB7Q29sbGVjdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGNyZWF0ZUNvbGxlY3Rpb24obmFtZSwgcHJvcGVydGllcykge1xuXG4gICAgICAgICAgICB2YXIgY29sbGVjdGlvbiA9IG5ldyBDb2xsZWN0aW9uKG5hbWUsIHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgdGhpcy5jb2xsZWN0aW9uc1tuYW1lXSA9IGNvbGxlY3Rpb247XG4gICAgICAgICAgICByZXR1cm4gY29sbGVjdGlvbjtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY29sbGVjdGlvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29sbGVjdGlvbihuYW1lKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5jb2xsZWN0aW9uc1tuYW1lXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRocm93RXhjZXB0aW9uKGBVbmFibGUgdG8gZmluZCBjb2xsZWN0aW9uIFwiJHtuYW1lfVwiYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNvbGxlY3Rpb25zW25hbWVdO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZXZlcnRDYWxsYmFja1R5cGVjYXN0XG4gICAgICAgICAqIEBwYXJhbSBzZXR0aW5nIHtCb29sZWFufVxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgcmV2ZXJ0Q2FsbGJhY2tUeXBlY2FzdChzZXR0aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnJldmVydFR5cGVjYXN0ID0gISFzZXR0aW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgdGhyb3dFeGNlcHRpb25cbiAgICAgICAgICogQHRocm93cyBFeGNlcHRpb25cbiAgICAgICAgICogQHBhcmFtIG1lc3NhZ2Uge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIHRocm93RXhjZXB0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIHRocm93IGBDYXR3YWxrOiAke21lc3NhZ2V9LmA7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBvblxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gZXZlbnRGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBvbihuYW1lLCBldmVudEZuKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50c1tuYW1lXSA9IGV2ZW50Rm47XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBvZmZcbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7dm9pZH1cbiAgICAgICAgICovXG4gICAgICAgIG9mZihuYW1lKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudHNbbmFtZV07XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBDb2xsZWN0aW9uXG4gICAgICovXG4gICAgY2xhc3MgQ29sbGVjdGlvbiB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAgICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtDb2xsZWN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3RydWN0b3IobmFtZSwgcHJvcGVydGllcykge1xuICAgICAgICAgICAgdGhpcy5pZCAgICAgICAgPSAwO1xuICAgICAgICAgICAgdGhpcy5uYW1lICAgICAgPSBuYW1lO1xuICAgICAgICAgICAgdGhpcy5tb2RlbHMgICAgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuc2lsZW50ICAgID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmJsdWVwcmludCA9IG5ldyBCbHVlcHJpbnRNb2RlbChuYW1lLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNpbGVudGx5XG4gICAgICAgICAqIEBwYXJhbSBzaWxlbnRGbiB7RnVuY3Rpb259XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzaWxlbnRseShzaWxlbnRGbikge1xuICAgICAgICAgICAgdGhpcy5zaWxlbnQgPSB0cnVlO1xuICAgICAgICAgICAgc2lsZW50Rm4uYXBwbHkodGhpcyk7XG4gICAgICAgICAgICB0aGlzLnNpbGVudCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3JlYXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIFtwcm9wZXJ0aWVzPXt9XSB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBjcmVhdGVNb2RlbChwcm9wZXJ0aWVzID0ge30pIHtcblxuICAgICAgICAgICAgdGhpcy5pbmplY3RNZXRhKHByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIG1vZGVsIGNvbmZvcm1zIHRvIHRoZSBibHVlcHJpbnQuXG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLmJsdWVwcmludC5pdGVyYXRlQWxsKHByb3BlcnRpZXMpO1xuXG4gICAgICAgICAgICBPYmplY3Quc2VhbChtb2RlbCk7XG4gICAgICAgICAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuaXNzdWVQcm9taXNlKCdjcmVhdGUnLCBtb2RlbCwgbnVsbCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlYWRNb2RlbFxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZWFkTW9kZWwocHJvcGVydGllcykge1xuICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ3JlYWQnLCBwcm9wZXJ0aWVzLCBudWxsKTtcbiAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0aWVzO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgdXBkYXRlTW9kZWxcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHVwZGF0ZU1vZGVsKG1vZGVsLCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIGNvcHkgb2YgdGhlIG9sZCBtb2RlbCBmb3Igcm9sbGluZyBiYWNrLlxuICAgICAgICAgICAgdmFyIHByZXZpb3VzTW9kZWwgPSB7fTtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHByZXZpb3VzTW9kZWxbcHJvcGVydHldID0gbW9kZWxbcHJvcGVydHldKTtcblxuICAgICAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgICAgIC8vIENvcHkgYWNyb3NzIHRoZSBkYXRhIGZyb20gdGhlIHByb3BlcnRpZXMuIFdlIHdyYXAgdGhlIGFzc2lnbm1lbnQgaW4gYSB0cnktY2F0Y2ggYmxvY2tcbiAgICAgICAgICAgICAgICAvLyBiZWNhdXNlIGlmIHRoZSB1c2VyIGhhcyBhZGRlZCBhbnkgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIHRoYXQgZG9uJ3QgYmVsb25nIGluIHRoZSBtb2RlbCxcbiAgICAgICAgICAgICAgICAvLyBhbiBleGNlcHRpb24gd2lsbCBiZSByYWlzZWQgYmVjYXVzZSB0aGUgb2JqZWN0IGlzIHNlYWxlZC5cbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKHByb3BlcnR5ID0+IG1vZGVsW3Byb3BlcnR5XSA9IHByb3BlcnRpZXNbcHJvcGVydHldKTtcblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGUpIHt9XG5cblxuICAgICAgICAgICAgLy8gVHlwZWNhc3QgdGhlIHVwZGF0ZWQgbW9kZWwgYW5kIGNvcHkgYWNyb3NzIGl0cyBwcm9wZXJ0aWVzIHRvIHRoZSBjdXJyZW50IG1vZGVsLCBzbyBhcyB3ZVxuICAgICAgICAgICAgLy8gZG9uJ3QgYnJlYWsgYW55IHJlZmVyZW5jZXMuXG4gICAgICAgICAgICB2YXIgdHlwZWNhc3RNb2RlbCA9IHRoaXMuYmx1ZXByaW50LnJlaXRlcmF0ZVByb3BlcnRpZXMobW9kZWwpO1xuICAgICAgICAgICAgT2JqZWN0LmtleXModHlwZWNhc3RNb2RlbCkuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBBYnN0cmFjdCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gdHlwZWNhc3RNb2RlbFtwcm9wZXJ0eV1cblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuaXNzdWVQcm9taXNlKCd1cGRhdGUnLCBtb2RlbCwgcHJldmlvdXNNb2RlbCk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGRlbGV0ZU1vZGVsXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWxldGVNb2RlbChtb2RlbCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgcmVtb3ZlXG4gICAgICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICAgICAqIEBwYXJhbSBpbmRleCB7TnVtYmVyfVxuICAgICAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgcmVtb3ZlID0gKG1vZGVsLCBpbmRleCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5pc3N1ZVByb21pc2UoJ2RlbGV0ZScsIG51bGwsIG1vZGVsKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIERldGVybWluZXMgd2hldGhlciB0aGUgbW9kZWwgd2FzIHN1Y2Nlc3NmdWxseSBkZWxldGVkIHdpdGggZmluZGluZyB0aGUgbW9kZWwgYnkgcmVmZXJlbmNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEBwcm9wZXJ0eSBkaWREZWxldGVWaWFSZWZlcmVuY2VcbiAgICAgICAgICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgZGlkRGVsZXRlVmlhUmVmZXJlbmNlID0gZmFsc2U7XG5cbiAgICAgICAgICAgICgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZmluZCB0aGUgbW9kZWwgYnkgcmVmZXJlbmNlLlxuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMubW9kZWxzLmluZGV4T2YobW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBkaWREZWxldGVWaWFSZWZlcmVuY2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmUodGhpcy5tb2RlbHNbaW5kZXhdLCBpbmRleCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KSgpO1xuXG4gICAgICAgICAgICAoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKGRpZERlbGV0ZVZpYVJlZmVyZW5jZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gMDtcblxuICAgICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBtb2RlbCBieSBpdHMgaW50ZXJuYWwgQ2F0d2FsayBJRC5cbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVscy5mb3JFYWNoKChjdXJyZW50TW9kZWwpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQgPT09IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZShjdXJyZW50TW9kZWwsIGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGluZGV4Kys7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSkoKTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBhZGRBc3NvY2lhdGlvblxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByb3BlcnR5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0aWVzIHtBcnJheX1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgYWRkQXNzb2NpYXRpb24obW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0aWVzKSB7XG5cbiAgICAgICAgICAgIGlmICghKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc01hbnkpKSB7XG4gICAgICAgICAgICAgICAgY2F0d2Fsay50aHJvd0V4Y2VwdGlvbignVXNpbmcgYGFkZEFzc29jaWF0aW9uYCByZXF1aXJlcyBhIGhhc01hbnkgcmVsYXRpb25zaGlwJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjdXJyZW50UHJvcGVydGllcyA9IG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ucmVsYXRpb25zaGlwVmFsdWVzW3Byb3BlcnR5XSgpO1xuICAgICAgICAgICAgY3VycmVudFByb3BlcnRpZXMgICAgID0gY3VycmVudFByb3BlcnRpZXMuY29uY2F0KHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgdmFyIHVwZGF0ZURhdGEgICAgICAgID0ge307XG4gICAgICAgICAgICB1cGRhdGVEYXRhW3Byb3BlcnR5XSAgPSBjdXJyZW50UHJvcGVydGllcztcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVwZGF0ZU1vZGVsKG1vZGVsLCB1cGRhdGVEYXRhKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVtb3ZlQXNzb2NpYXRpb25cbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gcHJvcGVydGllcyB7QXJyYXl9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZUFzc29jaWF0aW9uKG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydGllcykge1xuXG4gICAgICAgICAgICBpZiAoISh0aGlzLmJsdWVwcmludC5tb2RlbFtwcm9wZXJ0eV0gaW5zdGFuY2VvZiBSZWxhdGlvbnNoaXBIYXNNYW55KSkge1xuICAgICAgICAgICAgICAgIGNhdHdhbGsudGhyb3dFeGNlcHRpb24oJ1VzaW5nIGByZW1vdmVBc3NvY2lhdGlvbmAgcmVxdWlyZXMgYSBoYXNNYW55IHJlbGF0aW9uc2hpcCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY3VycmVudFByb3BlcnRpZXMgPSBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnJlbGF0aW9uc2hpcFZhbHVlc1twcm9wZXJ0eV0oKTtcblxuICAgICAgICAgICAgcHJvcGVydGllcy5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRQcm9wZXJ0aWVzLmluZGV4T2YocHJvcGVydHkpO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRQcm9wZXJ0aWVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIHVwZGF0ZURhdGEgICAgICAgID0ge307XG4gICAgICAgICAgICB1cGRhdGVEYXRhW3Byb3BlcnR5XSAgPSBjdXJyZW50UHJvcGVydGllcztcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnVwZGF0ZU1vZGVsKG1vZGVsLCB1cGRhdGVEYXRhKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgaW5qZWN0TWV0YVxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaW5qZWN0TWV0YShtb2RlbCkge1xuXG4gICAgICAgICAgICBtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldID0ge1xuICAgICAgICAgICAgICAgIGlkOiArK3RoaXMuaWQsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLk5FVyxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFZhbHVlczoge30sXG4gICAgICAgICAgICAgICAgcmVsYXRpb25zaGlwVmFsdWVzOiB7fVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBpc3N1ZVByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBpc3N1ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc2lsZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhdHdhbGsuZXZlbnRzW2V2ZW50TmFtZV0gIT09ICdmdW5jdGlvbicpIHtcblxuICAgICAgICAgICAgICAgIC8vIENhbGxiYWNrIGhhcyBub3QgYWN0dWFsbHkgYmVlbiBzZXQtdXAgYW5kIHRoZXJlZm9yZSBtb2RlbHMgd2lsbCBuZXZlciBiZVxuICAgICAgICAgICAgICAgIC8vIHBlcnNpc3RlZC5cbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgdGhlIHByb21pc2UgZm9yIGJhY2stZW5kIHBlcnNpc3RlbmNlIG9mIHRoZSBtb2RlbC5cbiAgICAgICAgICAgICAgICBjYXR3YWxrLmV2ZW50c1tldmVudE5hbWVdLmNhbGwodGhpcywgdGhpcy5jbGVhbk1vZGVsKGN1cnJlbnRNb2RlbCB8fCBwcmV2aW91c01vZGVsKSwge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlOiByZXNvbHZlLCByZWplY3Q6IHJlamVjdFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9KS50aGVuKChyZXNvbHV0aW9uUGFyYW1zKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAvLyBQcm9taXNlIGhhcyBiZWVuIHJlc29sdmVkIVxuICAgICAgICAgICAgICAgIHRoaXMucmVzb2x2ZVByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpKHJlc29sdXRpb25QYXJhbXMpO1xuXG4gICAgICAgICAgICB9LCAocmVzb2x1dGlvblBhcmFtcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgLy8gUHJvbWlzZSBoYXMgYmVlbiByZWplY3RlZCFcbiAgICAgICAgICAgICAgICB0aGlzLnJlamVjdFByb21pc2UoZXZlbnROYW1lLCBjdXJyZW50TW9kZWwsIHByZXZpb3VzTW9kZWwpKHJlc29sdXRpb25QYXJhbXMpO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmVzb2x2ZVByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfSAtIEV2ZW50IG5hbWUgaXMgYWN0dWFsbHkgbm90IHJlcXVpcmVkLCBiZWNhdXNlIHdlIGNhbiBkZWR1Y2UgdGhlIHN1YnNlcXVlbnQgYWN0aW9uXG4gICAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tIHRoZSBzdGF0ZSBvZiB0aGUgYGN1cnJlbnRNb2RlbGAgYW5kIGBwcmV2aW91c01vZGVsYCwgYnV0IHdlIGFkZCBpdCB0byBhZGRcbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXJpZmljYXRpb24gdG8gb3VyIGxvZ2ljYWwgc3RlcHMuXG4gICAgICAgICAqIEBwYXJhbSBjdXJyZW50TW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHBhcmFtIHByZXZpb3VzTW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICByZXNvbHZlUHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkge1xuXG4gICAgICAgICAgICBpZiAoY3VycmVudE1vZGVsICYmIGV2ZW50TmFtZSA9PT0gJ2NyZWF0ZScpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1vZGVsIGhhcyBiZWVuIHN1Y2Nlc3NmdWxseSBwZXJzaXN0ZWQhXG4gICAgICAgICAgICAgICAgY3VycmVudE1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5TQVZFRDtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXaGVuIHdlJ3JlIGluIHRoZSBwcm9jZXNzIG9mIGRlbGV0aW5nIGEgbW9kZWwsIHRoZSBgY3VycmVudE1vZGVsYCBpcyB1bnNldDsgaW5zdGVhZCB0aGVcbiAgICAgICAgICAgIC8vIGBwcmV2aW91c01vZGVsYCB3aWxsIGJlIGRlZmluZWQuXG4gICAgICAgICAgICBpZiAoKGN1cnJlbnRNb2RlbCA9PT0gbnVsbCAmJiBwcmV2aW91c01vZGVsKSAmJiBldmVudE5hbWUgPT09ICdkZWxldGUnKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBNb2RlbCBoYXMgYmVlbiBzdWNjZXNzZnVsbHkgZGVsZXRlZCFcbiAgICAgICAgICAgICAgICBwcmV2aW91c01vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0uc3RhdHVzID0gQ0FUV0FMS19TVEFURVNfUFJPUEVSVElFUy5ERUxFVEVEO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiAocHJvcGVydGllcykgPT4ge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMgJiYgZXZlbnROYW1lICE9PSAncmVhZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzICYmICFwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KENBVFdBTEtfTUVUQV9QUk9QRVJUWSkgJiYgZXZlbnROYW1lID09PSAncmVhZCcpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5jcmVhdGVNb2RlbChwcm9wZXJ0aWVzKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBtb2RlbCB0byByZWZsZWN0IHRoZSBjaGFuZ2VzIG9uIHRoZSBvYmplY3QgdGhhdCBgcmVhZE1vZGVsYCByZXR1cm4uXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgbW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5RW1pdEV2ZW50KCk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHJlamVjdFByb21pc2VcbiAgICAgICAgICogQHBhcmFtIGV2ZW50TmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY3VycmVudE1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEBwYXJhbSBwcmV2aW91c01vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgcmVqZWN0UHJvbWlzZShldmVudE5hbWUsIGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCkge1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZXRob2QgcmVqZWN0V2l0aFxuICAgICAgICAgICAgICogQHBhcmFtIGR1cGxpY2F0ZU1vZGVsIHtPYmplY3R9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgcmVqZWN0V2l0aCA9IChkdXBsaWNhdGVNb2RlbCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgaWYgKGR1cGxpY2F0ZU1vZGVsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChldmVudE5hbWUgPT09ICd1cGRhdGUnICYmIGR1cGxpY2F0ZU1vZGVsLmhhc093blByb3BlcnR5KENBVFdBTEtfTUVUQV9QUk9QRVJUWSkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVzZXIgcGFzc2VkIGluIGEgbW9kZWwgYW5kIHRoZXJlZm9yZSB0aGUgcHJldmlvdXMgc2hvdWxkIGJlIGRlbGV0ZWQsIGJ1dCBvbmx5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2hlbiB3ZSdyZSB1cGRhdGluZyFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlbGV0ZU1vZGVsKHByZXZpb3VzTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpb3VzTW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLkRFTEVURUQ7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXNlIHRoZSBkdXBsaWNhdGUgbW9kZWwgYXMgdGhlIHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlTW9kZWwoY3VycmVudE1vZGVsLCBkdXBsaWNhdGVNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5zdGF0dXMgPSBDQVRXQUxLX1NUQVRFU19QUk9QRVJUSUVTLlNBVkVEO1xuXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5jb25kaXRpb25hbGx5RW1pdEV2ZW50KCk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChwcmV2aW91c01vZGVsID09PSBudWxsICYmIGV2ZW50TmFtZSA9PT0gJ2NyZWF0ZScpIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuc2lsZW50bHkoKCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFByZXZpb3VzIG1vZGVsIHdhcyBhY3R1YWxseSBOVUxMIGFuZCB0aGVyZWZvcmUgd2UnbGwgZGVsZXRlIGl0LlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRlbGV0ZU1vZGVsKGN1cnJlbnRNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRNb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldLnN0YXR1cyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVMuREVMRVRFRDtcblxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdFdpdGg7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGN1cnJlbnRNb2RlbCA9PT0gbnVsbCAmJiBldmVudE5hbWUgPT09ICdkZWxldGUnICkge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRGV2ZWxvcGVyIGRvZXNuJ3QgYWN0dWFsbHkgd2FudCB0byBkZWxldGUgdGhlIG1vZGVsLCBhbmQgdGhlcmVmb3JlIHdlIG5lZWQgdG8gcmV2ZXJ0IGl0IHRvXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBtb2RlbCBpdCB3YXMsIGFuZCBzZXQgaXRzIGZsYWcgYmFjayB0byB3aGF0IGl0IHdhcy5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy51cGRhdGVNb2RlbCh7fSwgcHJldmlvdXNNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKChjdXJyZW50TW9kZWwgJiYgcHJldmlvdXNNb2RlbCkgJiYgZXZlbnROYW1lID09PSAndXBkYXRlJykge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zaWxlbnRseSgoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQm90aCBvZiB0aGUgY3VycmVudCBhbmQgcHJldmlvdXMgbW9kZWxzIGFyZSB1cGRhdGVkLCBhbmQgdGhlcmVmb3JlIHdlJ2xsIHNpbXBseVxuICAgICAgICAgICAgICAgICAgICAvLyByZXZlcnQgdGhlIGN1cnJlbnQgbW9kZWwgdG8gdGhlIHByZXZpb3VzIG1vZGVsLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1vZGVsKGN1cnJlbnRNb2RlbCwgcHJldmlvdXNNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0V2l0aDtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY29uZGl0aW9uYWxseUVtaXRFdmVudFxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgY29uZGl0aW9uYWxseUVtaXRFdmVudCgpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjYXR3YWxrLmV2ZW50cy5yZWZyZXNoID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBXZSdyZSBhbGwgZG9uZSFcbiAgICAgICAgICAgICAgICBjYXR3YWxrLmV2ZW50cy5yZWZyZXNoKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY2xlYW5Nb2RlbFxuICAgICAgICAgKiBAcGFyYW0gbW9kZWwge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgY2xlYW5Nb2RlbChtb2RlbCkge1xuXG4gICAgICAgICAgICB2YXIgY2xlYW5lZE1vZGVsID0ge307XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKHByb3BlcnR5ID0+IHtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gQ0FUV0FMS19NRVRBX1BST1BFUlRZKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ2F0d2FsayBtZXRhIGRhdGEgc2hvdWxkIG5ldmVyIGJlIHBlcnNpc3RlZCB0byB0aGUgYmFjay1lbmQuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpZiB0aGUgcHJvcGVydHkgaXMgYWN0dWFsbHkgYSByZWxhdGlvbnNoaXAsIHdoaWNoIHdlIG5lZWQgdG8gcmVzb2x2ZSB0b1xuICAgICAgICAgICAgICAgIC8vIGl0cyBwcmltaXRpdmUgdmFsdWUocykuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEFic3RyYWN0KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlbGF0aW9uc2hpcEZ1bmN0aW9uID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGlvbnNoaXBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYW5lZE1vZGVsW3Byb3BlcnR5XSA9IHJlbGF0aW9uc2hpcEZ1bmN0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuYmx1ZXByaW50Lm1vZGVsW3Byb3BlcnR5XSA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtb2RlbFtDQVRXQUxLX01FVEFfUFJPUEVSVFldICYmIG1vZGVsW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0ub3JpZ2luYWxWYWx1ZXNbcHJvcGVydHldKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIGhhdmUgZGlzY292ZXJlZCBhIHR5cGVjYXN0ZWQgcHJvcGVydHkgdGhhdCBuZWVkcyB0byBiZSByZXZlcnRlZCB0byBpdHMgb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhbHVlIGJlZm9yZSBpbnZva2luZyB0aGUgY2FsbGJhY2suXG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhbmVkTW9kZWxbcHJvcGVydHldID0gbW9kZWxbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5vcmlnaW5hbFZhbHVlc1twcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY2xlYW5lZE1vZGVsW3Byb3BlcnR5XSA9IG1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBjbGVhbmVkTW9kZWw7XG5cbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIEJsdWVwcmludE1vZGVsXG4gICAgICovXG4gICAgY2xhc3MgQmx1ZXByaW50TW9kZWwge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIG5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGJsdWVwcmludCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtCbHVlcHJpbnRNb2RlbH1cbiAgICAgICAgICovXG4gICAgICAgIGNvbnN0cnVjdG9yKG5hbWUsIGJsdWVwcmludCkge1xuICAgICAgICAgICAgdGhpcy5uYW1lICA9IG5hbWU7XG4gICAgICAgICAgICB0aGlzLm1vZGVsID0gT2JqZWN0LmZyZWV6ZShibHVlcHJpbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnZlbmllbmNlIG1ldGhvZCB0aGF0IHdyYXBzIGBpdGVyYXRlUHJvcGVydGllc2AgYW5kIGBpdGVyYXRlQmx1ZXByaW50YCBpbnRvIGEgb25lLWxpbmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIGl0ZXJhdGVBbGxcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZUFsbChwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB0aGlzLml0ZXJhdGVQcm9wZXJ0aWVzKHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXRlcmF0ZUJsdWVwcmludChtb2RlbCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIGl0ZXJhdGluZyBvdmVyIHRoZSBwYXNzZWQgaW4gbW9kZWwgcHJvcGVydGllcyB0byBlbnN1cmUgdGhleSdyZSBpbiB0aGUgYmx1ZXByaW50LFxuICAgICAgICAgKiBhbmQgdHlwZWNhc3RpbmcgdGhlIHByb3BlcnRpZXMgYmFzZWQgb24gdGhlIGRlZmluZSBibHVlcHJpbnQgZm9yIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBtZXRob2QgaXRlcmF0ZVByb3BlcnRpZXNcbiAgICAgICAgICogQHBhcmFtIHByb3BlcnRpZXMge09iamVjdH1cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgaXRlcmF0ZVByb3BlcnRpZXMocHJvcGVydGllcykge1xuXG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB7fTtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXMocHJvcGVydGllcykuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG5cbiAgICAgICAgICAgICAgICB2YXIgdmFsdWUgICAgICAgICAgID0gcHJvcGVydGllc1twcm9wZXJ0eV0sXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5ICE9PSBDQVRXQUxLX01FVEFfUFJPUEVSVFkgJiYgdHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ3VuZGVmaW5lZCcpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBQcm9wZXJ0eSBkb2Vzbid0IGJlbG9uZyBpbiB0aGUgbW9kZWwgYmVjYXVzZSBpdCdzIG5vdCBpbiB0aGUgYmx1ZXByaW50LlxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLnJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1vZGVsLCBwcm9wZXJ0eSwgcHJvcGVydHlIYW5kbGVyLmRlZmluZVJlbGF0aW9uc2hpcCh0aGlzLm5hbWUsIHByb3BlcnR5KSk7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlci5zZXRWYWx1ZXMocHJvcGVydGllc1twcm9wZXJ0eV0pO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzW0NBVFdBTEtfTUVUQV9QUk9QRVJUWV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RvcmUgdGhlIG9yaWdpbmFsIHZhbHVlIG9mIHRoZSByZWxhdGlvbnNoaXAgdG8gcmVzb2x2ZSB3aGVuIGNsZWFuaW5nIHRoZSBtb2RlbC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5yZWxhdGlvbnNoaXBWYWx1ZXNbcHJvcGVydHldID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcm9wZXJ0eUhhbmRsZXIudmFsdWVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5SGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFR5cGVjYXN0IHByb3BlcnR5IHRvIHRoZSBkZWZpbmVkIHR5cGUuXG4gICAgICAgICAgICAgICAgICAgIHZhciBvcmlnaW5hbFZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydHlIYW5kbGVyKHZhbHVlKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2F0d2Fsay5yZXZlcnRUeXBlY2FzdCAmJiBvcmlnaW5hbFZhbHVlICE9PSB2YWx1ZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTdG9yZSB0aGUgb3JpZ2luYWwgdmFsdWUgc28gdGhhdCB3ZSBjYW4gcmV2ZXJ0IGl0IGZvciB3aGVuIGludm9raW5nIHRoZSBjYWxsYmFja1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gd2l0aCB0aGUgYGNsZWFuTW9kZWxgIG1ldGhvZC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNbQ0FUV0FMS19NRVRBX1BST1BFUlRZXS5vcmlnaW5hbFZhbHVlc1twcm9wZXJ0eV0gPSBvcmlnaW5hbFZhbHVlO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1vZGVsW3Byb3BlcnR5XSA9IHZhbHVlO1xuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIGl0ZXJhdGluZyBvdmVyIHRoZSBibHVlcHJpbnQgdG8gZGV0ZXJtaW5lIGlmIGFueSBwcm9wZXJ0aWVzIGFyZSBtaXNzaW5nXG4gICAgICAgICAqIGZyb20gdGhlIGN1cnJlbnQgbW9kZWwsIHRoYXQgaGF2ZSBiZWVuIGRlZmluZWQgaW4gdGhlIGJsdWVwcmludCBhbmQgdGhlcmVmb3JlIHNob3VsZCBiZVxuICAgICAgICAgKiBwcmVzZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAbWV0aG9kIGl0ZXJhdGVCbHVlcHJpbnRcbiAgICAgICAgICogQHBhcmFtIG1vZGVsIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIGl0ZXJhdGVCbHVlcHJpbnQobW9kZWwpIHtcblxuICAgICAgICAgICAgT2JqZWN0LmtleXModGhpcy5tb2RlbCkuZm9yRWFjaChwcm9wZXJ0eSA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1vZGVsW3Byb3BlcnR5XSA9PT0gJ3VuZGVmaW5lZCcpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBFbnN1cmUgdGhhdCBpdCBpcyBkZWZpbmVkLlxuICAgICAgICAgICAgICAgICAgICBtb2RlbFtwcm9wZXJ0eV0gICAgID0gdGhpcy5tb2RlbFtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgICAgIHZhciBwcm9wZXJ0eUhhbmRsZXIgPSB0aGlzLm1vZGVsW3Byb3BlcnR5XTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwQWJzdHJhY3QpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlIYW5kbGVyID0gdGhpcy5yZWxhdGlvbnNoaXBIYW5kbGVyKHByb3BlcnR5SGFuZGxlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobW9kZWwsIHByb3BlcnR5LCBwcm9wZXJ0eUhhbmRsZXIuZGVmaW5lUmVsYXRpb25zaGlwKHRoaXMubmFtZSwgcHJvcGVydHkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlci5zZXRWYWx1ZXMoW10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMubW9kZWxbcHJvcGVydHldID09PSAnZnVuY3Rpb24nKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpZiB0aGUgcHJvcGVydHkgaGFzIGEgcHJvcGVydHkgaGFuZGxlciBtZXRob2Qgd2hpY2ggd291bGQgYmUgcmVzcG9uc2libGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZvciB0eXBlY2FzdGluZywgYW5kIGRldGVybWluaW5nIHRoZSBkZWZhdWx0IHZhbHVlLlxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gcHJvcGVydHlIYW5kbGVyKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVzcG9uc2libGUgZm9yIHJlaXRlcmF0aW5nIG92ZXIgdGhlIG1vZGVsIHRvIG9uY2UgYWdhaW4gdHlwZWNhc3QgdGhlIHZhbHVlczsgd2hpY2ggaXNcbiAgICAgICAgICogZXNwZWNpYWxseSB1c2VmdWwgZm9yIHdoZW4gdGhlIG1vZGVsIGhhcyBiZWVuIHVwZGF0ZWQsIGJ1dCByZWxhdGlvbnNoaXBzIG5lZWQgdG8gYmUgbGVmdFxuICAgICAgICAgKiBhbG9uZS4gU2luY2UgdGhlIG1vZGVsIGlzIHNlYWxlZCB3ZSBjYW4gYWxzbyBndWFyYW50ZWUgdGhhdCBubyBvdGhlciBwcm9wZXJ0aWVzIGhhdmUgYmVlblxuICAgICAgICAgKiBhZGRlZCBpbnRvIHRoZSBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQG1ldGhvZCByZWl0ZXJhdGVQcm9wZXJ0aWVzXG4gICAgICAgICAqIEBwYXJhbSBtb2RlbCB7T2JqZWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICByZWl0ZXJhdGVQcm9wZXJ0aWVzKG1vZGVsKSB7XG5cbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGVsKS5mb3JFYWNoKChwcm9wZXJ0eSkgPT4ge1xuXG4gICAgICAgICAgICAgICAgdmFyIHByb3BlcnR5SGFuZGxlciA9IHRoaXMubW9kZWxbcHJvcGVydHldO1xuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwcm9wZXJ0eUhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgbW9kZWxbcHJvcGVydHldID0gcHJvcGVydHlIYW5kbGVyKG1vZGVsW3Byb3BlcnR5XSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCByZWxhdGlvbnNoaXBIYW5kbGVyXG4gICAgICAgICAqIEBwYXJhbSBwcm9wZXJ0eUhhbmRsZXIge1JlbGF0aW9uc2hpcEFic3RyYWN0fVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBBYnN0cmFjdH1cbiAgICAgICAgICovXG4gICAgICAgIHJlbGF0aW9uc2hpcEhhbmRsZXIocHJvcGVydHlIYW5kbGVyKSB7XG5cbiAgICAgICAgICAgIHZhciBpbnN0YW50aWF0ZVByb3BlcnRpZXMgPSBbcHJvcGVydHlIYW5kbGVyLnRhcmdldC5rZXksIHByb3BlcnR5SGFuZGxlci50YXJnZXQuY29sbGVjdGlvbl07XG5cbiAgICAgICAgICAgIC8vIEluc3RhbnRpYXRlIGEgbmV3IHJlbGF0aW9uc2hpcCBwZXIgbW9kZWwuXG4gICAgICAgICAgICBpZiAocHJvcGVydHlIYW5kbGVyIGluc3RhbmNlb2YgUmVsYXRpb25zaGlwSGFzTWFueSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IG5ldyBSZWxhdGlvbnNoaXBIYXNNYW55KC4uLmluc3RhbnRpYXRlUHJvcGVydGllcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5SGFuZGxlciBpbnN0YW5jZW9mIFJlbGF0aW9uc2hpcEhhc09uZSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5SGFuZGxlciA9IG5ldyBSZWxhdGlvbnNoaXBIYXNPbmUoLi4uaW5zdGFudGlhdGVQcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHByb3BlcnR5SGFuZGxlcjtcblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgVHlwZWNhc3RcbiAgICAgKi9cbiAgICBjbGFzcyBUeXBlY2FzdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgcmV0dXJuVmFsdWVcbiAgICAgICAgICogQHBhcmFtIHR5cGVjYXN0Q29uc3RydWN0b3Ige0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcGFyYW0gdmFsdWUgeyp9XG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUgeyp9XG4gICAgICAgICAqIEByZXR1cm4geyp9XG4gICAgICAgICAqL1xuICAgICAgICByZXR1cm5WYWx1ZSh0eXBlY2FzdENvbnN0cnVjdG9yLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHlwZWNhc3RDb25zdHJ1Y3Rvcih0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnID8gdmFsdWUgOiBkZWZhdWx0VmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc3RyaW5nXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBzdHJpbmcoZGVmYXVsdFZhbHVlID0gJycpIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKFN0cmluZywgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBib29sZWFuXG4gICAgICAgICAqIEBwYXJhbSBkZWZhdWx0VmFsdWUge0Jvb2xlYW59XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgYm9vbGVhbihkZWZhdWx0VmFsdWUgPSB0cnVlKSB7XG5cbiAgICAgICAgICAgIHJldHVybiAodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXR1cm5WYWx1ZShCb29sZWFuLCB2YWx1ZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIG51bWJlclxuICAgICAgICAgKiBAcGFyYW0gZGVmYXVsdFZhbHVlIHtOdW1iZXJ9XG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgbnVtYmVyKGRlZmF1bHRWYWx1ZSA9IDApIHtcblxuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJldHVyblZhbHVlKE51bWJlciwgdmFsdWUsIGRlZmF1bHRWYWx1ZSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogbWV0aG9kIGF1dG9JbmNyZW1lbnRcbiAgICAgICAgICogQHBhcmFtIGluaXRpYWxWYWx1ZSB7TnVtYmVyfVxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGF1dG9JbmNyZW1lbnQoaW5pdGlhbFZhbHVlID0gMSkge1xuXG4gICAgICAgICAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBOdW1iZXIoaW5pdGlhbFZhbHVlKyspO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgY3VzdG9tXG4gICAgICAgICAqIEBwYXJhbSB0eXBlY2FzdEZuIHtGdW5jdGlvbn1cbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBjdXN0b20odHlwZWNhc3RGbikge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVjYXN0Rm47XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBjbGFzcyBSZWxhdGlvbnNoaXBcbiAgICAgKi9cbiAgICBjbGFzcyBSZWxhdGlvbnNoaXAge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIGhhc09uZVxuICAgICAgICAgKiBAcGFyYW0gZm9yZWlnbktleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7UmVsYXRpb25zaGlwSGFzT25lfVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzT25lKGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFJlbGF0aW9uc2hpcEhhc09uZShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBoYXNNYW55XG4gICAgICAgICAqIEBwYXJhbSBmb3JlaWduS2V5IHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtSZWxhdGlvbnNoaXBIYXNNYW55fVxuICAgICAgICAgKi9cbiAgICAgICAgaGFzTWFueShmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZWxhdGlvbnNoaXBIYXNNYW55KGZvcmVpZ25LZXksIGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEFic3RyYWN0XG4gICAgICovXG4gICAgY2xhc3MgUmVsYXRpb25zaGlwQWJzdHJhY3Qge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgICAgICogQHBhcmFtIGZvcmVpZ25LZXkge1N0cmluZ31cbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBjb25zdHJ1Y3Rvcihmb3JlaWduS2V5LCBjb2xsZWN0aW9uTmFtZSkge1xuXG4gICAgICAgICAgICB0aGlzLnRhcmdldCA9IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBrZXk6IGZvcmVpZ25LZXlcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWV0aG9kIHNldFZhbHVlc1xuICAgICAgICAgKiBAcGFyYW0gdmFsdWVzIHtPYmplY3R9XG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRWYWx1ZXModmFsdWVzKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcyA9IHRoaXMudmFsdWUgPSB2YWx1ZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gYWNjZXNzb3JGdW5jdGlvbnMge0Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCBhY2Nlc3NvckZ1bmN0aW9ucykge1xuXG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICAgICAgICBrZXk6IGxvY2FsS2V5XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGdldDogYWNjZXNzb3JGdW5jdGlvbnMuZ2V0LFxuICAgICAgICAgICAgICAgIHNldDogYWNjZXNzb3JGdW5jdGlvbnMuc2V0LFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAY2xhc3MgUmVsYXRpb25zaGlwSGFzTWFueVxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcEhhc01hbnkgZXh0ZW5kcyBSZWxhdGlvbnNoaXBBYnN0cmFjdCB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2QgZGVmaW5lUmVsYXRpb25zaGlwXG4gICAgICAgICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgICAgICAgKiBAcGFyYW0gbG9jYWxLZXkge1N0cmluZ31cbiAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSkge1xuXG4gICAgICAgICAgICByZXR1cm4gc3VwZXIuZGVmaW5lUmVsYXRpb25zaGlwKGNvbGxlY3Rpb25OYW1lLCBsb2NhbEtleSwge1xuICAgICAgICAgICAgICAgIGdldDogdGhpcy5nZXRNb2RlbHMuYmluZCh0aGlzKSxcbiAgICAgICAgICAgICAgICBzZXQ6IHRoaXMuc2V0TW9kZWxzLmJpbmQodGhpcylcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBnZXRNb2RlbHNcbiAgICAgICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICAgICAqL1xuICAgICAgICBnZXRNb2RlbHMoKSB7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBsb2FkTW9kZWxzXG4gICAgICAgICAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdmFyIGxvYWRNb2RlbHMgPSAoKSA9PiB7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZm9yZWlnbkNvbGxlY3Rpb24ubW9kZWxzLmZpbHRlcigoZm9yZWlnbk1vZGVsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlcy5pbmRleE9mKGZvcmVpZ25Nb2RlbFt0aGlzLnRhcmdldC5rZXldKSAhPT0gLTE7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1ldGhvZCBhcnJheURpZmZcbiAgICAgICAgICAgICAqIEBwYXJhbSBmaXJzdEFycmF5IHtBcnJheX1cbiAgICAgICAgICAgICAqIEBwYXJhbSBzZWNvbmRBcnJheSB7QXJyYXl9XG4gICAgICAgICAgICAgKiBAcmV0dXJuIHsqfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgYXJyYXlEaWZmID0gKGZpcnN0QXJyYXksIHNlY29uZEFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpcnN0QXJyYXkuZmlsdGVyKChpbmRleCkgPT4gc2Vjb25kQXJyYXkuaW5kZXhPZihpbmRleCkgPCAwKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIGZvcmVpZ25Db2xsZWN0aW9uID0gY2F0d2Fsay5jb2xsZWN0aW9uKHRoaXMudGFyZ2V0LmNvbGxlY3Rpb24pLFxuICAgICAgICAgICAgICAgIG1vZGVscyAgICAgICAgICAgID0gbG9hZE1vZGVscygpO1xuXG4gICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBhIGRpc2NyZXBhbmN5IGJldHdlZW4gdGhlIGNvdW50cywgdGhlbiB3ZSBrbm93IGFsbCB0aGUgbW9kZWxzIGhhdmVuJ3QgYmVlbiBsb2FkZWQuXG4gICAgICAgICAgICBpZiAobW9kZWxzLmxlbmd0aCAhPT0gdGhpcy52YWx1ZXMubGVuZ3RoKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBEaXNjb3ZlciB0aGUga2V5cyB0aGF0IGFyZSBjdXJyZW50bHkgbm90IGxvYWRlZC5cbiAgICAgICAgICAgICAgICB2YXIgbG9hZGVkS2V5cyAgID0gbW9kZWxzLm1hcChtb2RlbCA9PiBtb2RlbFt0aGlzLnRhcmdldC5rZXldKSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRLZXlzID0gYXJyYXlEaWZmKHRoaXMudmFsdWVzLCBsb2FkZWRLZXlzKTtcblxuICAgICAgICAgICAgICAgIHJlcXVpcmVkS2V5cy5mb3JFYWNoKChmb3JlaWduS2V5KSA9PiB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJlcXVpcmVkTW9kZWwgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRNb2RlbFt0aGlzLnRhcmdldC5rZXldID0gZm9yZWlnbktleTtcbiAgICAgICAgICAgICAgICAgICAgZm9yZWlnbkNvbGxlY3Rpb24ucmVhZE1vZGVsKHJlcXVpcmVkTW9kZWwpO1xuXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBBdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVscyBhZ2FpbiBpbW1lZGlhdGVseS5cbiAgICAgICAgICAgICAgICBtb2RlbHMgPSBsb2FkTW9kZWxzKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVscztcblxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBtZXRob2Qgc2V0TW9kZWxzXG4gICAgICAgICAqIEByZXR1cm4ge3ZvaWR9XG4gICAgICAgICAqL1xuICAgICAgICBzZXRNb2RlbHModmFsdWVzKSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlcyA9IHZhbHVlcztcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGNsYXNzIFJlbGF0aW9uc2hpcEhhc09uZVxuICAgICAqL1xuICAgIGNsYXNzIFJlbGF0aW9uc2hpcEhhc09uZSBleHRlbmRzIFJlbGF0aW9uc2hpcEFic3RyYWN0IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBkZWZpbmVSZWxhdGlvbnNoaXBcbiAgICAgICAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAgICAgICAqIEBwYXJhbSBsb2NhbEtleSB7U3RyaW5nfVxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBkZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5KSB7XG5cbiAgICAgICAgICAgIHJldHVybiBzdXBlci5kZWZpbmVSZWxhdGlvbnNoaXAoY29sbGVjdGlvbk5hbWUsIGxvY2FsS2V5LCB7XG4gICAgICAgICAgICAgICAgZ2V0OiB0aGlzLmdldE1vZGVsLmJpbmQodGhpcyksXG4gICAgICAgICAgICAgICAgc2V0OiB0aGlzLnNldE1vZGVsLmJpbmQodGhpcylcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBnZXRNb2RlbFxuICAgICAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBnZXRNb2RlbCgpIHtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWV0aG9kIGxvYWRNb2RlbFxuICAgICAgICAgICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB2YXIgbG9hZE1vZGVsID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBmb3JlaWduQ29sbGVjdGlvbi5tb2RlbHMuZmluZCgoZm9yZWlnbk1vZGVsKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlID09PSBmb3JlaWduTW9kZWxbdGhpcy50YXJnZXQua2V5XTtcbiAgICAgICAgICAgICAgICB9KTsgIFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIGZvcmVpZ25Db2xsZWN0aW9uID0gY2F0d2Fsay5jb2xsZWN0aW9uKHRoaXMudGFyZ2V0LmNvbGxlY3Rpb24pLFxuICAgICAgICAgICAgICAgIG1vZGVsICAgICAgICAgICAgID0gbG9hZE1vZGVsKCk7XG5cbiAgICAgICAgICAgIGlmICghbW9kZWwpIHtcblxuICAgICAgICAgICAgICAgIC8vIE1vZGVsIGNhbm5vdCBiZSBmb3VuZCBhbmQgdGhlcmVmb3JlIHdlJ2xsIGF0dGVtcHQgdG8gcmVhZCB0aGUgbW9kZWwgaW50byB0aGUgY29sbGVjdGlvbi5cbiAgICAgICAgICAgICAgICB2YXIgcmVxdWlyZWRNb2RlbCAgID0ge307XG4gICAgICAgICAgICAgICAgcmVxdWlyZWRNb2RlbFt0aGlzLnRhcmdldC5rZXldID0gdGhpcy52YWx1ZTtcbiAgICAgICAgICAgICAgICBmb3JlaWduQ29sbGVjdGlvbi5yZWFkTW9kZWwocmVxdWlyZWRNb2RlbCk7XG5cbiAgICAgICAgICAgICAgICAvLyBBdHRlbXB0IHRvIHJlYWQgdGhlIG1vZGVsIGFnYWluIGltbWVkaWF0ZWx5LlxuICAgICAgICAgICAgICAgIG1vZGVsID0gbG9hZE1vZGVsKCk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1vZGVsO1xuXG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG1ldGhvZCBzZXRNb2RlbFxuICAgICAgICAgKiBAcmV0dXJuIHt2b2lkfVxuICAgICAgICAgKi9cbiAgICAgICAgc2V0TW9kZWwodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgLy8gSW5zdGFudGlhdGUgdGhlIENhdHdhbGsgY2xhc3MuXG4gICAgJHdpbmRvdy5jYXR3YWxrICAgICAgICA9IG5ldyBDYXR3YWxrKCk7XG4gICAgJHdpbmRvdy5jYXR3YWxrLlNUQVRFUyA9IENBVFdBTEtfU1RBVEVTX1BST1BFUlRJRVM7XG5cbn0pKHdpbmRvdyk7IiwidmFyICRfX3BsYWNlaG9sZGVyX18wID0gJF9fcGxhY2Vob2xkZXJfXzEiLCIoJHRyYWNldXJSdW50aW1lLmNyZWF0ZUNsYXNzKSgkX19wbGFjZWhvbGRlcl9fMCwgJF9fcGxhY2Vob2xkZXJfXzEsICRfX3BsYWNlaG9sZGVyX18yKSIsIiR0cmFjZXVyUnVudGltZS5zcHJlYWQoJF9fcGxhY2Vob2xkZXJfXzApIiwiJHRyYWNldXJSdW50aW1lLmRlZmF1bHRTdXBlckNhbGwodGhpcyxcbiAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMC5wcm90b3R5cGUsIGFyZ3VtZW50cykiLCJ2YXIgJF9fcGxhY2Vob2xkZXJfXzAgPSAkX19wbGFjZWhvbGRlcl9fMSIsIigkdHJhY2V1clJ1bnRpbWUuY3JlYXRlQ2xhc3MpKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkX19wbGFjZWhvbGRlcl9fMykiLCIkdHJhY2V1clJ1bnRpbWUuc3VwZXJDYWxsKCRfX3BsYWNlaG9sZGVyX18wLCAkX19wbGFjZWhvbGRlcl9fMSwgJF9fcGxhY2Vob2xkZXJfXzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRfX3BsYWNlaG9sZGVyX18zKSJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==