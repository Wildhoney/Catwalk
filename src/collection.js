import {throwException} from './helpers/exception';
import {hasPrimaryKey} from './collection/helpers';

"use strict";

/**
 * @constant FN_UPDATED
 * @type {String}
 */
const FN_UPDATED = 'updated';

/**
 * @property map
 * @type {Map}
 */
const map = new Map()

/**
 * @property events
 * @type {Map}
 */
const events = new Map().set(FN_UPDATED, () => {});;

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

        // Ensure we have a primary key defined in the collection somewhere.
        !hasPrimaryKey(properties) && throwException(`Must define a PK on "${name}" collection`);

        // Store the blueprint outside of the object to prevent polluting its public interface.
        map.set(this, { name, properties });

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
 * @method size
 * @return {Number}
 */
export function size() {
    return map.size;
}

/**
 * @method subscribe
 * @param {Function} fn
 * @return {Function|void}
 */
export function subscribe(fn) {

    if (typeof fn === 'undefined') {
        return events.get(FN_UPDATED);
    }

    // Update the subscription function with the developer-supplied version.
    events.set(FN_UPDATED, fn);

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
