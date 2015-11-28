/**
 * @property option
 * @type {Object}
 */
export const option = {
    PRIMARY_KEY: 1
};

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
        return value => String(value == null ? '' : value);
    },

    /**
     * @method integer
     * @return {Function}
     */
    integer() {

        return value => {
            const n = parseInt(value);
            return isNaN(n) ? 0 : n;
        }

    },

    /**
     * @method float
     * @param {Number} [decimalPlaces = 0]
     * @return {Function}
     */
    float(decimalPlaces = 0) {

        return value => {
            const n = Math.pow(10, decimalPlaces);
            const v = Math.round((n * value).toFixed(decimalPlaces)) / n;
            return isNaN(v) ? 0 : v;
        }

    },

    /**
     * @method array
     * @return {Function}
     */
    array() {

        return value => {
            return Array.isArray(value) ? value : [value];
        };

    }

};