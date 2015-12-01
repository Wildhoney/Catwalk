import {SCHEMA} from '../core';

/**
 * @constant actionTypes
 * @type {Map}
 */
export const actionTypes = new Map();

/**
 * @method findSchemaByActionType
 * @param {Symbol} actionType
 * @return {Object|Boolean}
 */
export function findSchemaByActionType(actionType) {

    /**
     * @method map
     * @param {Function} key
     * @return {Boolean}
     */
    const map = key => {
        const symbols = Object.values(actionTypes.get(key));
        return symbols.includes(actionType) ? key[SCHEMA] : false;
    };

    /**
     * @property filter
     * @param {Function|Boolean} schema
     * @return {Boolean}
     */
    const filter = schema => schema !== false;

    return Array.from(actionTypes.keys())
                .map(map)
                .filter(filter)[0] || false;

}
