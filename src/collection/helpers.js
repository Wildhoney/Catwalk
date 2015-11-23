import {PRIMARY_KEY} from '../type';

/**
 * @method hasPrimaryKey
 * @param {Object} properties
 * @return {Boolean}
 */
export function hasPrimaryKey(properties) {

    return Object.keys(properties).some(key => {
        return properties[key].options & PRIMARY_KEY;
    });

}
