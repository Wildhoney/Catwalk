/**
 * @constant collections
 * @type {Map}
 */
const collections = new Map();

/**
 * @method collection
 * @param {String} name
 * @param {Object} schema
 * @return {Object}
 */
export function collection(name, schema) {
    collections.set(name, schema);
    return { create: () => {} };
}
