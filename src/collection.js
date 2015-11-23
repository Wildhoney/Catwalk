import {throwException} from './helpers/exception';
import {hasPrimaryKey} from './collection/helpers';
import {list, event} from './event';

"use strict";

/**
 * @property map
 * @type {Map}
 */
const map = new Map();

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
     * @return {void}
     */
    create(properties) {

    }

    /**
     * @method update
     * @param {Object} model
     * @param {Object} properties
     * @return {void}
     */
    update(model, properties) {

    }

    /**
     * @method read
     * @param {Object} properties
     * @return {void}
     */
    read(properties) {

    }

    /**
     * @method delete
     * @param {Object} model
     * @return {void}
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
        return list.get(event.SUBSCRIBE);
    }

    // Update the subscription function with the developer-supplied version.
    list.set(event.SUBSCRIBE, fn);

}

/**
 * @method collection
 * @param {String} name
 * @param {Object} properties
 * @return {Collection}
 */
export function collection(name, properties) {
    return new Collection(name, properties);
}
