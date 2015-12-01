import {SCHEMA} from '../index';

/**
 * @constant actionSymbols
 * @type {Map}
 */
export const actionSymbols = new Map();

/**
 * @method findSchemaByActionType
 * @param {Symbol} actionType
 * @return {Object|Boolean}
 */
export function findSchemaByActionType(actionType) {

    const records = Array.from(actionSymbols.keys()).filter(key => {
        const symbols = Object.values(actionSymbols.get(key));
        return symbols.includes(actionType);
    });

    return records.length ? records[0][SCHEMA] : false;

}
