import Immutable from 'seamless-immutable';

/**
 * @method tree
 * @type {Map}
 */
export const tree = new Map();

/**
 * @method append
 * @param {Object} key
 * @param {Object} data
 * @return {tree}
 */
export function append(key, data) {
    tree.set(key, new Immutable([...tree.get(key), data]));
}

/**
 * @method create
 * @param {Object} key
 * @return {void}
 */
export function create(key) {
    tree.set(key, new Immutable([]));
}

/**
 * @method getState
 * @return {Object}
 */
export function getState() {

    return Array.from(tree.keys()).reduce((accumulator, key) => {
        return { [key.name]: tree.get(key) };
    }, []);

}
