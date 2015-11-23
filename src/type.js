/**
 * @constant PRIMARY_KEY
 * @type {Number}
 */
export const PRIMARY_KEY = 1;

/**
 * @method type
 * @param {Function} cast
 * @param {Number} [options = 0]
 * @return {Object}
 */
export function type(cast, options = 0) {
    return { cast, options };
}

/**
 * @method string
 * @return {Function}
 */
export function string() {
    return value => String(value)
}

/**
 * @method integer
 * @return {Function}
 */
export function integer() {
    return value => Number(value)
}

/**
 * @method float
 * @param {Number} [decimalPlaces = 0]
 * @return {Function}
 */
export function float(decimalPlaces = 0) {

    return value => {
        const n = Math.pow(10, decimalPlaces);
        return Math.round((n * value).toFixed(decimalPlaces)) / n;
    }

}
