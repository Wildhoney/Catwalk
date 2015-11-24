import {actionsFor} from '../../../src/catwalk';
import people from '../reducers/people';

export function createPerson(model) {

    const event = actionsFor(people);

    return dispatch => {

        Promise.resolve(model).then(model => {
            dispatch({ type: event.CREATE, model });
        });

    };

}
