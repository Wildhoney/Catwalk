import {isFunction} from 'lodash';
import {type} from './event';
import {events, SUBSCRIBE} from './stores/events';
import {tree, create, append, getState} from './stores/data-tree';

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
            append(this, model);
            const subscribeFn = events.get(SUBSCRIBE);
            subscribeFn(getState());

        });

    }

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
    create(store);
    return store;

}
