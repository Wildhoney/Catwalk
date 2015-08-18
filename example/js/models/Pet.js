import {Model} from 'catwalk';
import {asString} from 'catwalk/typecast';

export default class extends Model {

    @asString
    name = 'Adam';

}
