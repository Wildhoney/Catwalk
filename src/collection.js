import {parse} from './collection/parse';
import {map} from './collection/map';

"use strict";

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
        map.set(this, { name, properties: parse(properties) });
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
 * @method create
 * @param {String} name
 * @param {Object} properties
 * @return {Collection}
 */
export function create(name, properties) {
    return new Collection(name, properties);
}
