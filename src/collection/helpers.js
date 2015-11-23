import {option} from '../field';

/**
 * @method hasPrimaryKey
 * @param {Object} properties
 * @return {Boolean}
 */
export function hasPrimaryKey(properties) {

    return Object.keys(properties).some(key => {
        return properties[key].options & option.PRIMARY_KEY;
    });

}
