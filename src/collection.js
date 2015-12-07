import {events, SUBSCRIBE} from './stores/events';

/**
 * @constant collections
 * @type {Map}
 */
const collections = new Map();

/**
 * @method create
 * @param {Object} properties
 * @return {void}
 */
function create(properties) {

    Promise.resolve(properties).then(model => {
        const fn = events.get(SUBSCRIBE);
        fn({ pets: [model] });
    });

}

/**
 * @method collection
 * @param {String} name
 * @param {Object} schema
 * @return {Object}
 */
export function collection(name, schema) {
    collections.set(name, schema);
    return { name, create };
}
