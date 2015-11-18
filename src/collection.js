import {parse} from './collection/parse';

/**
 * @constant WeakMap
 * @type {WeakMap}
 */
const collections = new WeakMap();

/**
 * @module Catwalk
 * @submodule Collection
 * @author Adam Timberlake
 * @link https://github.com/Wildhoney/Catwalk
 */
class Collection {

    /**
     * @constructor
     * @param {String} name
     * @param {Object} properties
     * @return {Collection}
     */
    constructor(name, properties) {
        collections[this] = { name, properties: parse(properties) };
    }

    /**
     * @method create
     * @param {Object} properties
     * @return {Promise}
     */
    create(properties) {

    }

    /**
     * @method update
     * @param {Object} model
     * @param {Object} properties
     * @return {Promise}
     */
    update(model, properties) {

    }

    /**
     * @method read
     * @param {Object} properties
     * @return {Promise}
     */
    read(properties) {

    }

    /**
     * @method delete
     * @param {Object} model
     * @return {Promise}
     */
    delete(model) {

    }

}

/**
 * @method create
 * @param {String} name
 * @param {Object} properties
 * @return {Collection}
 */
export function create(name, properties) {
    return new Collection(name, properties);
}
