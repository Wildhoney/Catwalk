import {type} from '../event';

/**
 * @method registerCustomEvents
 * @param {String} name
 * @return {void}
 */
export function registerCustomEvents(name) {

    const collectionName = name.toUpperCase();

    Object.keys(type).forEach(key => {

        const symbol = type[key];
        const eventName = key.toLowerCase();

        // Register each symbol on the prototype of the corresponding event. This will yield
        // custom events such as CREATE.PETS, DELETE.PETS, etc... which extend their more
        // generic counterparts: CREATE, DELETE...
        Object.getPrototypeOf(symbol)[key] = Symbol(`${eventName}/${collectionName}`);

    });

}
