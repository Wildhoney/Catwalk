import {actionsFor} from '../../../src/index';
import animals from '../reducers/animals';

const {READ} = actionsFor(animals);

export function readPerson(model) {

    return dispatch => {

        Promise.resolve(model).then(model => {
            dispatch({ type: READ, model });
        });

    };

}
