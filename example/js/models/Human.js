import {Model} from 'catwalk';
import {onCreate} from 'catwalk/events';
import {asString, asNumber} from 'catwalk/typecast';
import {hasMany} from 'catwalk/relationships';
import {NOT_EXIST} from 'catwalk/responses';
import Pet from './Pet';

export default class extends Model {

    @asString
    name = 'Adam';

    @asNumber
    age = null;

    @hasMany(Pet, 'name')
    pets = null

}
