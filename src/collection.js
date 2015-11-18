import {parse} from './collection/parse';

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
        this.name = name;
        this.properties = parse(properties);
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
