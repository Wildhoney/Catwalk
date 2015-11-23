/**
 * @constant PRIMARY_KEY
 * @field {Number}
 */
export const PRIMARY_KEY = 1;

/**
 * @method field
 * @param {Function} cast
 * @param {Number} [options = 0]
 * @return {Object}
 */
export function field(cast, options = 0) {
    return { cast, options };
}

/**
 * @property cast
 * @type {Object}
 */
export const cast = {

    /**
     * @method string
     * @return {Function}
     */
    string() {
        return value => String(value)
    },

    /**
     * @method integer
     * @return {Function}
     */
    integer() {
        return value => Number(value)
    },

    /**
     * @method float
     * @param {Number} [decimalPlaces = 0]
     * @return {Function}
     */
    float(decimalPlaces = 0) {

        return value => {
            const n = Math.pow(10, decimalPlaces);
            return Math.round((n * value).toFixed(decimalPlaces)) / n;
        }

    }

};