import {createSchema, actionsFor} from '../../src/catwalk';
import {createField, cast, option} from '../../src/field';

export

//export default class People {
//
//    @createSchema({
//        name: createField(cast.integer(), option.PRIMARY_KEY)
//    })
//
//    reducer(state = [], action) {
//
//        const event = actionsFor(People);
//
//        switch (action.type) {
//
//            case event.CREATE:
//                return [...state, ...action.model];
//
//            case event.DELETE:
//                return state.filter(model => model.id !== action.model.id);
//
//            default:
//                return state;
//
//        }
//    }
//
//}
