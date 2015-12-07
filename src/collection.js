import {collections} from './components/store';
import {type} from './event';
import {registerCustomEvents} from './symbols/register-custom-events';

/**
 * @method collection
 * @param {String} name
 * @param {Object} schema
 * @return {Object}
 */
export function collection(name, schema) {

    registerCustomEvents(name);

}
