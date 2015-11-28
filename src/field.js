/**
 * @constant HAS_ONE
 * @type {String}
 */
export const HAS_ONE = 'one';

/**
 * @constant HAS_MANY
 * @type {String}
 */
export const HAS_MANY = 'many';

/**
 * @method string
 * @return {Function}
 */
export function string() {
    return value => String(value == null ? '' : value);
}


/**
 * @method integer
 * @return {Function}
 */
export function integer() {

    return value => {
        const n = parseInt(value);
        return isNaN(n) ? 0 : n;
    }

}

/**
 * @method float
 * @param {Number} [decimalPlaces = 0]
 * @return {Function}
 */
export function float(decimalPlaces = 0) {

    return value => {
        const n = Math.pow(10, decimalPlaces);
        const v = Math.round((n * value).toFixed(decimalPlaces)) / n;
        return isNaN(v) ? 0 : v;
    }

}

/**
 * @method array
 * @return {Function}
 */
export function array() {
    return value => Array.isArray(value) ? value : [value];
}

/**
 * @method relationship
 * @param {String} type
 * @param {Function} store
 * @param {String} [property = 'id']
 * @return {Function}
 */
export function relationship(type, store, property = 'id') {
    return value => value;
}
