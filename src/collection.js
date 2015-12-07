import {isFunction} from 'lodash';
import {type} from './event';
import {events, SUBSCRIBE} from './stores/events';

/**
 * @method data
 * @type {Map}
 */
const data = new Map();

/**
 * @method eventFor
 * @param {Object} collection
 * @param {String} event
 * @return {Function}
 */
function eventFor(collection, event) {
    const eventType = type[event.toUpperCase()];
    return events.get(eventType.for(collection)) || events.get(eventType) || (() => {});
}

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

        eventFor(this, 'create')();

        Promise.resolve(properties).then(model => {

            data.get(this).push(model);

            const subscribeFn = events.get(SUBSCRIBE);
            subscribeFn(getState());

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
