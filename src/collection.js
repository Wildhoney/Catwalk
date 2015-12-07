import {events, SUBSCRIBE} from './stores/events';

/**
 * @method data
 * @type {Map}
 */
const data = new Map();

/**
 * @class Collection
 */
class Collection {

    /**
     * @method create
     * @param {Object} properties
     * @return {void}
     */
    create(properties) {

        Promise.resolve(properties).then(model => {
            data.get(this).push(model);
            const fn = events.get(SUBSCRIBE);
            fn(getState());
        });

    }

}

/**
 * @method getState
 * @return {Object}
 */
function getState() {

    return Array.from(data.keys()).reduce((accumulator, key) => {
        return { [key.name]: data.get(key) };
    }, []);

}

/**
 * @method collection
 * @param {String} name
 * @param {Object} schema
 * @return {Object}
 */
export function collection(name, schema) {

    const store = new Collection(schema);
    store.name = name;

    data.set(store, []);
    return store;

}
