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

	"use strict";

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});

	var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

	exports.create = create;

	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var _collectionParse = __webpack_require__(1);

	"use strict";

	/**
	 * @constant WeakMap
	 * @type {WeakMap}
	 */
	var collections = new WeakMap();

	exports.collections = collections;
	/**
	 * @module Catwalk
	 * @submodule Collection
	 * @author Adam Timberlake
	 * @link https://github.com/Wildhoney/Catwalk
	 */

	var Collection = (function () {

	  /**
	   * @constructor
	   * @param {String} name
	   * @param {Object} properties
	   * @return {Collection}
	   */

	  function Collection(name, properties) {
	    _classCallCheck(this, Collection);

	    collections[this] = { name: name, properties: (0, _collectionParse.parse)(properties) };
	  }

	  /**
	   * @method create
	   * @param {String} name
	   * @param {Object} properties
	   * @return {Collection}
	   */

	  /**
	   * @method create
	   * @param {Object} properties
	   * @return {Promise}
	   */

	  _createClass(Collection, [{
	    key: "create",
	    value: function create(properties) {}

	    /**
	     * @method update
	     * @param {Object} model
	     * @param {Object} properties
	     * @return {Promise}
	     */
	  }, {
	    key: "update",
	    value: function update(model, properties) {}

	    /**
	     * @method read
	     * @param {Object} properties
	     * @return {Promise}
	     */
	  }, {
	    key: "read",
	    value: function read(properties) {}

	    /**
	     * @method delete
	     * @param {Object} model
	     * @return {Promise}
	     */
	  }, {
	    key: "delete",
	    value: function _delete(model) {}
	  }]);

	  return Collection;
	})();

	exports.Collection = Collection;

	function create(name, properties) {
	  return new Collection(name, properties);
	}

/***/ },
/* 1 */
/***/ function(module, exports) {

	/**
	 * @method parse
	 * @param {Object} properties
	 * @return {Object}
	 */
	"use strict";

	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.parse = parse;

	function parse(properties) {}

/***/ }
/******/ ]);