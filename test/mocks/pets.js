import {collection} from '../../src/collection';
import {field, cast} from '../../src/field';

export default collection('pets', {
    name: field(cast.string()),
    age:  field(cast.integer())
});
