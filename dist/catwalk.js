module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	    value: true
	});

	var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

	exports.createStore = createStore;
	exports.attachSchema = attachSchema;
	exports.actionsFor = actionsFor;

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

	function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

	function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

	var _redux = __webpack_require__(2);

	var redux = _interopRequireWildcard(_redux);

	var _reduxThunk = __webpack_require__(12);

	var _reduxThunk2 = _interopRequireDefault(_reduxThunk);

	var _seamlessImmutable = __webpack_require__(13);

	var _seamlessImmutable2 = _interopRequireDefault(_seamlessImmutable);

	var _helpersException = __webpack_require__(14);

	var _helpersRegistry = __webpack_require__(15);

	var _helpersMiddleware = __webpack_require__(16);

	var _helpersSundries = __webpack_require__(17);

	var _helpersRelationships = __webpack_require__(18);

	/**
	 * @property
	 * @type {Symbol}
	 */
	var SCHEMA = Symbol('schema');

	exports.SCHEMA = SCHEMA;
	/**
	 * @method createStore
	 * @param {Function} reducer
	 * @param {Array} [middleware = []]
	 * @return {Object}
	 */

	function createStore(reducer) {
	    var middleware = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

	    var createStoreWithMiddleware = redux.applyMiddleware.apply(redux, [].concat(_toConsumableArray(middleware), [_helpersMiddleware.typecaster, _reduxThunk2['default']]))(redux.createStore);

	    return extend(createStoreWithMiddleware(reducer));
	}

	/**
	 * @method extend
	 * @param {Object} store
	 * @return {Object}
	 */
	function extend(store) {

	    /**
	     * @method getState
	     * @return {Object}
	     */
	    function getState() {

	        var state = store.getState();

	        return Object.keys(state).reduce(function (accumulator, key) {

	            accumulator[key] = state[key].map(function (model) {
	                return (0, _seamlessImmutable2['default'])(_extends({}, model, (0, _helpersRelationships.applyRelationships)()));
	            });

	            return accumulator;
	        }, {});
	    }

	    return _extends({}, store, { getState: getState });
	}

	/**
	 * @method attachSchema
	 * @param {Function} reducer
	 * @param {Object} schema
	 * @return {Function}
	 */

	function attachSchema(reducer, schema) {
	    reducer[SCHEMA] = schema;
	    return reducer;
	}

	/**
	 * @method actionsFor
	 * @param {Function} reducer
	 * @return {Object}
	 */

	function actionsFor(reducer) {

	    if (!(0, _helpersSundries.isFunction)(reducer) || !(0, _helpersSundries.hasSchema)(reducer)) {
	        (0, _helpersException.throwException)('actionsFor reference must be a reducer function');
	    }

	    if (!_helpersRegistry.actionTypes.has(reducer)) {

	        var CREATE = Symbol('create');
	        var READ = Symbol('read');
	        var UPDATE = Symbol('update');
	        var DELETE = Symbol('delete');

	        _helpersRegistry.reducerActions.set(CREATE, reducer).set(READ, reducer).set(UPDATE, reducer).set(DELETE, reducer);
	        _helpersRegistry.actionTypes.set(reducer, { CREATE: CREATE, READ: READ, UPDATE: UPDATE, DELETE: DELETE });
	    }

	    return _helpersRegistry.actionTypes.get(reducer);
	}

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	exports.__esModule = true;

	function _interopRequireDefault(obj) {
	  return obj && obj.__esModule ? obj : { 'default': obj };
	}

	var _createStore = __webpack_require__(3);

	var _createStore2 = _interopRequireDefault(_createStore);

	var _utilsCombineReducers = __webpack_require__(5);

	var _utilsCombineReducers2 = _interopRequireDefault(_utilsCombineReducers);

	var _utilsBindActionCreators = __webpack_require__(9);

	var _utilsBindActionCreators2 = _interopRequireDefault(_utilsBindActionCreators);

	var _utilsApplyMiddleware = __webpack_require__(10);

	var _utilsApplyMiddleware2 = _interopRequireDefault(_utilsApplyMiddleware);

	var _utilsCompose = __webpack_require__(11);

	var _utilsCompose2 = _interopRequireDefault(_utilsCompose);

	exports.createStore = _createStore2['default'];
	exports.combineReducers = _utilsCombineReducers2['default'];
	exports.bindActionCreators = _utilsBindActionCreators2['default'];
	exports.applyMiddleware = _utilsApplyMiddleware2['default'];
	exports.compose = _utilsCompose2['default'];

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	exports.__esModule = true;
	exports['default'] = createStore;

	function _interopRequireDefault(obj) {
	  return obj && obj.__esModule ? obj : { 'default': obj };
	}

	var _utilsIsPlainObject = __webpack_require__(4);

	var _utilsIsPlainObject2 = _interopRequireDefault(_utilsIsPlainObject);

	/**
	 * These are private action types reserved by Redux.
	 * For any unknown actions, you must return the current state.
	 * If the current state is undefined, you must return the initial state.
	 * Do not reference these action types directly in your code.
	 */
	var ActionTypes = {
	  INIT: '@@redux/INIT'
	};

	exports.ActionTypes = ActionTypes;
	/**
	 * Creates a Redux store that holds the state tree.
	 * The only way to change the data in the store is to call `dispatch()` on it.
	 *
	 * There should only be a single store in your app. To specify how different
	 * parts of the state tree respond to actions, you may combine several reducers
	 * into a single reducer function by using `combineReducers`.
	 *
	 * @param {Function} reducer A function that returns the next state tree, given
	 * the current state tree and the action to handle.
	 *
	 * @param {any} [initialState] The initial state. You may optionally specify it
	 * to hydrate the state from the server in universal apps, or to restore a
	 * previously serialized user session.
	 * If you use `combineReducers` to produce the root reducer function, this must be
	 * an object with the same shape as `combineReducers` keys.
	 *
	 * @returns {Store} A Redux store that lets you read the state, dispatch actions
	 * and subscribe to changes.
	 */

	function createStore(reducer, initialState) {
	  if (typeof reducer !== 'function') {
	    throw new Error('Expected the reducer to be a function.');
	  }

	  var currentReducer = reducer;
	  var currentState = initialState;
	  var listeners = [];
	  var isDispatching = false;

	  /**
	   * Reads the state tree managed by the store.
	   *
	   * @returns {any} The current state tree of your application.
	   */
	  function getState() {
	    return currentState;
	  }

	  /**
	   * Adds a change listener. It will be called any time an action is dispatched,
	   * and some part of the state tree may potentially have changed. You may then
	   * call `getState()` to read the current state tree inside the callback.
	   *
	   * @param {Function} listener A callback to be invoked on every dispatch.
	   * @returns {Function} A function to remove this change listener.
	   */
	  function subscribe(listener) {
	    listeners.push(listener);
	    var isSubscribed = true;

	    return function unsubscribe() {
	      if (!isSubscribed) {
	        return;
	      }

	      isSubscribed = false;
	      var index = listeners.indexOf(listener);
	      listeners.splice(index, 1);
	    };
	  }

	  /**
	   * Dispatches an action. It is the only way to trigger a state change.
	   *
	   * The `reducer` function, used to create the store, will be called with the
	   * current state tree and the given `action`. Its return value will
	   * be considered the **next** state of the tree, and the change listeners
	   * will be notified.
	   *
	   * The base implementation only supports plain object actions. If you want to
	   * dispatch a Promise, an Observable, a thunk, or something else, you need to
	   * wrap your store creating function into the corresponding middleware. For
	   * example, see the documentation for the `redux-thunk` package. Even the
	   * middleware will eventually dispatch plain object actions using this method.
	   *
	   * @param {Object} action A plain object representing “what changed”. It is
	   * a good idea to keep actions serializable so you can record and replay user
	   * sessions, or use the time travelling `redux-devtools`. An action must have
	   * a `type` property which may not be `undefined`. It is a good idea to use
	   * string constants for action types.
	   *
	   * @returns {Object} For convenience, the same action object you dispatched.
	   *
	   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
	   * return something else (for example, a Promise you can await).
	   */
	  function dispatch(action) {
	    if (!_utilsIsPlainObject2['default'](action)) {
	      throw new Error('Actions must be plain objects. ' + 'Use custom middleware for async actions.');
	    }

	    if (typeof action.type === 'undefined') {
	      throw new Error('Actions may not have an undefined "type" property. ' + 'Have you misspelled a constant?');
	    }

	    if (isDispatching) {
	      throw new Error('Reducers may not dispatch actions.');
	    }

	    try {
	      isDispatching = true;
	      currentState = currentReducer(currentState, action);
	    } finally {
	      isDispatching = false;
	    }

	    listeners.slice().forEach(function (listener) {
	      return listener();
	    });
	    return action;
	  }

	  /**
	   * Replaces the reducer currently used by the store to calculate the state.
	   *
	   * You might need this if your app implements code splitting and you want to
	   * load some of the reducers dynamically. You might also need this if you
	   * implement a hot reloading mechanism for Redux.
	   *
	   * @param {Function} nextReducer The reducer for the store to use instead.
	   * @returns {void}
	   */
	  function replaceReducer(nextReducer) {
	    currentReducer = nextReducer;
	    dispatch({ type: ActionTypes.INIT });
	  }

	  // When a store is created, an "INIT" action is dispatched so that every
	  // reducer returns their initial state. This effectively populates
	  // the initial state tree.
	  dispatch({ type: ActionTypes.INIT });

	  return {
	    dispatch: dispatch,
	    subscribe: subscribe,
	    getState: getState,
	    replaceReducer: replaceReducer
	  };
	}

/***/ },
/* 4 */
/***/ function(module, exports) {

	'use strict';

	exports.__esModule = true;
	exports['default'] = isPlainObject;
	var fnToString = function fnToString(fn) {
	  return Function.prototype.toString.call(fn);
	};

	/**
	 * @param {any} obj The object to inspect.
	 * @returns {boolean} True if the argument appears to be a plain object.
	 */

	function isPlainObject(obj) {
	  if (!obj || typeof obj !== 'object') {
	    return false;
	  }

	  var proto = typeof obj.constructor === 'function' ? Object.getPrototypeOf(obj) : Object.prototype;

	  if (proto === null) {
	    return true;
	  }

	  var constructor = proto.constructor;

	  return typeof constructor === 'function' && constructor instanceof constructor && fnToString(constructor) === fnToString(Object);
	}

	module.exports = exports['default'];

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {'use strict';

	exports.__esModule = true;
	exports['default'] = combineReducers;

	function _interopRequireDefault(obj) {
	  return obj && obj.__esModule ? obj : { 'default': obj };
	}

	var _createStore = __webpack_require__(3);

	var _utilsIsPlainObject = __webpack_require__(4);

	var _utilsIsPlainObject2 = _interopRequireDefault(_utilsIsPlainObject);

	var _utilsMapValues = __webpack_require__(7);

	var _utilsMapValues2 = _interopRequireDefault(_utilsMapValues);

	var _utilsPick = __webpack_require__(8);

	var _utilsPick2 = _interopRequireDefault(_utilsPick);

	/* eslint-disable no-console */

	function getUndefinedStateErrorMessage(key, action) {
	  var actionType = action && action.type;
	  var actionName = actionType && '"' + actionType.toString() + '"' || 'an action';

	  return 'Reducer "' + key + '" returned undefined handling ' + actionName + '. ' + 'To ignore an action, you must explicitly return the previous state.';
	}

	function getUnexpectedStateKeyWarningMessage(inputState, outputState, action) {
	  var reducerKeys = Object.keys(outputState);
	  var argumentName = action && action.type === _createStore.ActionTypes.INIT ? 'initialState argument passed to createStore' : 'previous state received by the reducer';

	  if (reducerKeys.length === 0) {
	    return 'Store does not have a valid reducer. Make sure the argument passed ' + 'to combineReducers is an object whose values are reducers.';
	  }

	  if (!_utilsIsPlainObject2['default'](inputState)) {
	    return 'The ' + argumentName + ' has unexpected type of "' + ({}).toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] + '". Expected argument to be an object with the following ' + ('keys: "' + reducerKeys.join('", "') + '"');
	  }

	  var unexpectedKeys = Object.keys(inputState).filter(function (key) {
	    return reducerKeys.indexOf(key) < 0;
	  });

	  if (unexpectedKeys.length > 0) {
	    return 'Unexpected ' + (unexpectedKeys.length > 1 ? 'keys' : 'key') + ' ' + ('"' + unexpectedKeys.join('", "') + '" found in ' + argumentName + '. ') + 'Expected to find one of the known reducer keys instead: ' + ('"' + reducerKeys.join('", "') + '". Unexpected keys will be ignored.');
	  }
	}

	function assertReducerSanity(reducers) {
	  Object.keys(reducers).forEach(function (key) {
	    var reducer = reducers[key];
	    var initialState = reducer(undefined, { type: _createStore.ActionTypes.INIT });

	    if (typeof initialState === 'undefined') {
	      throw new Error('Reducer "' + key + '" returned undefined during initialization. ' + 'If the state passed to the reducer is undefined, you must ' + 'explicitly return the initial state. The initial state may ' + 'not be undefined.');
	    }

	    var type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.');
	    if (typeof reducer(undefined, { type: type }) === 'undefined') {
	      throw new Error('Reducer "' + key + '" returned undefined when probed with a random type. ' + ('Don\'t try to handle ' + _createStore.ActionTypes.INIT + ' or other actions in "redux/*" ') + 'namespace. They are considered private. Instead, you must return the ' + 'current state for any unknown actions, unless it is undefined, ' + 'in which case you must return the initial state, regardless of the ' + 'action type. The initial state may not be undefined.');
	    }
	  });
	}

	/**
	 * Turns an object whose values are different reducer functions, into a single
	 * reducer function. It will call every child reducer, and gather their results
	 * into a single state object, whose keys correspond to the keys of the passed
	 * reducer functions.
	 *
	 * @param {Object} reducers An object whose values correspond to different
	 * reducer functions that need to be combined into one. One handy way to obtain
	 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
	 * undefined for any action. Instead, they should return their initial state
	 * if the state passed to them was undefined, and the current state for any
	 * unrecognized action.
	 *
	 * @returns {Function} A reducer function that invokes every reducer inside the
	 * passed object, and builds a state object with the same shape.
	 */

	function combineReducers(reducers) {
	  var finalReducers = _utilsPick2['default'](reducers, function (val) {
	    return typeof val === 'function';
	  });
	  var sanityError;

	  try {
	    assertReducerSanity(finalReducers);
	  } catch (e) {
	    sanityError = e;
	  }

	  var defaultState = _utilsMapValues2['default'](finalReducers, function () {
	    return undefined;
	  });

	  return function combination(state, action) {
	    if (state === undefined) state = defaultState;

	    if (sanityError) {
	      throw sanityError;
	    }

	    var hasChanged = false;
	    var finalState = _utilsMapValues2['default'](finalReducers, function (reducer, key) {
	      var previousStateForKey = state[key];
	      var nextStateForKey = reducer(previousStateForKey, action);
	      if (typeof nextStateForKey === 'undefined') {
	        var errorMessage = getUndefinedStateErrorMessage(key, action);
	        throw new Error(errorMessage);
	      }
	      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
	      return nextStateForKey;
	    });

	    if (process.env.NODE_ENV !== 'production') {
	      var warningMessage = getUnexpectedStateKeyWarningMessage(state, finalState, action);
	      if (warningMessage) {
	        console.error(warningMessage);
	      }
	    }

	    return hasChanged ? finalState : state;
	  };
	}

	module.exports = exports['default'];
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(6)))

/***/ },
/* 6 */
/***/ function(module, exports) {

	// shim for using process in browser

	'use strict';

	var process = module.exports = {};
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;

	function cleanUpNextTick() {
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}

	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = setTimeout(cleanUpNextTick);
	    draining = true;

	    var len = queue.length;
	    while (len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    clearTimeout(timeout);
	}

	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        setTimeout(drainQueue, 0);
	    }
	};

	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};

	function noop() {}

	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;

	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};

	process.cwd = function () {
	    return '/';
	};
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function () {
	    return 0;
	};

/***/ },
/* 7 */
/***/ function(module, exports) {

	/**
	 * Applies a function to every key-value pair inside an object.
	 *
	 * @param {Object} obj The source object.
	 * @param {Function} fn The mapper function that receives the value and the key.
	 * @returns {Object} A new object that contains the mapped values for the keys.
	 */
	"use strict";

	exports.__esModule = true;
	exports["default"] = mapValues;

	function mapValues(obj, fn) {
	  return Object.keys(obj).reduce(function (result, key) {
	    result[key] = fn(obj[key], key);
	    return result;
	  }, {});
	}

	module.exports = exports["default"];

/***/ },
/* 8 */
/***/ function(module, exports) {

	/**
	 * Picks key-value pairs from an object where values satisfy a predicate.
	 *
	 * @param {Object} obj The object to pick from.
	 * @param {Function} fn The predicate the values must satisfy to be copied.
	 * @returns {Object} The object with the values that satisfied the predicate.
	 */
	"use strict";

	exports.__esModule = true;
	exports["default"] = pick;

	function pick(obj, fn) {
	  return Object.keys(obj).reduce(function (result, key) {
	    if (fn(obj[key])) {
	      result[key] = obj[key];
	    }
	    return result;
	  }, {});
	}

	module.exports = exports["default"];

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	exports.__esModule = true;
	exports['default'] = bindActionCreators;

	function _interopRequireDefault(obj) {
	  return obj && obj.__esModule ? obj : { 'default': obj };
	}

	var _utilsMapValues = __webpack_require__(7);

	var _utilsMapValues2 = _interopRequireDefault(_utilsMapValues);

	function bindActionCreator(actionCreator, dispatch) {
	  return function () {
	    return dispatch(actionCreator.apply(undefined, arguments));
	  };
	}

	/**
	 * Turns an object whose values are action creators, into an object with the
	 * same keys, but with every function wrapped into a `dispatch` call so they
	 * may be invoked directly. This is just a convenience method, as you can call
	 * `store.dispatch(MyActionCreators.doSomething())` yourself just fine.
	 *
	 * For convenience, you can also pass a single function as the first argument,
	 * and get a function in return.
	 *
	 * @param {Function|Object} actionCreators An object whose values are action
	 * creator functions. One handy way to obtain it is to use ES6 `import * as`
	 * syntax. You may also pass a single function.
	 *
	 * @param {Function} dispatch The `dispatch` function available on your Redux
	 * store.
	 *
	 * @returns {Function|Object} The object mimicking the original object, but with
	 * every action creator wrapped into the `dispatch` call. If you passed a
	 * function as `actionCreators`, the return value will also be a single
	 * function.
	 */

	function bindActionCreators(actionCreators, dispatch) {
	  if (typeof actionCreators === 'function') {
	    return bindActionCreator(actionCreators, dispatch);
	  }

	  if (typeof actionCreators !== 'object' || actionCreators === null || actionCreators === undefined) {
	    // eslint-disable-line no-eq-null
	    throw new Error('bindActionCreators expected an object or a function, instead received ' + (actionCreators === null ? 'null' : typeof actionCreators) + '. ' + 'Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?');
	  }

	  return _utilsMapValues2['default'](actionCreators, function (actionCreator) {
	    return bindActionCreator(actionCreator, dispatch);
	  });
	}

	module.exports = exports['default'];

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	exports.__esModule = true;

	var _extends = Object.assign || function (target) {
	  for (var i = 1; i < arguments.length; i++) {
	    var source = arguments[i];for (var key in source) {
	      if (Object.prototype.hasOwnProperty.call(source, key)) {
	        target[key] = source[key];
	      }
	    }
	  }return target;
	};

	exports['default'] = applyMiddleware;

	function _interopRequireDefault(obj) {
	  return obj && obj.__esModule ? obj : { 'default': obj };
	}

	var _compose = __webpack_require__(11);

	var _compose2 = _interopRequireDefault(_compose);

	/**
	 * Creates a store enhancer that applies middleware to the dispatch method
	 * of the Redux store. This is handy for a variety of tasks, such as expressing
	 * asynchronous actions in a concise manner, or logging every action payload.
	 *
	 * See `redux-thunk` package as an example of the Redux middleware.
	 *
	 * Because middleware is potentially asynchronous, this should be the first
	 * store enhancer in the composition chain.
	 *
	 * Note that each middleware will be given the `dispatch` and `getState` functions
	 * as named arguments.
	 *
	 * @param {...Function} middlewares The middleware chain to be applied.
	 * @returns {Function} A store enhancer applying the middleware.
	 */

	function applyMiddleware() {
	  for (var _len = arguments.length, middlewares = Array(_len), _key = 0; _key < _len; _key++) {
	    middlewares[_key] = arguments[_key];
	  }

	  return function (next) {
	    return function (reducer, initialState) {
	      var store = next(reducer, initialState);
	      var _dispatch = store.dispatch;
	      var chain = [];

	      var middlewareAPI = {
	        getState: store.getState,
	        dispatch: function dispatch(action) {
	          return _dispatch(action);
	        }
	      };
	      chain = middlewares.map(function (middleware) {
	        return middleware(middlewareAPI);
	      });
	      _dispatch = _compose2['default'].apply(undefined, chain)(store.dispatch);

	      return _extends({}, store, {
	        dispatch: _dispatch
	      });
	    };
	  };
	}

	module.exports = exports['default'];

/***/ },
/* 11 */
/***/ function(module, exports) {

	/**
	 * Composes single-argument functions from right to left.
	 *
	 * @param {...Function} funcs The functions to compose.
	 * @returns {Function} A function obtained by composing functions from right to
	 * left. For example, compose(f, g, h) is identical to arg => f(g(h(arg))).
	 */
	"use strict";

	exports.__esModule = true;
	exports["default"] = compose;

	function compose() {
	  for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
	    funcs[_key] = arguments[_key];
	  }

	  return function (arg) {
	    return funcs.reduceRight(function (composed, f) {
	      return f(composed);
	    }, arg);
	  };
	}

	module.exports = exports["default"];

/***/ },
/* 12 */
/***/ function(module, exports) {

	'use strict';

	exports.__esModule = true;
	exports['default'] = thunkMiddleware;

	function thunkMiddleware(_ref) {
	  var dispatch = _ref.dispatch;
	  var getState = _ref.getState;

	  return function (next) {
	    return function (action) {
	      return typeof action === 'function' ? action(dispatch, getState) : next(action);
	    };
	  };
	}

	module.exports = exports['default'];

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {"use strict";

	(function () {
	  "use strict";

	  function addPropertyTo(target, methodName, value) {
	    Object.defineProperty(target, methodName, {
	      enumerable: false,
	      configurable: false,
	      writable: false,
	      value: value
	    });
	  }

	  function banProperty(target, methodName) {
	    addPropertyTo(target, methodName, function () {
	      throw new ImmutableError("The " + methodName + " method cannot be invoked on an Immutable data structure.");
	    });
	  }

	  var immutabilityTag = "__immutable_invariants_hold";

	  function addImmutabilityTag(target) {
	    addPropertyTo(target, immutabilityTag, true);
	  }

	  function isImmutable(target) {
	    if (typeof target === "object") {
	      return target === null || target.hasOwnProperty(immutabilityTag);
	    } else {
	      // In JavaScript, only objects are even potentially mutable.
	      // strings, numbers, null, and undefined are all naturally immutable.
	      return true;
	    }
	  }

	  function isMergableObject(target) {
	    return target !== null && typeof target === "object" && !(target instanceof Array) && !(target instanceof Date);
	  }

	  var mutatingObjectMethods = ["setPrototypeOf"];

	  var nonMutatingObjectMethods = ["keys"];

	  var mutatingArrayMethods = mutatingObjectMethods.concat(["push", "pop", "sort", "splice", "shift", "unshift", "reverse"]);

	  var nonMutatingArrayMethods = nonMutatingObjectMethods.concat(["map", "filter", "slice", "concat", "reduce", "reduceRight"]);

	  function ImmutableError(message) {
	    var err = new Error(message);
	    err.__proto__ = ImmutableError;

	    return err;
	  }
	  ImmutableError.prototype = Error.prototype;

	  function makeImmutable(obj, bannedMethods) {
	    // Tag it so we can quickly tell it's immutable later.
	    addImmutabilityTag(obj);

	    if (process.env.NODE_ENV !== "production") {
	      // Make all mutating methods throw exceptions.
	      for (var index in bannedMethods) {
	        if (bannedMethods.hasOwnProperty(index)) {
	          banProperty(obj, bannedMethods[index]);
	        }
	      }

	      // Freeze it and return it.
	      Object.freeze(obj);
	    }

	    return obj;
	  }

	  function makeMethodReturnImmutable(obj, methodName) {
	    var currentMethod = obj[methodName];

	    addPropertyTo(obj, methodName, function () {
	      return Immutable(currentMethod.apply(obj, arguments));
	    });
	  }

	  function makeImmutableArray(array) {
	    // Don't change their implementations, but wrap these functions to make sure
	    // they always return an immutable value.
	    for (var index in nonMutatingArrayMethods) {
	      if (nonMutatingArrayMethods.hasOwnProperty(index)) {
	        var methodName = nonMutatingArrayMethods[index];
	        makeMethodReturnImmutable(array, methodName);
	      }
	    }

	    addPropertyTo(array, "flatMap", flatMap);
	    addPropertyTo(array, "asObject", asObject);
	    addPropertyTo(array, "asMutable", asMutableArray);

	    for (var i = 0, length = array.length; i < length; i++) {
	      array[i] = Immutable(array[i]);
	    }

	    return makeImmutable(array, mutatingArrayMethods);
	  }

	  /**
	   * Effectively performs a map() over the elements in the array, using the
	   * provided iterator, except that whenever the iterator returns an array, that
	   * array's elements are added to the final result instead of the array itself.
	   *
	   * @param {function} iterator - The iterator function that will be invoked on each element in the array. It will receive three arguments: the current value, the current index, and the current object.
	   */
	  function flatMap(iterator) {
	    // Calling .flatMap() with no arguments is a no-op. Don't bother cloning.
	    if (arguments.length === 0) {
	      return this;
	    }

	    var result = [],
	        length = this.length,
	        index;

	    for (index = 0; index < length; index++) {
	      var iteratorResult = iterator(this[index], index, this);

	      if (iteratorResult instanceof Array) {
	        // Concatenate Array results into the return value we're building up.
	        result.push.apply(result, iteratorResult);
	      } else {
	        // Handle non-Array results the same way map() does.
	        result.push(iteratorResult);
	      }
	    }

	    return makeImmutableArray(result);
	  }

	  /**
	   * Returns an Immutable copy of the object without the given keys included.
	   *
	   * @param {array} keysToRemove - A list of strings representing the keys to exclude in the return value. Instead of providing a single array, this method can also be called by passing multiple strings as separate arguments.
	   */
	  function without(keysToRemove) {
	    // Calling .without() with no arguments is a no-op. Don't bother cloning.
	    if (arguments.length === 0) {
	      return this;
	    }

	    // If we weren't given an array, use the arguments list.
	    if (!(keysToRemove instanceof Array)) {
	      keysToRemove = Array.prototype.slice.call(arguments);
	    }

	    var result = this.instantiateEmptyObject();

	    for (var key in this) {
	      if (this.hasOwnProperty(key) && keysToRemove.indexOf(key) === -1) {
	        result[key] = this[key];
	      }
	    }

	    return makeImmutableObject(result, { instantiateEmptyObject: this.instantiateEmptyObject });
	  }

	  function asMutableArray(opts) {
	    var result = [],
	        i,
	        length;

	    if (opts && opts.deep) {
	      for (i = 0, length = this.length; i < length; i++) {
	        result.push(asDeepMutable(this[i]));
	      }
	    } else {
	      for (i = 0, length = this.length; i < length; i++) {
	        result.push(this[i]);
	      }
	    }

	    return result;
	  }

	  /**
	   * Effectively performs a [map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) over the elements in the array, expecting that the iterator function
	   * will return an array of two elements - the first representing a key, the other
	   * a value. Then returns an Immutable Object constructed of those keys and values.
	   *
	   * @param {function} iterator - A function which should return an array of two elements - the first representing the desired key, the other the desired value.
	   */
	  function asObject(iterator) {
	    // If no iterator was provided, assume the identity function
	    // (suggesting this array is already a list of key/value pairs.)
	    if (typeof iterator !== "function") {
	      iterator = function (value) {
	        return value;
	      };
	    }

	    var result = {},
	        length = this.length,
	        index;

	    for (index = 0; index < length; index++) {
	      var pair = iterator(this[index], index, this),
	          key = pair[0],
	          value = pair[1];

	      result[key] = value;
	    }

	    return makeImmutableObject(result);
	  }

	  function asDeepMutable(obj) {
	    if (!obj || !obj.hasOwnProperty(immutabilityTag) || obj instanceof Date) {
	      return obj;
	    }
	    return obj.asMutable({ deep: true });
	  }

	  function quickCopy(src, dest) {
	    for (var key in src) {
	      if (src.hasOwnProperty(key)) {
	        dest[key] = src[key];
	      }
	    }

	    return dest;
	  }

	  /**
	   * Returns an Immutable Object containing the properties and values of both
	   * this object and the provided object, prioritizing the provided object's
	   * values whenever the same key is present in both objects.
	   *
	   * @param {object} other - The other object to merge. Multiple objects can be passed as an array. In such a case, the later an object appears in that list, the higher its priority.
	   * @param {object} config - Optional config object that contains settings. Supported settings are: {deep: true} for deep merge and {merger: mergerFunc} where mergerFunc is a function
	   *                          that takes a property from both objects. If anything is returned it overrides the normal merge behaviour.
	   */
	  function merge(other, config) {
	    // Calling .merge() with no arguments is a no-op. Don't bother cloning.
	    if (arguments.length === 0) {
	      return this;
	    }

	    if (other === null || typeof other !== "object") {
	      throw new TypeError("Immutable#merge can only be invoked with objects or arrays, not " + JSON.stringify(other));
	    }

	    var receivedArray = other instanceof Array,
	        deep = config && config.deep,
	        merger = config && config.merger,
	        result;

	    // Use the given key to extract a value from the given object, then place
	    // that value in the result object under the same key. If that resulted
	    // in a change from this object's value at that key, set anyChanges = true.
	    function addToResult(currentObj, otherObj, key) {
	      var immutableValue = Immutable(otherObj[key]);
	      var mergerResult = merger && merger(currentObj[key], immutableValue, config);
	      var currentValue = currentObj[key];

	      if (result !== undefined || mergerResult !== undefined || !currentObj.hasOwnProperty(key) || immutableValue !== currentValue &&
	      // Avoid false positives due to (NaN !== NaN) evaluating to true
	      immutableValue === immutableValue) {

	        var newValue;

	        if (mergerResult) {
	          newValue = mergerResult;
	        } else if (deep && isMergableObject(currentValue) && isMergableObject(immutableValue)) {
	          newValue = currentValue.merge(immutableValue, config);
	        } else {
	          newValue = immutableValue;
	        }

	        // We check (newValue === newValue) because (NaN !== NaN) in JS
	        if (currentValue !== newValue && newValue === newValue || !currentObj.hasOwnProperty(key)) {
	          if (result === undefined) {
	            // Make a shallow clone of the current object.
	            result = quickCopy(currentObj, currentObj.instantiateEmptyObject());
	          }

	          result[key] = newValue;
	        }
	      }
	    }

	    var key;

	    // Achieve prioritization by overriding previous values that get in the way.
	    if (!receivedArray) {
	      // The most common use case: just merge one object into the existing one.
	      for (key in other) {
	        if (other.hasOwnProperty(key)) {
	          addToResult(this, other, key);
	        }
	      }
	    } else {
	      // We also accept an Array
	      for (var index = 0; index < other.length; index++) {
	        var otherFromArray = other[index];

	        for (key in otherFromArray) {
	          if (otherFromArray.hasOwnProperty(key)) {
	            addToResult(this, otherFromArray, key);
	          }
	        }
	      }
	    }

	    if (result === undefined) {
	      return this;
	    } else {
	      return makeImmutableObject(result, { instantiateEmptyObject: this.instantiateEmptyObject });
	    }
	  }

	  function asMutableObject(opts) {
	    var result = this.instantiateEmptyObject(),
	        key;

	    if (opts && opts.deep) {
	      for (key in this) {
	        if (this.hasOwnProperty(key)) {
	          result[key] = asDeepMutable(this[key]);
	        }
	      }
	    } else {
	      for (key in this) {
	        if (this.hasOwnProperty(key)) {
	          result[key] = this[key];
	        }
	      }
	    }

	    return result;
	  }

	  // Creates plain object to be used for cloning
	  function instantiatePlainObject() {
	    return {};
	  }

	  // Finalizes an object with immutable methods, freezes it, and returns it.
	  function makeImmutableObject(obj, options) {
	    var instantiateEmptyObject = options && options.instantiateEmptyObject ? options.instantiateEmptyObject : instantiatePlainObject;

	    addPropertyTo(obj, "merge", merge);
	    addPropertyTo(obj, "without", without);
	    addPropertyTo(obj, "asMutable", asMutableObject);
	    addPropertyTo(obj, "instantiateEmptyObject", instantiateEmptyObject);

	    return makeImmutable(obj, mutatingObjectMethods);
	  }

	  function Immutable(obj, options) {
	    if (isImmutable(obj)) {
	      return obj;
	    } else if (obj instanceof Array) {
	      return makeImmutableArray(obj.slice());
	    } else if (obj instanceof Date) {
	      return makeImmutable(new Date(obj.getTime()));
	    } else {
	      // Don't freeze the object we were given; make a clone and use that.
	      var prototype = options && options.prototype;
	      var instantiateEmptyObject = !prototype || prototype === Object.prototype ? instantiatePlainObject : function () {
	        return Object.create(prototype);
	      };
	      var clone = instantiateEmptyObject();

	      for (var key in obj) {
	        if (obj.hasOwnProperty(key)) {
	          clone[key] = Immutable(obj[key]);
	        }
	      }

	      return makeImmutableObject(clone, { instantiateEmptyObject: instantiateEmptyObject });
	    }
	  }

	  // Export the library
	  Immutable.isImmutable = isImmutable;
	  Immutable.ImmutableError = ImmutableError;

	  Object.freeze(Immutable);

	  /* istanbul ignore if */
	  if (true) {
	    module.exports = Immutable;
	  } else if (typeof exports === "object") {
	    exports.Immutable = Immutable;
	  } else if (typeof window === "object") {
	    window.Immutable = Immutable;
	  } else if (typeof global === "object") {
	    global.Immutable = Immutable;
	  }
	})();
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(6)))

/***/ },
/* 14 */
/***/ function(module, exports) {

	/**
	 * @method throwException
	 * @throws {Error}
	 * @param {String} message
	 * @return {void}
	 */
	"use strict";

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.throwException = throwException;

	function throwException(message) {
	  throw new Error("Catwalk: " + message + ".");
	}

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});
	exports.findSchemaByActionType = findSchemaByActionType;

	var _index = __webpack_require__(1);

	/**
	 * @constant actionTypes
	 * @type {WeakMap}
	 */
	var actionTypes = new WeakMap();

	exports.actionTypes = actionTypes;
	/**
	 * @constant reducerActions
	 * @type {Map}
	 */
	var reducerActions = new Map();

	exports.reducerActions = reducerActions;
	/**
	 * @method findSchemaByActionType
	 * @param {Symbol} actionType
	 * @return {Object}
	 */

	function findSchemaByActionType(actionType) {
	  return reducerActions.get(actionType)[_index.SCHEMA];
	}

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	    value: true
	});
	exports.typecaster = typecaster;

	var _registry = __webpack_require__(15);

	/**
	 * @method typecaster
	 * @return {Function}
	 */

	function typecaster() {

	    return function (next) {
	        return function (action) {
	            var type = action.type;
	            var model = action.model;

	            if (type && model) {
	                var _ret = (function () {

	                    var schema = (0, _registry.findSchemaByActionType)(type);

	                    if (schema) {

	                        var modifiedModel = Object.keys(model).reduce(function (accumulator, key) {

	                            var castFn = schema[key];

	                            if (!castFn) {

	                                // Property doesn't belong in the model, because it hasn't been
	                                // described in the associated schema.
	                                return accumulator;
	                            }

	                            // Cast the property based on the defined schema.
	                            accumulator[key] = castFn(model[key]);

	                            return accumulator;
	                        }, {});

	                        // Move the immutable model along the middleware chain.
	                        return {
	                            v: void next(Object.assign({}, action, { model: modifiedModel }))
	                        };
	                    }
	                })();

	                if (typeof _ret === 'object') return _ret.v;
	            }

	            next(action);
	        };
	    };
	}

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	  value: true
	});
	exports.isFunction = isFunction;
	exports.hasSchema = hasSchema;

	var _registry = __webpack_require__(15);

	/**
	 * @method isFunction
	 * @param {*} fn
	 * @return {Boolean}
	 */

	function isFunction(fn) {
	  return typeof fn === 'function';
	}

	/**
	 * @method hasSchema
	 * @param {*} fn
	 * @return {Boolean}
	 */

	function hasSchema(fn) {
	  return fn[_registry.SCHEMA] !== 'undefined';
	}

	/**
	 * @method hasPrimaryKey
	 * @param {Object} properties
	 * @return {Boolean}
	 */
	//export function hasPrimaryKey(properties) {
	//
	//    return Object.keys(properties).some(key => {
	//        return properties[key].options & option.PRIMARY_KEY;
	//    });
	//
	//}

/***/ },
/* 18 */
/***/ function(module, exports) {

	/**
	 * @method applyRelationships
	 * @return {Object}
	 */
	"use strict";

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.applyRelationships = applyRelationships;

	function applyRelationships() {
	  return {};
	}

/***/ }
/******/ ]);