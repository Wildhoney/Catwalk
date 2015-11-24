import {actionsFor} from '../../../src/catwalk';
import people from '../reducers/people';

export function createPerson(model) {

    const event = actionsFor(people);

    return dispatch => {

        request(`/person/create`, model).then(model => {
            dispatch({ type: event.CREATE, model });
        });

    };

}
