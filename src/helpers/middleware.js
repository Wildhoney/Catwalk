import Immutable from 'seamless-immutable';
import {findSchemaByActionType} from './registry';

/**
 * @method typecaster
 * @return {Function}
 */
export function typecaster() {

    return next => action => {

        const {type, model} = action;

        if (type && model) {

            const schema = findSchemaByActionType(type);

            if (schema) {

                const modifiedModel = Object.keys(model).reduce((accumulator, key) => {

                    const {cast} = schema[key] || { cast: false };

                    if (!cast) {

                        // Property doesn't belong in the model, because it hasn't been
                        // described in the associated schema.
                        return accumulator;

                    }

                    // Cast the property based on the defined schema.
                    accumulator[key] = cast(model[key]);

                    return accumulator;

                }, {});

                // Move the immutable model along the middleware chain.
                return void next(Immutable(Object.assign({}, action, { model: modifiedModel })));

            }

        }

        next(action);

    };

}
