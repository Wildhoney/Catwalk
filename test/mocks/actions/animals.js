import {actionsFor} from '../../../src/index';
import animals from '../reducers/animals';

const {CREATE, READ} = actionsFor(animals);

export function createAnimal(model) {

    return dispatch => {

        Promise.resolve(model).then(model => {
            dispatch({ type: CREATE, model });
        });

    };

}

export function readAnimal(model) {

    return dispatch => {

        Promise.resolve(model).then(model => {
            dispatch({ type: READ, model });
        });

    };

}
