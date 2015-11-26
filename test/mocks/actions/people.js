import {actionsFor} from '../../../src/catwalk';
import people from '../reducers/people';

const {CREATE, READ, UPDATE, DELETE} = actionsFor(people);

export function createPerson(model) {

    return dispatch => {

        Promise.resolve(model).then(model => {
            dispatch({ type: CREATE, model });
        });

    };

}

export function readPerson(model) {

    return dispatch => {

        Promise.resolve(model).then(model => {
            dispatch({ type: READ, model });
        });

    };

}

export function updatePerson(index, model) {

    return dispatch => {

        Promise.resolve(model).then(model => {
            dispatch({ type: UPDATE, model, index });
        });

    };

}

export function deletePerson(model) {

    return dispatch => {

        Promise.resolve(model).then(model => {
            dispatch({ type: DELETE, model });
        });

    };

}
