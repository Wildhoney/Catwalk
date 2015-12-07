/**
 * @method field
 * @param {Function} cast
 * @param {Object} options
 * @return {Function}
 */
export function field(cast, options) {
    void cast;
    void options;
    return () => {};
}

/**
 * @method compose
 * @param {Array} casts
 * @return {Function}
 */
export function compose(...casts) {
    void casts;
    return () => {};
}

/**
 * @method isUndefined
 * @param {*} value
 * @return {Boolean}
 */
function isUndefined(value) {
    return value === null || typeof value === 'undefined';
}

/**
 * @method string
 * @return {Function}
 */
export function string() {
    return value => String(isUndefined(value) ? '' : value);
}


/**
 * @method integer
 * @return {Function}
 */
export function integer() {

    return value => {
        const n = parseInt(value, 10);
        return isNaN(n) ? 0 : n;
    };

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
    };

}

/**
 * @method array
 * @return {Function}
 */
export function array() {
    return value => Array.isArray(value) ? value : [value];
}

/**
 * @constant cast
 * @type {Object}
 */
export const cast = { string, integer, float, array };
